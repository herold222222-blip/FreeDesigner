#!/usr/bin/env bash
# 乐自由 · 安装订单超时定时任务
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRON_SCRIPT="$ROOT/scripts/cron-order-timeouts.sh"
CRON_LINE="0 * * * * $CRON_SCRIPT >> /var/log/lezyou-cron.log 2>&1"

chmod +x "$CRON_SCRIPT"

if [ ! -f "$ROOT/.env" ]; then
  echo "缺少 .env，请先配置 CRON_SECRET"
  exit 1
fi

# shellcheck disable=SC1091
set -a && . "$ROOT/.env" && set +a
if [ -z "${CRON_SECRET:-}" ] || echo "$CRON_SECRET" | grep -q "请改"; then
  echo "请先在 .env 中设置 CRON_SECRET"
  exit 1
fi

# 避免重复添加
if crontab -l 2>/dev/null | grep -qF "$CRON_SCRIPT"; then
  echo "crontab 已存在订单超时任务，跳过"
else
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "已添加 crontab: $CRON_LINE"
fi

echo "验证: crontab -l"
