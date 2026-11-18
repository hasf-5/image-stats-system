# 图片提交与统计管理系统

内部使用的图片提交与统计分析系统：普通用户手机/电脑上传图片并归类，管理员在后台管理账号、查看记录、按天/周/月查看统计。**不对外开放注册**，账号只能由管理员创建。

- 前端：Vue 3 + Vite + TypeScript + Tailwind CSS + Element Plus + ECharts + Pinia + Vue Router + Axios
- 后端：NestJS + TypeScript + Prisma + MySQL 8 + Redis
- 部署：Docker Compose + Nginx + HTTPS（Let's Encrypt）
- 一套 SPA 同时适配手机与 PC，断点 ≤768px 移动端 / >768px 桌面端 / ≥1025px 侧边栏展开

---

## 目录结构

```
image-stats-system/
├── server/                     # NestJS API
│   ├── prisma/schema.prisma    # 数据模型（MySQL 8）
│   ├── src/
│   │   ├── auth/               # 登录、刷新、登出、改密
│   │   ├── users/              # 管理员用户管理
│   │   ├── categories/         # 分类（用户端只读 + 管理端 CRUD）
│   │   ├── images/             # 上传、我的记录、作废/恢复
│   │   ├── stats/              # 统计聚合 + CSV 导出
│   │   ├── reports/            # 报表配置
│   │   ├── audit/              # 审计日志
│   │   ├── storage/            # 存储抽象（本地磁盘 → 可换对象存储）
│   │   ├── common/             # 守卫、拦截器、异常、时区/图片工具
│   │   └── seed.ts             # 初始化管理员/分类/演示数据
│   └── Dockerfile
├── web/                        # Vue 3 SPA
│   ├── src/
│   │   ├── components/         # ResponsiveTable / ResponsiveModal / ChartBox ...
│   │   ├── layouts/            # UserLayout / AdminLayout（双端导航）
│   │   ├── views/              # 登录、用户端、后台端
│   │   ├── api/                # axios 封装 + 各域接口
│   │   ├── router/             # 路由 + 体验层守卫
│   │   └── utils/              # 压缩、时区格式化、断点判断
│   ├── public/                 # manifest / sw.js / PWA 图标
│   └── Dockerfile
├── deploy/nginx/               # HTTPS 与首次签发（HTTP）两套模板
├── scripts/db-local.sh         # 无 Docker 时的便携 MariaDB 管理脚本
├── start-local.cmd             # Windows 双击一键预览（起库 + 前后端）
├── docker-compose.yml
├── docker-compose.http.yml     # 首次申请证书时叠加使用
└── .env.example
```

---

## 一、本地开发

### 0. 一键预览（推荐：本机没装 Docker / MySQL 时）

仓库里带了一套「便携数据库」方案：把 MariaDB 解压到用户目录跑在 **3307** 端口，
不写注册表、不装系统服务，删掉目录即彻底清理。

**Windows 用户直接双击根目录的 `start-local.cmd`**，它会依次完成：

1. 启动便携 MariaDB（首次自动解压 + 初始化 + 建库建账号 + 生成 `server/.env`）
2. 在独立窗口启动后端 API（:3000）与前端（:5173）
3. 自动打开浏览器 http://localhost:5173

也可以手动分步执行：

```bash
bash scripts/db-local.sh start    # 起库（首次会初始化，约 1 分钟）
bash scripts/db-local.sh status   # 查看状态
bash scripts/db-local.sh stop     # 停止

cd server && npx prisma db push && SEED_DEMO=true npm run seed && npm run start
cd web && npm run dev
```

默认账号（`SEED_DEMO=true` 会额外生成 60 天演示数据 + 3 个普通用户）：

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | admin | Admin@123456 |
| 普通用户 | zhangwei / lina / wangqiang | User@123456 |

手机访问同一 WiFi 下的 `http://本机IP:5173` 即可（Vite 已开启 `host: true`）。

> 便携库只用于本地预览：`scripts/db-local.sh` 里的 root 密码是明文的，
> 数据目录在 `~/.local/imgstats-db`，**不要**把它当作生产数据库使用。

