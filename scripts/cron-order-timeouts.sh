#!/bin/sh
# 订单超时定时任务（10 天验收 / 30 天结案）
# crontab 示例（每小时）：
#   0 * * * * /opt/lezyou/scripts/cron-order-timeouts.sh >> /var/log/lezyou-cron.log 2>&1
#
# 依赖环境变量（或在同目录 .env 中 export）：
#   PUBLIC_BASE_URL  CRON_SECRET

set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BASE="${PUBLIC_BASE_URL:-http://127.0.0.1:3000}"
SECRET="${CRON_SECRET:-}"

if [ -z "$SECRET" ]; then
  echo "[cron] 跳过：未设置 CRON_SECRET"
  exit 0
fi

echo "[cron] $(date -Iseconds) POST ${BASE}/api/cron/order-timeouts"
curl -fsS -X POST \
  -H "Authorization: Bearer ${SECRET}" \
  "${BASE}/api/cron/order-timeouts"

echo ""
