import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { JwtUser } from '../common/decorators';
import { parsePagination } from '../common/utils/pagination';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.module';
import { CreateUserDto, ResetPwdDto, UpdateUserDto } from './dto/user.dto';

const PUBLIC_SELECT = {
  id: true,
  username: true,
  nickname: true,
  role: true,
  status: true,
  mustChangePwd: true,
  createdAt: true,
  createdBy: true,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: any) {
    const { page, pageSize, skip, take } = parsePagination(query, 20, 100);
    const where: Prisma.UserWhereInput = {};
    if (query.keyword) {
      where.OR = [
        { username: { contains: String(query.keyword).trim() } },
        { nickname: { contains: String(query.keyword).trim() } },
      ];
    }
    if (query.role && ['admin', 'user'].includes(query.role)) where.role = query.role as Role;
    if (query.status && ['active', 'disabled'].includes(query.status)) where.status = query.status as UserStatus;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: { ...PUBLIC_SELECT, _count: { select: { images: true } } },
        orderBy: [{ role: 'asc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      list: rows.map((u) => ({
        ...u,
        imageCount: (u as any)._count?.images ?? 0,
        _count: undefined,
      })),
      total,
      page,
      pageSize,
    };
  }

  async create(operator: JwtUser, dto: CreateUserDto, ip: string) {
    const username = dto.username.trim();
    const exists = await this.prisma.user.findUnique({ where: { username } });
    if (exists) throw new ConflictException('该账号已存在');

    const user = await this.prisma.user.create({
      data: {
        username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        nickname: dto.nickname?.trim() || username,
        role: dto.role || 'user',
        status: dto.status || 'active',
        // 管理员代建的账号，首次登录后建议改密
        mustChangePwd: true,
        createdBy: operator.id,
      },
      select: PUBLIC_SELECT,
    });
    await this.audit.log(operator.id, 'user_create', user.id, ip);
    return user;
  }

  async update(operator: JwtUser, id: number, dto: UpdateUserDto, ip: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('用户不存在');

    // 防自锁：不能把自己降级或禁用
    if (target.id === operator.id) {
      if (dto.role && dto.role !== 'admin') throw new BadRequestException('不能修改自己的管理员角色');
      if (dto.status && dto.status !== 'active') throw new BadRequestException('不能禁用自己的账号');
    }

    // 至少保留一个可用的管理员
    if (target.role === 'admin' && (dto.role === 'user' || dto.status === 'disabled')) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: { role: 'admin', status: 'active', id: { not: id } },
      });
      if (otherActiveAdmins === 0) throw new BadRequestException('系统至少需要保留一个启用的管理员');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        nickname: dto.nickname === undefined ? undefined : dto.nickname.trim(),
        role: dto.role,
        status: dto.status,
      },
      select: PUBLIC_SELECT,
    });
    await this.audit.log(operator.id, 'user_update', id, ip);
    return user;
  }

  async resetPwd(operator: JwtUser, id: number, dto: ResetPwdDto, ip: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('用户不存在');

    const plain = dto.newPassword || this.randomPassword(10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(plain, 10), mustChangePwd: true },
    });
    await this.audit.log(operator.id, 'user_reset_pwd', id, ip);
    // 明文仅此一次返回，前端需提示管理员抄送
    return { username: target.username, password: plain };
  }

  async remove(operator: JwtUser, id: number, ip: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { images: true } } },
    });
    if (!target) throw new NotFoundException('用户不存在');
    if (target.id === operator.id) throw new BadRequestException('不能删除自己的账号');

    if (target.role === 'admin') {
      const otherActiveAdmins = await this.prisma.user.count({
        where: { role: 'admin', status: 'active', id: { not: id } },
      });
      if (otherActiveAdmins === 0) throw new BadRequestException('系统至少需要保留一个启用的管理员');
    }

    // 业务规则：有记录的用户只禁用不删除，保证统计可追溯
    if (target._count.images > 0) {
      throw new ForbiddenException(
        `该用户已有 ${target._count.images} 条图片记录，为保证统计可追溯只能禁用，不能删除`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    await this.audit.log(operator.id, 'user_delete', id, ip);
    return { success: true };
  }

  private randomPassword(len: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = randomBytes(len);
    let s = '';
    for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
    // 兜底保证同时含字母与数字
    return `Aa1${s}`.slice(0, Math.max(len, 8));
  }
}
