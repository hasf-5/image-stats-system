import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UploadImageDto {
  @Type(() => Number)
  @IsInt({ message: '请选择分类' })
  @Min(1)
  categoryId: number;

  @IsOptional()
  @IsString()
  @Length(0, 255, { message: '备注最多 255 字' })
  remark?: string;

  @IsOptional()
  @IsIn(['mobile', 'pc'])
  clientType?: 'mobile' | 'pc';
}

export class VoidImageDto {
  @IsOptional()
  @IsString()
  @Length(0, 255)
  reason?: string;
}
