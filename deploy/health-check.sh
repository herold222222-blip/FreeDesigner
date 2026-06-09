#!/usr/bin/env bash
# 乐自由 · 健康检查
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 从 .env 读取 PUBLIC_BASE_URL，默认本机
BASE="http://127.0.0.1:3000"
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a && . ./.env && set +a
  BASE="${PUBLIC_BASE_URL:-http://127.0.0.1:3000}"
fi

# 内测对外 3000 时，健康检查仍走本机
LOCAL="http://127.0.0.1:3000"

echo "[health] 检查容器状态..."
if ! docker compose ps --status running 2>/dev/null | grep -q app; then
  echo "[health] ❌ app 容器未运行"
  exit 1
fi

echo "[health] 检查 API: GET ${LOCAL}/api/auth/me"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${LOCAL}/api/auth/me" || echo "000")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "[health] ✓ API 响应正常 (HTTP $HTTP_CODE)"
else
  echo "[health] ❌ API 异常 (HTTP $HTTP_CODE)"
  exit 1
fi

echo "[health] ✓ 全部通过"
echo "[health] 访问地址: $BASE"
