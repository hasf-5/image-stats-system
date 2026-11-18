/**
 * 生成 PWA 图标（无第三方依赖，纯 Node 手写 PNG）。
 * 用法：node scripts/gen-icons.mjs
 * 产物：public/icons/icon-192.png、icon-512.png、apple-touch-icon.png
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/icons');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 3;
      raw[i] = rgb[y * width * 3 + x * 3];
      raw[i + 1] = rgb[y * width * 3 + x * 3 + 1];
      raw[i + 2] = rgb[y * width * 3 + x * 3 + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function render(size) {
  const buf = Buffer.alloc(size * size * 3);
  const u = 1 / size; // 归一化单位

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) * u;
      const py = (y + 0.5) * u;

      // 背景：对角渐变 + 轻微径向高光
      const t = clamp((px + py) / 2, 0, 1);
      let r = mix(69, 30, t);
      let g = mix(96, 58, t);
      let b = mix(240, 190, t);
      const glow = clamp(1 - Math.hypot(px - 0.22, py - 0.2) / 0.62, 0, 1) ** 2 * 0.32;
      r = mix(r, 150, glow);
      g = mix(g, 185, glow);
      b = mix(b, 255, glow);

      // 相机机身（描边圆角矩形）
      const bodyD = sdRoundRect(px, py, 0.5, 0.55, 0.258, 0.176, 0.062);
      const stroke = Math.abs(bodyD) - 0.024;
      const bodyA = clamp(0.5 - stroke / u, 0, 1);
      // 顶部取景器
      const humpD = sdRoundRect(px, py, 0.5, 0.352, 0.072, 0.048, 0.024);
      const humpA = clamp(0.5 - (humpD - 0.02) / u, 0, 1);
      // 镜头
      const lensD = Math.abs(sdCircle(px, py, 0.5, 0.566, 0.076)) - 0.02;
      const lensA = clamp(0.5 - lensD / u, 0, 1);
      // 闪光点
      const dotD = Math.abs(sdCircle(px, py, 0.688, 0.435, 0.017)) - 0.012;
      const dotA = clamp(0.5 - dotD / u, 0, 1);

      const a = Math.max(bodyA, humpA, lensA, dotA);
      r = mix(r, 255, a);
      g = mix(g, 255, a);
      b = mix(b, 255, a);

      const i = (y * size + x) * 3;
      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
    }
  }
  return png(size, size, buf);
}

mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  const file = resolve(OUT, `icon-${size}.png`);
  writeFileSync(file, render(size));
  console.log('✓', file);
}
writeFileSync(resolve(OUT, 'apple-touch-icon.png'), render(180));
console.log('✓ apple-touch-icon.png');
