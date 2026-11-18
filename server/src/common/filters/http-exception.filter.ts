import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 全局异常出口。对外只暴露安全信息：
 * - 4xx 使用异常自带 message
 * - 5xx 统一为「服务器繁忙」，细节仅落日志
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let msg = '服务器繁忙，请稍后再试';
    let code = 500;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status;
      const body = exception.getResponse() as any;
      if (typeof body === 'string') {
        msg = body;
      } else if (body && typeof body === 'object') {
        const m = body.message;
        msg = Array.isArray(m) ? m[0] : m || body.error || exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(`${req.method} ${req.url} - ${exception.message}`, exception.stack);
    }

    if (res.headersSent) return;
    res.status(status).json({ code, msg, data: null });
  }
}
