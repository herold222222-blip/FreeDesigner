# 供 deploy/*.sh source：演示相关环境变量（shell export 优先于 .env）
# - 右下角身份切换：默认关；.env 设 ENABLE_DEMO_UI=true 时开
# - 固定验证码：默认关；仅当 .env 显式 DEMO_CODE_ENABLED=on 时开
resolve_demo_env() {
  if grep -qE '^ENABLE_DEMO_UI=true' .env 2>/dev/null; then
    export NEXT_PUBLIC_DEMO_MODE=on
    echo "[deploy] 右下角演示身份切换：开（.env 已设 ENABLE_DEMO_UI=true）"
  else
    export NEXT_PUBLIC_DEMO_MODE=off
    echo "[deploy] 右下角演示身份切换：关"
  fi

  local sms_provider=""
  if grep -qE '^SMS_PROVIDER=' .env 2>/dev/null; then
    sms_provider="$(grep -E '^SMS_PROVIDER=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    sms_provider="${sms_provider#"${sms_provider%%[![:space:]]*}"}"
    sms_provider="${sms_provider%"${sms_provider##*[![:space:]]}"}"
  fi

  # 仅当 .env 显式 on 时启用固定验证码；默认 off（需短信）
  if grep -qE '^DEMO_CODE_ENABLED=on' .env 2>/dev/null; then
    export DEMO_CODE_ENABLED=on
    local code="888888"
    if grep -qE '^DEMO_VERIFICATION_CODE=' .env 2>/dev/null; then
      code="$(grep -E '^DEMO_VERIFICATION_CODE=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
      code="${code:-888888}"
    fi
    export DEMO_VERIFICATION_CODE="$code"
    echo "[deploy] 登录验证码：固定演示码 ${DEMO_VERIFICATION_CODE}（.env 显式 DEMO_CODE_ENABLED=on）"
  else
    export DEMO_CODE_ENABLED=off
    if [ -n "$sms_provider" ]; then
      echo "[deploy] 登录验证码：真实短信（SMS_PROVIDER=${sms_provider}）"
    else
      echo "[deploy] 登录验证码：已关闭固定码，但未配置 SMS_PROVIDER（用户将无法收验证码）"
    fi
  fi
}
