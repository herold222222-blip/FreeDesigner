#!/usr/bin/env bash
# 服务器端部署（GitHub Actions / 手动上传后调用）
# 保留 .env 与 pgdata 卷，重新构建并启动
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "[remote-deploy] 缺少 .env，请先配置环境变量"
  exit 1
fi

# BuildKit：npm / .next 层缓存，显著缩短 ECS 二次构建时间
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

COMPOSE_FILES=(-f docker-compose.yml)
if grep -q "^COOKIE_SECURE=false" .env 2>/dev/null; then
  COMPOSE_FILES+=(-f docker-compose.internal.yml)
  echo "[remote-deploy] 内测模式（3000 对外）"
else
  COMPOSE_FILES+=(-f docker-compose.production.yml)
  echo "[remote-deploy] 正式模式（127.0.0.1:3000）"
fi
if grep -q "^EXPOSE_DB_PUBLIC=true" .env 2>/dev/null; then
  COMPOSE_FILES+=(-f docker-compose.shared-db.yml)
  echo "[remote-deploy] 5432 公网映射已启用（本地 / 图形工具直连）"
fi

echo "[remote-deploy] 构建镜像..."
docker compose "${COMPOSE_FILES[@]}" build

echo "[remote-deploy] 启动容器（数据库迁移由 entrypoint 执行）..."
docker compose "${COMPOSE_FILES[@]}" up -d

echo "[remote-deploy] 同步数据库结构..."
docker compose "${COMPOSE_FILES[@]}" exec -T app npm run prod:db:push

echo "[remote-deploy] 完成 ✓"
docker compose "${COMPOSE_FILES[@]}" ps
