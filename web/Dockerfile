# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:only

# ---- runtime ----
FROM nginx:1.27-alpine
# 静态资源由 Nginx 直接服务；配置通过 /etc/nginx/templates 注入（支持环境变量）
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80 443
