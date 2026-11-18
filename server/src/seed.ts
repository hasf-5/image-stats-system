/**
 * 初始化脚本：默认管理员 + 基础分类 (+ 可选演示数据)
 * 用法：
 *   npm run seed            # 只建管理员与分类
 *   SEED_DEMO=true npm run seed   # 额外生成 30 天演示记录，便于验收看板
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const prisma = new PrismaClient();

/* ---------------- 极简 PNG 生成器（仅用于演示数据） ---------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(w: number, h: number, base: [number, number, number]): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const shade = 0.78 + 0.22 * Math.sin((x / w) * Math.PI) * Math.cos((y / h) * Math.PI);
      const stripe = (Math.floor((x + y) / 24) % 2 === 0 ? 1 : 0.93);
      const i = row + 1 + x * 3;
      raw[i] = Math.min(255, Math.round(base[0] * shade * stripe));
      raw[i + 1] = Math.min(255, Math.round(base[1] * shade * stripe));
      raw[i + 2] = Math.min(255, Math.round(base[2] * shade * stripe));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function main() {
  const adminName = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPwd = process.env.SEED_ADMIN_PASSWORD || 'Admin@123456';

  const admin = await prisma.user.upsert({
    where: { username: adminName },
    update: {},
    create: {
      username: adminName,
      passwordHash: await bcrypt.hash(adminPwd, 10),
      nickname: '系统管理员',
      role: 'admin',
      status: 'active',
      mustChangePwd: false,
    },
  });
  console.log(`✓ 管理员 ${adminName} / ${adminPwd}`);

  const categoryNames = ['产品图片', '现场记录', '票据凭证', '其他'];
  const categories = [];
  for (let i = 0; i < categoryNames.length; i++) {
    categories.push(
      await prisma.category.upsert({
        where: { name: categoryNames[i] },
        update: {},
        create: { name: categoryNames[i], sort: i },
      }),
    );
  }
  console.log(`✓ 分类 ${categories.length} 个`);

  if (process.env.SEED_DEMO === 'true') {
    const demoUsers = [
      { username: 'zhangwei', nickname: '张伟' },
      { username: 'lina', nickname: '李娜' },
      { username: 'wangqiang', nickname: '王强' },
    ];
    const users = [];
    for (const u of demoUsers) {
      users.push(
        await prisma.user.upsert({
          where: { username: u.username },
          update: {},
          create: {
            username: u.username,
            passwordHash: await bcrypt.hash('User@123456', 10),
            nickname: u.nickname,
            role: 'user',
            status: 'active',
            createdBy: admin.id,
          },
        }),
      );
    }
    console.log(`✓ 演示用户 ${users.length} 个，密码 User@123456`);

    const existing = await prisma.imageRecord.count();
    if (existing > 0) {
      console.log(`! 已有 ${existing} 条记录，跳过演示数据生成`);
    } else {
      const uploadRoot = path.resolve(process.env.UPLOAD_DIR || './uploads');
      const dir = path.join(uploadRoot, 'seed');
      await fs.mkdir(dir, { recursive: true });

      const palette: [number, number, number][] = [
        [59, 130, 246],
        [16, 185, 129],
        [245, 158, 11],
        [239, 68, 68],
        [139, 92, 246],
        [14, 165, 233],
      ];
      const files: string[] = [];
      for (let i = 0; i < 6; i++) {
        const buf = makePng(320, 240, palette[i]);
        const name = `seed/sample-${i + 1}.png`;
        await fs.writeFile(path.join(uploadRoot, name), buf);
        files.push(name);
      }

      const rows: any[] = [];
      const now = new Date();
      for (let d = 29; d >= 0; d--) {
        const day = new Date(now.getTime() - d * 86400_000);
        const dow = day.getDay();
        const base = dow === 0 || dow === 6 ? 1 : 3;
        const count = base + Math.floor(Math.random() * 4);
        for (let k = 0; k < count; k++) {
          const u = users[Math.floor(Math.random() * users.length)];
          const c = categories[Math.floor(Math.random() * categories.length)];
          const file = files[Math.floor(Math.random() * files.length)];
          const ts = new Date(day);
          ts.setHours(8 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60), 0, 0);
          const isVoid = Math.random() < 0.08;
          rows.push({
            userId: u.id,
            categoryId: c.id,
            fileUrl: `/uploads/${file}`,
            fileSize: 4096 + Math.floor(Math.random() * 20000),
            fileHash: createHash('sha256').update(`${file}-${ts.getTime()}`).digest('hex'),
            remark: Math.random() < 0.35 ? '演示数据' : null,
            status: isVoid ? 'void' : 'normal',
            submitTime: ts,
            clientType: Math.random() < 0.6 ? 'mobile' : 'pc',
            voidBy: isVoid ? admin.id : null,
            voidTime: isVoid ? new Date(ts.getTime() + 3600_000) : null,
            voidReason: isVoid ? '演示：重复上传' : null,
          });
        }
      }
      await prisma.imageRecord.createMany({ data: rows });
      console.log(`✓ 演示记录 ${rows.length} 条`);
    }
  }

  console.log('\n初始化完成。登录后请立即修改默认密码。');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
