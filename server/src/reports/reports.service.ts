import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtUser } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.module';
import { CreateReportDto, UpdateReportDto } from './dto/report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.reportConfig.findMany({ orderBy: { id: 'desc' } });
  }

  async create(operator: JwtUser, dto: CreateReportDto, ip: string) {
    const row = await this.prisma.reportConfig.create({
      data: {
        name: dto.name.trim(),
        granularity: dto.granularity,
        groupBy: dto.group_by,
        dateStart: dto.date_start || null,
        dateEnd: dto.date_end || null,
        createdBy: operator.id,
      },
    });
    await this.audit.log(operator.id, 'report_create', row.id, ip);
    return this.toDto(row);
  }

  async update(operator: JwtUser, id: number, dto: UpdateReportDto, ip: string) {
    const row = await this.prisma.reportConfig.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('报表配置不存在');
    const updated = await this.prisma.reportConfig.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        granularity: dto.granularity,
        groupBy: dto.group_by,
        dateStart: dto.date_start,
        dateEnd: dto.date_end,
      },
    });
    await this.audit.log(operator.id, 'report_update', id, ip);
    return this.toDto(updated);
  }

  async remove(operator: JwtUser, id: number, ip: string) {
    const row = await this.prisma.reportConfig.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('报表配置不存在');
    await this.prisma.reportConfig.delete({ where: { id } });
    await this.audit.log(operator.id, 'report_delete', id, ip);
    return { success: true };
  }

  /** DB 字段 snake_case 友好化，前端只用 camelCase + 兼容字段 */
  private toDto(r: any) {
    return {
      id: r.id,
      name: r.name,
      granularity: r.granularity,
      group_by: r.groupBy,
      date_start: r.dateStart,
      date_end: r.dateEnd,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    };
  }
}
