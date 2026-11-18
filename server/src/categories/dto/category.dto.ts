import { IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 50, { message: '分类名称需为 1-50 字' })
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 50, { message: '分类名称需为 1-50 字' })
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort?: number;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';
}
