# 乐自由平台 · 生产镜像（Next.js 全栈 + Prisma + PostgreSQL）
# 单镜像内保留完整依赖（含 prisma CLI / tsx），便于在容器内执行迁移与种子。
FROM node:20-bookworm-slim

# Prisma 查询引擎依赖 openssl
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# 安装期占位串：满足 postinstall 阶段默认 schema(SQLite) 的 prisma generate
ENV DATABASE_URL="file:./build.db"

# 内测默认开启演示身份切换器；正式环境构建时传 NEXT_PUBLIC_DEMO_MODE=off
ARG NEXT_PUBLIC_DEMO_MODE=on
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE

# 1) 安装依赖（postinstall 会按默认 schema 生成 Prisma Client，需先有 prisma 目录）
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# 2) 复制源码，按「生产 schema(PostgreSQL)」重新生成 Client 并构建
COPY . .
# 构建期占位连接串（页面均为 force-dynamic，不会在构建时访问数据库；运行时由 compose 覆盖）
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npm run prod:build

ENV NODE_ENV=production
EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "prod:start"]
