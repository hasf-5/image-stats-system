/**
 * 存储抽象层。
 * 当前实现：本地磁盘 + Nginx 静态服务（/uploads）。
 * 切换对象存储（OSS/COS/S3）时，只需新增一个实现并在 StorageModule 中替换 provider，
 * 业务代码永远只依赖 StorageDriver 接口。
 */
export interface SavedFile {
  /** 对外可访问 URL，如 /uploads/2026/11/uuid.jpg */
  url: string;
  /** 存储侧唯一键，如 2026/11/uuid.jpg */
  key: string;
  size: number;
}

export interface StorageDriver {
  save(buffer: Buffer, ext: string): Promise<SavedFile>;
  remove(keyOrUrl: string): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
