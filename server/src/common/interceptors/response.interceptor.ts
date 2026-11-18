import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

/**
 * 统一返回结构 { code, msg, data }
 * 约定：code=0 表示成功；业务异常由 HttpExceptionFilter 输出非 0 code。
 * 文件流 / 已直接写响应（CSV 导出）不做包装。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<any> {
    const res = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => {
        if (res.headersSent) return data;
        if (data && typeof data === 'object' && 'code' in data && 'msg' in data) {
          return data;
        }
        return { code: 0, msg: 'ok', data: data ?? null } as ApiResponse<T>;
      }),
    );
  }
}
