#!/usr/bin/env bash
# 乐自由 · 日常更新（拉代码 → 重建 → 同步数据库 → 健康检查）
# 用法：bash deploy/update.sh [--no-pull]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_PULL=false
for arg in "$@"; do
  case "$arg" in
    --no-pull) SKIP_PULL=true ;;
  esac
done

if [ ! -f .env ]; then
  echo "缺少 .env 文件"
  exit 1
fi

# 内测模式：COOKIE_SECURE=false
if grep -q "^COOKIE_SECURE=false" .env 2>/dev/null; then
  echo "[update] 内测模式（3000 对外）"
fi

if [ "$SKIP_PULL" = false ] && [ -d .git ]; then
  echo "[update] git pull..."
  git pull --ff-only || {
    echo "[update] git pull 失败，可使用 --no-pull 跳过"
    exit 1
  }
elif [ "$SKIP_PULL" = false ]; then
  echo "[update] 非 git 目录，请手动同步代码后加 --no-pull 重试"
  exit 1
fi

echo "[update] 重新构建并启动..."
bash deploy/remote-deploy.sh

echo "[update] 健康检查..."
sleep 3
bash deploy/health-check.sh || true
