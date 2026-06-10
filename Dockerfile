# syntax=docker/dockerfile:1
# 乐自由平台 · 生产镜像（Next.js 全栈 + Prisma + PostgreSQL）
# 启用 BuildKit：DOCKER_BUILDKIT=1 docker compose build
FROM node:20-bookworm-slim AS base

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps

ENV DATABASE_URL="file:./build.db"
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts --prefer-offline --no-audit --no-fund
RUN npx prisma generate

FROM base AS builder

ARG NEXT_PUBLIC_DEMO_MODE=off
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY package.json package-lock.json .npmrc ./
COPY . .
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    npx prisma generate --schema=prisma/schema.production.prisma \
    && npx next build

FROM base AS runner

ENV NODE_ENV=production
EXPOSE 3000

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "prod:start"]
