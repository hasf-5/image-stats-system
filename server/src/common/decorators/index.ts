import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface JwtUser {
  /** JWT 标准声明：用户 id */
  sub: number;
  id: number;
  username: string;
  role: Role;
  nickname?: string | null;
  jti: string;
  typ: 'access' | 'refresh';
  exp?: number;
}

/** 取当前登录用户（由 JwtAuthGuard 注入） */
export const CurrentUser = createParamDecorator(
  (field: keyof JwtUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return field ? req.user?.[field] : req.user;
  },
);

/** 标记接口无需登录 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** 角色限制：@Roles('admin') */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** 读取客户端真实 IP（Nginx 反代已设置 X-Forwarded-For） */
export function clientIp(req: any): string {
  const xff = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : (xff || '').split(',')[0];
  return (raw || req?.ip || req?.socket?.remoteAddress || '').replace('::ffff:', '').slice(0, 64);
}
