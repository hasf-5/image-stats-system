import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtUser } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.module';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * 分类列表。
   * @param onlyActive 用户端只看到启用分类；管理端看到全部
   */
  async list(onlyActive = false) {
    const rows = await this.prisma.category.findMany({
      where: onlyActive ? { status: 'active' } : undefined,
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { images: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sort: r.sort,
      status: r.status,
      createdAt: r.createdAt,
      imageCount: r._count.images,
    }));
  }

  async create(operator: JwtUser, dto: CreateCategoryDto, ip: string) {
    const name = dto.name.trim();
    const exists = await this.prisma.category.findUnique({ where: { name } });
    if (exists) throw new ConflictException('分类名称已存在');

    const cat = await this.prisma.category.create({
      data: { name, sort: dto.sort ?? 0 },
    });
    await this.audit.log(operator.id, 'category_create', cat.id, ip);
    return cat;
  }

  async update(operator: JwtUser, id: number, dto: UpdateCategoryDto, ip: string) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('分类不存在');

    if (dto.name && dto.name.trim() !== cat.name) {
      const dup = await this.prisma.category.findUnique({ where: { name: dto.name.trim() } });
      if (dup) throw new ConflictException('分类名称已存在');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        sort: dto.sort,
        status: dto.status,
      },
    });
    await this.audit.log(operator.id, 'category_update', id, ip);
    return updated;
  }

  async remove(operator: JwtUser, id: number, ip: string) {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { images: true } } },
    });
    if (!cat) throw new NotFoundException('分类不存在');
    if (cat._count.images > 0) {
      throw new BadRequestException(
        `该分类下已有 ${cat._count.images} 条图片记录，不能删除；请改为「禁用」以停止使用`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
    await this.audit.log(operator.id, 'category_delete', id, ip);
    return { success: true };
  }
}
