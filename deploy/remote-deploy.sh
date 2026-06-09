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

COMPOSE_FILES="-f docker-compose.yml -f docker-compose.production.yml"
if grep -q "^COOKIE_SECURE=false" .env 2>/dev/null; then
  COMPOSE_FILES="-f docker-compose.yml -f docker-compose.internal.yml"
  echo "[remote-deploy] 内测模式（3000 对外）"
else
  echo "[remote-deploy] 正式模式（127.0.0.1:3000）"
fi

echo "[remote-deploy] 构建并启动..."
docker compose $COMPOSE_FILES up -d --build

echo "[remote-deploy] 同步数据库结构..."
docker compose exec -T app npm run prod:db:push

echo "[remote-deploy] 完成 ✓"
docker compose ps
