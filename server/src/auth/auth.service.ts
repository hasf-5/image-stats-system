import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { JwtUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.module';
import { RedisService } from '../redis/redis.module';
import { AuditService } from '../audit/audit.service';
import { ChangePwdDto, LoginDto } from './dto/auth.dto';

/** 账号不存在时也执行一次 bcrypt.compare，避免通过响应耗时枚举账号 */
const DUMMY_HASH = '$2a$10$mHMNSwzB4EvLHfjUPz1T/OI5zeCwce2gjTjV3YobjjGuc8twrNQ6q';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me';
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';
  private readonly accessTtl = process.env.JWT_ACCESS_TTL || '15m';
  private readonly refreshTtl = process.env.JWT_REFRESH_TTL || '7d';
  private readonly maxFail = parseInt(process.env.LOGIN_MAX_FAIL || '5', 10);
  private readonly lockSeconds = parseInt(process.env.LOGIN_LOCK_SECONDS || '600', 10);
  private readonly accessSeconds = 15 * 60;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  /** 对外统一的用户信息，绝不包含 passwordHash */
  private profile(u: User) {
    return {
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      role: u.role,
      mustChangePwd: u.mustChangePwd,
    };
  }

  private async issue(user: User): Promise<AuthTokens> {
    const base = {
      sub: user.id,
      username: user.username,
      role: user.role,
      nickname: user.nickname,
    };
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { ...base, typ: 'access', jti: accessJti },
        { secret: this.accessSecret, expiresIn: this.accessTtl as any },
      ),
      this.jwt.signAsync(
        { ...base, typ: 'refresh', jti: refreshJti },
        { secret: this.refreshSecret, expiresIn: this.refreshTtl as any },
      ),
    ]);
    return { accessToken, refreshToken, expiresIn: this.accessSeconds };
  }

  async login(dto: LoginDto, ip: string) {
    const username = dto.username.trim();
    const lockKey = `login:lock:${username}`;
    const failKey = `login:fail:${username}`;

    if (await this.redis.get(lockKey)) {
      throw new HttpException(
        `登录失败次数过多，请 ${Math.ceil(this.lockSeconds / 60)} 分钟后再试`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { username } });
    const matched = await bcrypt.compare(dto.password, user?.passwordHash || DUMMY_HASH);

    if (!user || !matched) {
      const n = await this.redis.incrWithTtl(failKey, this.lockSeconds);
      const locked = n >= this.maxFail;
      if (locked) {
        await this.redis.setex(lockKey, this.lockSeconds, '1');
        await this.redis.del(failKey);
      }
      await this.audit.log(user?.id ?? null, 'login_failed', username, ip);
      if (locked) {
        throw new HttpException(
          `登录失败次数过多，请 ${Math.ceil(this.lockSeconds / 60)} 分钟后再试`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      // 不区分「账号不存在」与「密码错误」
      throw new UnauthorizedException('账号或密码错误');
    }

    // 先验密码再判禁用，避免账号枚举
    if (user.status === 'disabled') {
      throw new ForbiddenException('账号已被禁用，请联系管理员');
    }

    await this.redis.del(failKey);
    const tokens = await this.issue(user);
    await this.audit.log(user.id, 'login', null, ip);
    return { ...tokens, user: this.profile(user) };
  }

  async refresh(refreshToken: string) {
    let payload: JwtUser;
    try {
      payload = await this.jwt.verifyAsync<JwtUser>(refreshToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('登录已失效，请重新登录');
    if (await this.redis.isBlacklisted(payload.jti, 'refresh')) {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('登录已失效，请重新登录');
    if (user.status === 'disabled') throw new UnauthorizedException('账号已被禁用，请联系管理员');

    // 轮换：旧 refresh 立即失效
    await this.blacklist(payload);
    return this.issue(user);
  }

  async logout(user: JwtUser, refreshToken?: string, ip = '') {
    await this.blacklist(user);
    if (refreshToken) {
      try {
        const p = await this.jwt.verifyAsync<JwtUser>(refreshToken, { secret: this.refreshSecret });
        await this.blacklist(p);
      } catch {
        /* 已过期/非法则无需处理 */
      }
    }
    await this.audit.log(user.id, 'logout', null, ip);
    return { success: true };
  }

  /** 把 token 的 jti 写入黑名单，TTL 取 token 剩余有效期 */
  private async blacklist(payload: JwtUser) {
    if (!payload?.jti) return;
    const ttl = Math.max(1, (payload.exp || 0) - Math.floor(Date.now() / 1000));
    await this.redis.setex(`bl:${payload.typ}:${payload.jti}`, ttl, '1');
  }

  async changePwd(user: JwtUser, dto: ChangePwdDto) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new UnauthorizedException('登录已失效，请重新登录');

    const ok = await bcrypt.compare(dto.oldPassword, dbUser.passwordHash);
    if (!ok) throw new HttpException('原密码不正确', HttpStatus.BAD_REQUEST);

    const same = await bcrypt.compare(dto.newPassword, dbUser.passwordHash);
    if (same) throw new HttpException('新密码不能与原密码相同', HttpStatus.BAD_REQUEST);

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePwd: false },
    });
    // 改密后当前 access 立即失效，强制重新登录
    await this.blacklist(user);
    await this.audit.log(user.id, 'change_pwd', null, '');
    return { success: true };
  }

  async me(user: JwtUser) {
    const u = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!u) throw new UnauthorizedException('登录已失效，请重新登录');
    return this.profile(u);
  }
}
