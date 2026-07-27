#!/bin/sh
set -e

echo "[entrypoint] 同步数据库结构 (prisma db push)..."
npm run prod:db:push

echo "[entrypoint] 检查是否需要播种预设账号..."
USER_COUNT=$(node <<'NODE'
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.user
  .count()
  .then((c) => process.stdout.write(String(c)))
  .catch(() => process.stdout.write("0"))
  .finally(() => p.$disconnect());
NODE
)

if [ "$USER_COUNT" = "0" ]; then
  echo "[entrypoint] 空库，自动播种预设管理员账号与平台配置..."
  npm run prod:db:seed
else
  echo "[entrypoint] 已有 ${USER_COUNT} 个账号，跳过播种。"
fi

echo "[entrypoint] 启动应用..."
exec "$@"
