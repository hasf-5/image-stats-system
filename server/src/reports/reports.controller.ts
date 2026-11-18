import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser, JwtUser, Roles } from '../common/decorators';
import { CreateReportDto, UpdateReportDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

@Controller('admin/reports')
@Roles('admin')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  async list() {
    const rows = await this.reports.list();
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      granularity: r.granularity,
      group_by: r.groupBy,
      date_start: r.dateStart,
      date_end: r.dateEnd,
      createdAt: r.createdAt,
    }));
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateReportDto, @Ip() ip: string) {
    return this.reports.create(user, dto, ip);
  }

  @Put(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportDto,
    @Ip() ip: string,
  ) {
    return this.reports.update(user, id, dto, ip);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number, @Ip() ip: string) {
    return this.reports.remove(user, id, ip);
  }
}
