import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { CurrentUser, JwtUser, Public } from '../common/decorators';
import { AuthService } from './auth.service';
import { ChangePwdDto, LoginDto, RefreshDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@CurrentUser() user: JwtUser, @Body() body: any, @Ip() ip: string) {
    return this.auth.logout(user, body?.refreshToken, ip);
  }

  @Post('change-pwd')
  changePwd(@CurrentUser() user: JwtUser, @Body() dto: ChangePwdDto) {
    return this.auth.changePwd(user, dto);
  }

  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.auth.me(user);
  }
}
