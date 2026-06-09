#!/usr/bin/env bash
# 乐自由 · PostgreSQL 恢复
# 用法：bash deploy/restore-db.sh backups/lezyou_20260608_030000.sql.gz
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "用法: bash deploy/restore-db.sh <备份文件.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "备份文件不存在: $BACKUP_FILE"
  exit 1
fi

POSTGRES_USER="lezyou"
POSTGRES_DB="lezyou"
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a && . ./.env && set +a
fi
POSTGRES_USER="${POSTGRES_USER:-lezyou}"
POSTGRES_DB="${POSTGRES_DB:-lezyou}"

echo "⚠️  即将恢复数据库 $POSTGRES_DB，当前数据将被覆盖！"
read -r -p "确认恢复? 输入 yes 继续: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "已取消"
  exit 0
fi

echo "[restore] 停止应用..."
docker compose stop app

echo "[restore] 恢复数据..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "[restore] 重启应用..."
docker compose start app

echo "[restore] 完成 ✓"
