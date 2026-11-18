import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../common/decorators';
import { StatsService } from './stats.service';

@Controller('admin/stats')
@Roles('admin')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  query(@Query() q: any) {
    return this.stats.query(q);
  }

  @Get('export')
  async export(@Query() q: any, @Res() res: Response) {
    const { filename, content } = await this.stats.exportCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(content);
  }
}
