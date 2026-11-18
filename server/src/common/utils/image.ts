/**
 * 图片文件校验：MIME 头可伪造，落盘前必须校验「文件魔数」。
 * 只放行位图，显式拒绝 svg（可内嵌脚本）与 html/php 等可执行内容。
 */
export type ImageExt = 'jpg' | 'png' | 'webp' | 'gif';

export function detectImageType(buf: Buffer): ImageExt | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return 'png';
  // GIF: GIF87a / GIF89a
  if (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a')
    return 'gif';
  // WEBP: RIFF .... WEBP
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'webp';

  return null;
}

export const EXT_MIME: Record<ImageExt, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};
