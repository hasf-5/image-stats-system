/**
 * 上传前压缩：长边 1920、质量 0.8，显著降低移动网络下的失败率与流量。
 * - 使用 createImageBitmap({imageOrientation:'from-image'}) 修正 iOS EXIF 方向
 * - GIF 不压缩（保留动画），压缩后反而变大时保留原图
 * - 任何异常都回退原图，绝不阻断上传
 */
const MAX_EDGE = 1920;
const QUALITY = 0.8;

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' } as any).catch(() => loadViaImage(file));
  }
  return loadViaImage(file);
}

function loadViaImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片解码失败'));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File, maxEdge = MAX_EDGE, quality = QUALITY): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  try {
    const bmp = await loadBitmap(file);
    const width = (bmp as any).width as number;
    const height = (bmp as any).height as number;
    if (!width || !height) return file;

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    // 已经足够小且是 jpeg，直接返回，避免二次有损
    if (scale === 1 && file.type === 'image/jpeg' && file.size < 400 * 1024) return file;

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // JPEG 无透明通道，先铺白底，避免 PNG 透明区变黑
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp as any, 0, 0, targetW, targetH);
    if ('close' in bmp) (bmp as ImageBitmap).close();

    const blob = await toBlob(canvas, 'image/jpeg', quality);
    if (!blob) return file;
    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function isMobileViewport(): boolean {
  return window.matchMedia('(max-width: 768px)').matches;
}
