import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { SavedFile, StorageDriver } from './storage.interface';

/**
 * 本地磁盘实现
 * - 目录：{UPLOAD_DIR}/{yyyy}/{mm}/{uuid}.{ext}
 * - 文件名使用 UUID，彻底避免原始文件名带来的路径穿越 / webshell 风险
 * - 日期分目录避免单目录文件过多影响 Nginx 性能
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly logger = new Logger('Storage');
  private readonly root: string;
  private readonly prefix: string;

  constructor() {
    this.root = path.resolve(process.env.UPLOAD_DIR || './uploads');
    this.prefix = (process.env.UPLOAD_PUBLIC_PREFIX || '/uploads').replace(/\/+$/, '');
  }

  async save(buffer: Buffer, ext: string): Promise<SavedFile> {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const key = `${yyyy}/${mm}/${randomUUID()}.${ext}`;
    const abs = path.join(this.root, key);

    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buffer, { mode: 0o644 });

    return { key, url: `${this.prefix}/${key}`, size: buffer.length };
  }

  async remove(keyOrUrl: string): Promise<void> {
    const rel = keyOrUrl.startsWith(this.prefix)
      ? keyOrUrl.slice(this.prefix.length)
      : keyOrUrl;
    // 归一化后再校验，防御 ../../ 穿越
    const abs = path.resolve(this.root, '.' + (rel.startsWith('/') ? rel : '/' + rel));
    if (!abs.startsWith(this.root)) {
      this.logger.warn(`拒绝删除越界路径: ${keyOrUrl}`);
      return;
    }
    try {
      await fs.unlink(abs);
    } catch (e: any) {
      if (e.code !== 'ENOENT') this.logger.warn(`删除文件失败 ${abs}: ${e.message}`);
    }
  }
}
