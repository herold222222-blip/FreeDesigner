#!/usr/bin/env bash
# 乐自由 · PostgreSQL 备份
# 用法：bash deploy/backup-db.sh
# 输出：backups/lezyou_YYYYMMDD_HHMMSS.sql.gz
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

# 读取数据库配置
POSTGRES_USER="lezyou"
POSTGRES_DB="lezyou"
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a && . ./.env && set +a
fi
POSTGRES_USER="${POSTGRES_USER:-lezyou}"
POSTGRES_DB="${POSTGRES_DB:-lezyou}"

STAMP=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/lezyou_${STAMP}.sql.gz"

echo "[backup] 备份 $POSTGRES_DB → $OUT"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" --clean --if-exists "$POSTGRES_DB" | gzip > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "[backup] 完成 ✓ 大小: $SIZE"

# 清理旧备份
if [ "$RETAIN_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -name "lezyou_*.sql.gz" -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true
  echo "[backup] 已清理 ${RETAIN_DAYS} 天前的旧备份"
fi
