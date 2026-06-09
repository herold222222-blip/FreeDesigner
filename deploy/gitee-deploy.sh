#!/usr/bin/env bash
# Gitee push 后拉取最新代码并部署
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANCH="${DEPLOY_BRANCH:-main}"
LOG="${DEPLOY_LOG:-/var/log/lezyou-gitee-deploy.log}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

if [ ! -f .env ]; then
  log "ERROR: 缺少 .env"
  exit 1
fi

if [ ! -d .git ]; then
  log "ERROR: 不是 git 仓库，请先 git clone"
  exit 1
fi

log "开始部署 branch=$BRANCH"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

chmod +x deploy/*.sh scripts/cron-order-timeouts.sh 2>/dev/null || true
bash deploy/remote-deploy.sh

log "部署完成 ✓"
