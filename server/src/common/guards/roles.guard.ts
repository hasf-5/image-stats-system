import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators';

/** 角色校验必须落在后端，前端路由守卫只负责体验 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('无访问权限');
    if (!roles.includes(user.role)) throw new ForbiddenException('无访问权限');
    return true;
  }
}