### 1. 依赖

- Node.js ≥ 20
- MySQL 8（必须，字符集 utf8mb4，时区 UTC）
- Redis 7（登录失败计数 / token 黑名单，缺失会降级但**不建议**）

没有本地数据库时，可只用 Docker 起这两个中间件：

```bash
docker run -d --name imgstats-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=imgstats \
  -e MYSQL_USER=imgstats -e MYSQL_PASSWORD=imgstats_pwd \
  mysql:8.0 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci --default-time-zone=+00:00

docker run -d --name imgstats-redis -p 6379:6379 redis:7-alpine
```

### 2. 后端

```bash
cd server
cp .env.example .env          # 按需修改 DATABASE_URL / REDIS_URL
npm install
npx prisma generate
npx prisma db push            # 建表
npm run seed                  # 管理员 admin / Admin@123456 + 4 个基础分类
npm run start:dev             # http://localhost:3000/api
```

想看统计图表效果，可生成 30 天演示数据（含真实图片文件与作废记录）：

```bash
# macOS / Linux
SEED_DEMO=true npm run seed
# Windows PowerShell
$env:SEED_DEMO="true"; npm run seed
```

### 3. 前端

```bash
cd web
npm install
npm run dev                   # http://localhost:5173
```

Vite 已把 `/api` 与 `/uploads` 代理到 `127.0.0.1:3000`，无需额外配置 CORS。

默认账号：

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | `admin` | `Admin@123456` |
| 普通用户（仅 SEED_DEMO） | `zhangwei` / `lina` / `wangqiang` | `User@123456` |

> 首次登录后请立刻在右上角菜单修改密码。

---

## 二、生产部署（Docker Compose + HTTPS）

### 1. 准备

```bash
git clone <repo> && cd image-stats-system
cp .env.example .env
```

编辑 `.env`，至少修改：`DOMAIN`、`MYSQL_ROOT_PASSWORD`、`MYSQL_PASSWORD`、`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`CORS_ORIGIN`。

```bash
# 生成强随机密钥
openssl rand -hex 48
```

> `MYSQL_PASSWORD` 请使用 URL 安全字符（字母/数字/`-`/`_`），否则需要 URL 编码，因为会拼进 `DATABASE_URL`。
> 域名 A 记录需先指向服务器公网 IP，且 80/443 未被占用。

### 2. 首次申请证书（HTTP 模式）

```bash
# 先用 80 端口 + HTTP 配置起服务
docker compose -f docker-compose.yml -f docker-compose.http.yml up -d --build

# 申请证书（替换邮箱与域名）
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d your-domain.com --email you@example.com --agree-tos --no-eff-email
```

### 3. 切换到 HTTPS 并初始化数据

```bash
docker compose up -d          # 挂载 HTTPS 模板，80 自动跳 443

# 建管理员 + 分类（首次执行一次）
docker compose run --rm -e RUN_SEED=true server
```

访问 `https://your-domain.com`，用 `.env` 中的 `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` 登录。

### 4. 证书续期

Let's Encrypt 证书 90 天有效，建议加一条 cron：

```cron
0 3 * * 1 cd /opt/image-stats-system && docker compose run --rm certbot renew --quiet && docker compose exec web nginx -s reload
```

### 5. 常用运维

```bash
docker compose logs -f server        # API 日志
docker compose ps                    # 服务状态
docker compose restart server        # 重启 API
docker compose exec mysql mysqldump -uimgstats -p imgstats > backup.sql   # 备份
docker compose down                  # 停止（保留 volume）
```

数据卷：`mysql_data`（数据库）、`uploads`（图片，命名卷）、`certs`（证书）。**删除 volume 等于删数据**，升级前先备份。

---

## 三、分阶段验收

