import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateReportDto {
  @IsString()
  @Length(1, 80, { message: '报表名称需为 1-80 字' })
  name: string;

  @IsIn(['day', 'week', 'month'], { message: '粒度仅支持 day/week/month' })
  granularity: 'day' | 'week' | 'month';

  @IsIn(['category', 'user'], { message: '分组仅支持 category/user' })
  group_by: 'category' | 'user';

  @IsOptional()
  @Matches(DATE, { message: 'date_start 格式为 yyyy-MM-dd' })
  date_start?: string;

  @IsOptional()
  @Matches(DATE, { message: 'date_end 格式为 yyyy-MM-dd' })
  date_end?: string;
}

export class UpdateReportDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  granularity?: 'day' | 'week' | 'month';

  @IsOptional()
  @IsIn(['category', 'user'])
  group_by?: 'category' | 'user';

  @IsOptional()
  @Matches(DATE)
  date_start?: string;

  @IsOptional()
  @Matches(DATE)
  date_end?: string;
}
