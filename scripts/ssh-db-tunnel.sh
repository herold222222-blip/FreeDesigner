#!/bin/bash
# 本地 Mac → ECS Postgres（SSH 隧道，无需公网开放 5432）
# 用法：./scripts/ssh-db-tunnel.sh
# 隧道保持运行时，.env 使用：DATABASE_URL=postgresql://lezyou:密码@127.0.0.1:5432/lezyou?schema=public

ECS_HOST="${ECS_HOST:-47.113.186.224}"
ECS_USER="${ECS_USER:-root}"
LOCAL_PORT="${LOCAL_PORT:-5432}"
REMOTE_PORT="${REMOTE_PORT:-5432}"

echo "建立 SSH 隧道：127.0.0.1:${LOCAL_PORT} → ${ECS_HOST}:127.0.0.1:${REMOTE_PORT}"
echo "按 Ctrl+C 关闭隧道"
exec ssh -N -L "${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" "${ECS_USER}@${ECS_HOST}"