| 阶段 | 交付内容 | 验收点 |
| --- | --- | --- |
| 1 | 项目骨架、登录页双端、认证接口、路由守卫 | PC 左右分栏 / 移动端单列；密码眼睛切换；忘记密码只弹提示；连续 5 次错误锁定 10 分钟且提示统一为“账号或密码错误”；admin 跳 `/admin/dashboard`，user 跳 `/user/upload`；未登录访问后台被重定向 |
| 2 | 后台用户管理 | 新建账号（密码强度校验）、重置密码（随机密码仅显示一次）、禁用/启用、删除；有记录的用户只允许禁用；不能删除/禁用自己；系统至少保留一个启用管理员 |
| 3 | 用户端上传 | 移动端「拍照 / 相册」两个大按钮（`capture="environment"` 直调后置摄像头）；PC 拖拽上传；`canvas` 压缩长边 1920、质量 0.8；上传进度与失败重试；提交按钮移动端吸底 48px |
| 4 | 我的记录 + 后台记录管理 | 移动端卡片 / PC 表格同一接口切换；作废（本人仅当天）/ 恢复（管理员）；作废后在统计中立即消失；移动端操作收进「更多⋯」菜单 |
| 5 | 统计接口 + 看板 | 趋势折线（多分类多线）、分类占比环形、周期对比柱状；无数据的时间桶补 0 不断线；移动端图表纵向堆叠、筛选进底部抽屉；CSV 导出 |
| 6 | 报表配置 + 部署 + PWA | 保存「粒度 + 分组 + 区间」配置并在看板打开；HTTPS；`manifest` 可添加到主屏幕；路由懒加载按端拆包 |

---

## 四、API 一览

