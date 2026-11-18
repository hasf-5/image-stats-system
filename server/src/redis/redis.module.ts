import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 只承担三件事：
 *  1. 登录失败计数 / 锁定
 *  2. access & refresh token 黑名单
 *  3. （可选）热点缓存
 * 所有方法在 Redis 不可用时「软失败」，不阻断主流程，
 * 生产环境请保证 Redis 高可用，否则锁定策略会失效。
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Redis');
  private client: Redis;
  private warned = false;

  onModuleInit() {
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0';
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 1000, 10000),
    });
    this.client.on('error', (e) => {
      if (!this.warned) {
        this.warned = true;
        this.logger.warn(`Redis unavailable (${e.message}); 降级运行，登录锁定与 token 黑名单将失效`);
      }
    });
    this.client.on('ready', () => {
      this.warned = false;
      this.logger.log('Redis connected');
    });
    this.client.connect().catch(() => void 0);
  }

  async onModuleDestroy() {
    try {
      await this.client?.quit();
    } catch {
      /* ignore */
    }
  }

  get raw(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', Math.max(1, Math.floor(seconds)));
    } catch {
      /* ignore */
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      await this.client.del(...keys);
    } catch {
      /* ignore */
    }
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    try {
      const n = await this.client.incr(key);
      if (n === 1) await this.client.expire(key, ttlSeconds);
      return n;
    } catch {
      return 0;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch {
      return -1;
    }
  }

  /** 值存在即视为黑名单命中 */
  async isBlacklisted(jti: string, typ: 'access' | 'refresh'): Promise<boolean> {
    const v = await this.get(`bl:${typ}:${jti}`);
    return v === '1';
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
