import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { parsePagination } from '../common/utils/pagination';
import { AuditService } from './audit.service';

@Controller('admin/audit-logs')
@Roles('admin')
@UseGuards(RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(@Query() query: any) {
    const { page, pageSize, skip } = parsePagination(query, 20, 100);
    return this.audit.list(page, pageSize, skip);
  }
}
