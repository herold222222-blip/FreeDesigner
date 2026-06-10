# 供 deploy/*.sh source：控制右下角「演示身份切换」是否写入前端构建包
# shell export 优先于 .env，可覆盖 ECS 上历史遗留的 NEXT_PUBLIC_DEMO_MODE=on
resolve_demo_env() {
  if grep -qE '^ENABLE_DEMO_UI=true' .env 2>/dev/null; then
    export NEXT_PUBLIC_DEMO_MODE=on
    echo "[deploy] 右下角演示身份切换：开（.env 已设 ENABLE_DEMO_UI=true）"
  else
    export NEXT_PUBLIC_DEMO_MODE=off
    echo "[deploy] 右下角演示身份切换：关（默认；需保留请在 .env 加 ENABLE_DEMO_UI=true）"
  fi
}
