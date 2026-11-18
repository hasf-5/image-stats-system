#!/bin/sh
set -e

# 生产容器入口：
# 1) 可选执行 prisma db push（首次部署建表用；之后可设 RUN_DB_PUSH=false）
# 2) 启动 NestJS
if [ "${RUN_DB_PUSH:-true}" = "true" ]; then
  echo "==> 同步数据库结构 (prisma db push)"
  npx prisma db push --skip-generate
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "==> 初始化管理员与分类"
  node dist/seed.js
fi

echo "==> 启动 API 服务"
exec node dist/main.js
