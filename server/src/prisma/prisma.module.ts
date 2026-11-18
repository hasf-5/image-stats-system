import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  constructor() {
    super({ log: ['warn', 'error'] });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('MySQL connected');
    } catch (e: any) {
      // 不直接退出进程：便于本地先看前端/接口 500 的具体原因
      this.logger.error(`MySQL connect failed: ${e.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
