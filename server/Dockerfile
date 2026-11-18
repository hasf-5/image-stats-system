# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app

# prisma 需要 openssl
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

# 非 root 运行；上传目录需可写（named volume 首次创建会继承该目录属主）
RUN mkdir -p /app/uploads && chmod +x /app/docker-entrypoint.sh && chown -R node:node /app
USER node

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/app/docker-entrypoint.sh"]
