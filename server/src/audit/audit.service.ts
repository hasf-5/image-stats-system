import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'change_pwd'
  | 'user_create'
  | 'user_update'
  | 'user_reset_pwd'
  | 'user_delete'
  | 'image_upload'
  | 'image_void'
  | 'image_restore'
  | 'category_create'
  | 'category_update'
  | 'category_delete'
  | 'report_create'
  | 'report_update'
  | 'report_delete';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  /** 审计写入失败不能影响主业务，仅记录日志 */
  async log(userId: number | null, action: AuditAction, targetId?: string | number, ip?: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action,
          targetId: targetId === undefined || targetId === null ? null : String(targetId),
          ip: ip || null,
        },
      });
    } catch (e: any) {
      this.logger.warn(`audit write failed: ${action} ${e.message}`);
    }
  }

  async list(page: number, pageSize: number, skip: number) {
    const [list, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        skip,
        take: pageSize,
        orderBy: { id: 'desc' },
        include: { user: { select: { id: true, username: true, nickname: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { list, total, page, pageSize };
  }
}
