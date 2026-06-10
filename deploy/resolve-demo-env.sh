# 供 deploy/*.sh source：演示相关环境变量（shell export 优先于 .env）
# - 右下角身份切换：默认关
# - 登录验证码 888888：默认开（上线初期）；接入短信后在 .env 设 DEMO_CODE_ENABLED=off
resolve_demo_env() {
  if grep -qE '^ENABLE_DEMO_UI=true' .env 2>/dev/null; then
    export NEXT_PUBLIC_DEMO_MODE=on
    echo "[deploy] 右下角演示身份切换：开（.env 已设 ENABLE_DEMO_UI=true）"
  else
    export NEXT_PUBLIC_DEMO_MODE=off
    echo "[deploy] 右下角演示身份切换：关"
  fi

  if grep -qE '^DEMO_CODE_ENABLED=off' .env 2>/dev/null; then
    export DEMO_CODE_ENABLED=off
    echo "[deploy] 登录验证码：真实短信（DEMO_CODE_ENABLED=off，需配置 SMS_*）"
  else
    export DEMO_CODE_ENABLED=on
    local code
    code="$(grep -E '^DEMO_VERIFICATION_CODE=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    export DEMO_VERIFICATION_CODE="${code:-888888}"
    echo "[deploy] 登录验证码：固定演示码 ${DEMO_VERIFICATION_CODE}（DEMO_CODE_ENABLED=on）"
  fi
}
