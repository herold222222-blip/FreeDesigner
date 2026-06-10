#!/usr/bin/env bash
# ECS 一键强制同步：拉最新代码 → 无缓存重建 → 验证环境变量
# 用法：cd /opt/lezyou && bash deploy/force-sync-ecs.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG="${DEPLOY_LOG:-/var/log/lezyou-gitee-deploy.log}"
BRANCH="${DEPLOY_BRANCH:-main}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [force-sync] $*" | tee -a "$LOG"; }

if [ ! -f .env ]; then
  log "ERROR: 缺少 .env"
  exit 1
fi

log "开始强制同步 branch=$BRANCH"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
log "当前代码: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

chmod +x deploy/*.sh scripts/cron-order-timeouts.sh 2>/dev/null || true

# shellcheck source=deploy/resolve-demo-env.sh
source "$ROOT/deploy/resolve-demo-env.sh"
resolve_demo_env

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

COMPOSE_FILES=(-f docker-compose.yml)
if grep -q "^COOKIE_SECURE=false" .env 2>/dev/null; then
  COMPOSE_FILES+=(-f docker-compose.internal.yml)
  log "内测模式（3000 对外）"
else
  COMPOSE_FILES+=(-f docker-compose.production.yml)
  log "正式模式"
fi
if grep -q "^EXPOSE_DB_PUBLIC=true" .env 2>/dev/null; then
  COMPOSE_FILES+=(-f docker-compose.shared-db.yml)
fi

log "无缓存重建镜像（确保前端 NEXT_PUBLIC_DEMO_MODE 写入新包）..."
docker compose "${COMPOSE_FILES[@]}" build --no-cache

log "启动容器..."
docker compose "${COMPOSE_FILES[@]}" up -d

log "同步数据库结构..."
docker compose "${COMPOSE_FILES[@]}" exec -T app npm run prod:db:push

log "验证运行时环境变量..."
docker compose "${COMPOSE_FILES[@]}" exec -T app node -e "
  console.log('DEMO_CODE_ENABLED=' + (process.env.DEMO_CODE_ENABLED || ''));
  console.log('DEMO_VERIFICATION_CODE=' + (process.env.DEMO_VERIFICATION_CODE || ''));
"

bash deploy/health-check.sh

log "强制同步完成 ✓ 请硬刷新浏览器（Ctrl+Shift+R）"
