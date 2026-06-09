#!/usr/bin/env bash
# 乐自由 · 安装数据库自动备份（默认每天 3:00）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_SCRIPT="$ROOT/deploy/backup-db.sh"
CRON_LINE="0 3 * * * $BACKUP_SCRIPT >> /var/log/lezyou-backup.log 2>&1"

chmod +x "$BACKUP_SCRIPT"

if crontab -l 2>/dev/null | grep -qF "$BACKUP_SCRIPT"; then
  echo "crontab 已存在备份任务，跳过"
else
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  echo "已添加 crontab: $CRON_LINE"
fi

echo "备份目录: $ROOT/backups（保留 14 天）"
