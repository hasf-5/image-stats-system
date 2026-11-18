import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api');
  // 生产部署在 Nginx 之后，需要信任代理才能拿到真实 IP 与协议
  app.set('trust proxy', 1);

  // 基础安全响应头（HTTPS 由 Nginx/Let's Encrypt 提供）
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: true,
    }),
  );

  // 开发环境可直接通过后端访问图片；生产由 Nginx 托管 /uploads
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  app.useStaticAssets(uploadDir, {
    prefix: (process.env.UPLOAD_PUBLIC_PREFIX || '/uploads').replace(/\/+$/, '') + '/',
    maxAge: '7d',
    index: false,
  });

  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API ready on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