统一返回 `{ code, msg, data }`，`code=0` 为成功。除登录/刷新外均需 `Authorization: Bearer <accessToken>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 账号密码登录，返回双 token + 用户信息 |
| POST | `/api/auth/refresh` | 刷新 accessToken（旧 refresh 立即失效） |
| POST | `/api/auth/logout` | 登出，token 加入黑名单 |
| POST | `/api/auth/change-pwd` | 修改密码（改后当前 token 失效） |
| GET | `/api/auth/me` | 当前用户 |
| GET | `/api/categories` | 启用中的分类（用户端） |
| POST | `/api/images` | multipart 多图上传，字段 `files[]`、`categoryId`、`remark`、`clientType` |
| GET | `/api/images/mine` | 我的记录（分页 + 分类/状态/时间） |
| POST | `/api/images/:id/void` | 本人作废（仅当天） |
| GET | `/api/admin/users` | 用户列表（keyword/role/status） |
| POST/PUT | `/api/admin/users`、`/api/admin/users/:id` | 建号 / 编辑（昵称、角色、状态） |
| POST | `/api/admin/users/:id/reset-pwd` | 重置密码，不传则生成随机密码 |
| DELETE | `/api/admin/users/:id` | 删除（有记录则拒绝） |
| GET | `/api/admin/images` | 记录管理（分类/用户/状态/时间/备注） |
| POST | `/api/admin/images/:id/void` | 管理员作废 |
| POST | `/api/admin/images/:id/restore` | 恢复作废 |
| GET/POST/PUT/DELETE | `/api/admin/categories` | 分类增删改查（删除受记录数约束） |
| GET | `/api/admin/stats` | `?granularity=day\|week\|month&group_by=category\|user&from=&to=` |
| GET | `/api/admin/stats/export` | 同参数，导出 CSV（带 BOM） |
| GET/POST/PUT/DELETE | `/api/admin/reports` | 报表配置 |
| GET | `/api/admin/audit-logs` | 审计日志 |

---

## 五、关键设计决策

**1. 统计的时区与补零**
数据库统一存 UTC（`submit_time` 为 `DATETIME`），分桶时用
`CONVERT_TZ(submit_time,'+00:00','+08:00')` 转成上海时间再 `DATE_FORMAT` / `YEARWEEK(...,1)`。
后端 `buildBuckets()` 生成完整的日/周/月序列并按 key 补 0，保证折线不断点；前端展示统一用 `dayjs.tz(...,'Asia/Shanghai')`，用户设备时区不同也不会错位。

**2. 一套组件适配双端**
- `ResponsiveTable`：`columns` 只定义一次，PC 渲染 `el-table`，手机渲染卡片列表，操作收进「更多⋯」菜单；`mobileHide` / `primary` / `fullWidth` 控制移动端呈现。
- `ResponsiveModal`：动态切换 `el-dialog`（居中 520px）与 `el-drawer`（底部抽屉，最大 85vh），表单内容只渲染一份。
- `ChartBox`：`ResizeObserver` 监听容器宽度，侧边栏收展、横竖屏切换都会 `chart.resize()`。

**3. 认证与安全**
- `accessToken` 15 分钟、`refreshToken` 7 天；两者都带 `jti`，登出/改密/刷新轮换时把旧 `jti` 写入 Redis 黑名单（TTL = 剩余有效期）。
- 登录失败计数在 Redis：5 次锁定 10 分钟；账号不存在也执行一次 `bcrypt.compare`，避免通过响应耗时枚举账号；失败文案统一为「账号或密码错误」。
- 权限在 `JwtAuthGuard` + `RolesGuard`（全局守卫）校验，每次请求回查用户状态，禁用立即生效；前端路由守卫只负责跳转体验。
- 密码使用 `bcryptjs`（纯 JS，免去 Alpine 下 node-gyp 编译），哈希格式与 `bcrypt` 完全兼容。

**4. 上传安全三道闸**
① multer `fileFilter` 校验 MIME；② 落盘前校验**文件魔数**（JPEG/PNG/GIF/WebP），显式拒绝 SVG；③ UUID 重命名 + 年/月目录。Nginx 再对 `/uploads/` 禁止脚本类扩展名。前后端都限制单张 20MB、单次 9 张。

**5. 存储可替换**
业务只依赖 `StorageDriver` 接口（`save` / `remove`）。切对象存储时新增一个实现并在 `StorageModule` 替换 provider 即可，URL 由 `UPLOAD_PUBLIC_PREFIX` 控制。

**6. 报表不做接口爆炸**
看板三图全部由 `/api/admin/stats` 的参数组合驱动（`granularity` + `group_by` + 区间），`report_config` 只保存参数组合，切换报表就是换 query。

**7. 为什么没有 migration 文件**
首次部署用 `prisma db push` 建表（容器入口默认执行，可用 `RUN_DB_PUSH=false` 关闭）。若团队进入长期迭代，建议改为 `prisma migrate dev` 生成迁移文件、生产用 `prisma migrate deploy`，避免 schema 漂移。

**8. Redis 软失败**
Redis 不可用时只告警不阻断启动（便于本地无 Redis 调试），但登录锁定与 token 黑名单会失效——生产必须保证 Redis 可用。

---

## 六、PWA

`public/manifest.webmanifest` + `public/sw.js`（app shell 缓存，接口与图片不缓存，避免看到旧数据）。iOS Safari 通过「分享 → 添加到主屏幕」安装；摄像头调用要求 HTTPS（`localhost` 例外）。

---

## 七、常见问题

**Q：登录提示「登录已失效」但刚登录？**
检查服务器时间是否准确、`JWT_ACCESS_SECRET` 是否在重启后变化（未固定会导致旧 token 全部失效）。

**Q：统计图和记录数对不上？**
统计只计算 `status='normal'`；`void` 记录不计入。看板默认区间为最近 30 天，与「今日」卡片口径不同。

**Q：上传 413？**
Nginx `client_max_body_size` 与后端 `MAX_UPLOAD_SIZE_MB` 需一致（默认 20m）。

**Q：中文 CSV 在 Excel 乱码？**
导出已加 UTF-8 BOM，若仍乱码请用「数据 → 从文本导入」并选择 UTF-8。

**Q：忘记管理员密码？**
用另一个管理员在后台重置。若只剩一个管理员且密码丢失，可在服务器上直接改哈希：

```bash
docker compose exec server node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
p.user.update({ where: { username: 'admin' }, data: { passwordHash: bcrypt.hashSync('NewPass123', 10) } })
 .then(() => { console.log('password reset ok'); process.exit(0); });
"
```

改完用新密码登录，并立刻在页面内再次修改。
