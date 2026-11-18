import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY, JwtUser } from '../decorators';
import { PrismaService } from '../../prisma/prisma.module';
import { RedisService } from '../../redis/redis.module';

/**
 * 全局 JWT 守卫：默认所有接口都需要 access token，
 * 只有 @Public() 标记的接口放行。
 * 每次请求回查用户状态，保证「禁用」能立即生效（主键查询，成本可接受）。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('登录已失效，请重新登录');

    let payload: JwtUser;
    try {
      payload = await this.jwt.verifyAsync<JwtUser>(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me',
      });
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }

    if (payload.typ !== 'access') throw new UnauthorizedException('登录已失效，请重新登录');
    if (await this.redis.isBlacklisted(payload.jti, 'access')) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, role: true, nickname: true, status: true },
    });
    if (!user) throw new UnauthorizedException('登录已失效，请重新登录');
    if (user.status === 'disabled') throw new UnauthorizedException('账号已被禁用，请联系管理员');

    req.user = {
      ...payload,
      id: user.id,
      username: user.username,
      role: user.role,
      nickname: user.nickname,
    } as JwtUser;
    return true;
  }
}
