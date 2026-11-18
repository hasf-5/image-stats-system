import { IsEnum, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Role, UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @Length(2, 50, { message: '账号长度需为 2-50 位' })
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: '账号只能包含字母、数字、下划线、点和短横线' })
  username: string;

  @IsString()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[\S]{8,32}$/, {
    message: '密码需 8-32 位，且同时包含字母和数字',
  })
  password: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  nickname?: string;

  @IsOptional()
  @IsEnum(Role, { message: '角色不合法' })
  role?: Role;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: UserStatus;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(0, 50)
  nickname?: string;

  @IsOptional()
  @IsEnum(Role, { message: '角色不合法' })
  role?: Role;

  @IsOptional()
  @IsEnum(UserStatus, { message: '状态不合法' })
  status?: UserStatus;
}

export class ResetPwdDto {
  /** 不传则服务端生成随机强密码，仅在响应中返回一次 */
  @IsOptional()
  @IsString()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[\S]{8,32}$/, {
    message: '密码需 8-32 位，且同时包含字母和数字',
  })
  newPassword?: string;
}
