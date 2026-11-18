import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: '请输入账号' })
  @Length(2, 50, { message: '账号长度需为 2-50 位' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: '请输入密码' })
  @Length(6, 64, { message: '密码长度需为 6-64 位' })
  password: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty({ message: 'refreshToken 不能为空' })
  refreshToken: string;
}

export class ChangePwdDto {
  @IsString()
  @IsNotEmpty({ message: '请输入原密码' })
  oldPassword: string;

  @IsString()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[\S]{8,32}$/, {
    message: '新密码需 8-32 位，且同时包含字母和数字',
  })
  newPassword: string;
}
