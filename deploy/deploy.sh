#!/usr/bin/env bash
# 乐自由 · 首次部署 / 重新部署
# 用法：
#   bash deploy/deploy.sh --internal     # 内测（暴露 3000）
#   bash deploy/deploy.sh --production   # 正式（仅 127.0.0.1:3000）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE=""
for arg in "$@"; do
  case "$arg" in
    --internal) MODE="internal" ;;
    --production) MODE="production" ;;
  esac
done

if [ -z "$MODE" ]; then
  echo "用法: bash deploy/deploy.sh --internal | --production"
  exit 1
fi

if [ ! -f .env ]; then
  if [ "$MODE" = "internal" ]; then
    echo "缺少 .env，请先执行: cp .env.internal.example .env"
  else
    echo "缺少 .env，请先执行: cp .env.production.example .env"
  fi
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  echo "[deploy] 运行部署前预检..."
  if [ "$MODE" = "production" ]; then
    node scripts/deploy-preflight.mjs --production || exit 1
  else
    node scripts/deploy-preflight.mjs || exit 1
  fi
else
  echo "[deploy] 跳过预检（宿主机未安装 node，Docker 内会自动处理）"
fi

echo "[deploy] 构建并启动容器（模式: $MODE）..."
if [ "$MODE" = "internal" ]; then
  docker compose -f docker-compose.yml -f docker-compose.internal.yml up -d --build
else
  docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
fi

echo "[deploy] 等待应用就绪..."
sleep 5

if bash deploy/health-check.sh; then
  echo ""
  echo "[deploy] 部署成功 ✓"
  docker compose ps
else
  echo "[deploy] 健康检查未通过，请查看日志: docker compose logs -f app"
  exit 1
fi
