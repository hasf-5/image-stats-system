import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { JwtUser } from '../common/decorators';
import { detectImageType } from '../common/utils/image';
import { parsePagination } from '../common/utils/pagination';
import { normalizeRange, rangeToUtc } from '../common/utils/time';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.module';
import { STORAGE_DRIVER, StorageDriver } from '../storage/storage.interface';
import { UploadImageDto, VoidImageDto } from './dto/image.dto';

const LIST_INCLUDE = {
  category: { select: { id: true, name: true } },
  user: { select: { id: true, username: true, nickname: true } },
  voider: { select: { id: true, username: true } },
};

@Injectable()
export class ImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** 去掉内部字段，统一输出前端所需结构 */
  private shape(r: any) {
    if (!r) return r;
    return {
      id: r.id,
      fileUrl: r.fileUrl,
      fileSize: r.fileSize,
      fileHash: r.fileHash,
      remark: r.remark,
      status: r.status,
      submitTime: r.submitTime,
      voidTime: r.voidTime,
      voidReason: r.voidReason,
      clientType: r.clientType,
      category: r.category,
      user: r.user,
      voider: r.voider,
    };
  }

  /**
   * 多图上传。安全要点：
   * 1) MIME 白名单（multer fileFilter）
   * 2) 文件魔数校验（detectImageType）—— MIME 可伪造，魔数不可
   * 3) UUID 重命名 + 日期目录（StorageDriver）
   * 4) 只落盘校验通过的文件，单张失败不影响整批（返回逐张结果）
   */
  async upload(user: JwtUser, files: Express.Multer.File[], dto: UploadImageDto, ip: string) {
    if (!files?.length) throw new BadRequestException('请至少选择一张图片');

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category || category.status !== 'active') throw new BadRequestException('分类不存在或已停用');

    const created: any[] = [];
    const failed: { index: number; name: string; reason: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const original = Buffer.from(f.originalname || 'image', 'latin1').toString('utf8');
      if (!f.size) {
        failed.push({ index: i, name: original, reason: '空文件' });
        continue;
      }
      const ext = detectImageType(f.buffer);
      if (!ext) {
        failed.push({ index: i, name: original, reason: '文件内容不是有效图片' });
        continue;
      }

      const saved = await this.storage.save(f.buffer, ext);
      const record = await this.prisma.imageRecord.create({
        data: {
          userId: user.id,
          categoryId: dto.categoryId,
          fileUrl: saved.url,
          fileSize: saved.size,
          fileHash: createHash('sha256').update(f.buffer).digest('hex'),
          remark: dto.remark?.trim() || null,
          clientType: dto.clientType || null,
          submitTime: new Date(),
        },
        include: LIST_INCLUDE,
      });
      created.push(this.shape(record));
    }

    if (!created.length) {
      throw new BadRequestException(failed[0]?.reason || '上传失败，请检查图片格式');
    }    await this.audit.log(user.id, 'image_upload', `count:${created.length}`, ip);
    return { success: created.length, failed, records: created };
  }

  /** 我的记录：分页 + 分类/状态/时间筛选 */
  async mine(user: JwtUser, query: any) {
    const { page, pageSize, skip, take } = parsePagination(query, 20, 100);
    const where: Prisma.ImageRecordWhereInput = { userId: user.id };

    if (query.categoryId) where.categoryId = Number(query.categoryId);
    if (query.status && ['normal', 'void'].includes(query.status)) where.status = query.status as any;
    if (query.from || query.to) {
      const { from, to } = normalizeRange(query.from, query.to, 30);
      const { start, end } = rangeToUtc(from, to);
      where.submitTime = { gte: start, lte: end };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.imageRecord.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { submitTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.imageRecord.count({ where }),
    ]);

    return { list: rows.map((r) => this.shape(r)), total, page, pageSize };
  }

  /** 本人作废：仅限当天（Asia/Shanghai）且状态为 normal */
  async voidOwn(user: JwtUser, id: number, dto: VoidImageDto) {
    const rec = await this.prisma.imageRecord.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    if (rec.userId !== user.id) throw new ForbiddenException('只能作废自己的记录');
    if (rec.status === 'void') throw new BadRequestException('该记录已作废');

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
    const submitDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(rec.submitTime);
    if (submitDay !== today) throw new ForbiddenException('只能作废当天的记录，更早的记录请联系管理员');

    const updated = await this.prisma.imageRecord.update({
      where: { id },
      data: {
        status: 'void',
        voidBy: user.id,
        voidTime: new Date(),
        voidReason: dto.reason?.trim() || '本人作废',
      },
      include: LIST_INCLUDE,
    });
    return this.shape(updated);
  }

  /** 后台记录管理：分类 / 用户 / 状态 / 时间 / 关键字 */
  async adminList(query: any) {
    const { page, pageSize, skip, take } = parsePagination(query, 20, 100);
    const where: Prisma.ImageRecordWhereInput = {};

    if (query.categoryId) where.categoryId = Number(query.categoryId);
    if (query.userId) where.userId = Number(query.userId);
    if (query.status && ['normal', 'void'].includes(query.status)) where.status = query.status as any;
    if (query.keyword) where.remark = { contains: String(query.keyword).trim() };
    if (query.from || query.to) {
      const { from, to } = normalizeRange(query.from, query.to, 30);
      const { start, end } = rangeToUtc(from, to);
      where.submitTime = { gte: start, lte: end };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.imageRecord.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { submitTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.imageRecord.count({ where }),
    ]);

    return { list: rows.map((r) => this.shape(r)), total, page, pageSize };
  }

  async adminVoid(operator: JwtUser, id: number, dto: VoidImageDto, ip: string) {
    const rec = await this.prisma.imageRecord.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    if (rec.status === 'void') throw new BadRequestException('该记录已作废');

    const updated = await this.prisma.imageRecord.update({
      where: { id },
      data: {
        status: 'void',
        voidBy: operator.id,
        voidTime: new Date(),
        voidReason: dto.reason?.trim() || '管理员作废',
      },
      include: LIST_INCLUDE,
    });
    await this.audit.log(operator.id, 'image_void', id, ip);
    return this.shape(updated);
  }

  /** 恢复作废（误操作回滚），统计口径随之恢复 */
  async restore(operator: JwtUser, id: number, ip: string) {
    const rec = await this.prisma.imageRecord.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('记录不存在');
    if (rec.status === 'normal') throw new BadRequestException('该记录未被作废');

    const updated = await this.prisma.imageRecord.update({
      where: { id },
      data: { status: 'normal', voidBy: null, voidTime: null, voidReason: null },
      include: LIST_INCLUDE,
    });
    await this.audit.log(operator.id, 'image_restore', id, ip);
    return this.shape(updated);
  }
}
