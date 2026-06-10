# 供 deploy/*.sh source：演示相关环境变量（shell export 优先于 .env）
# - 右下角身份切换：默认关
# - 登录验证码 888888：默认开（上线初期）；接入短信后在 .env 设 DEMO_CODE_ENABLED=off + SMS_PROVIDER
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

  # 仅当 .env 显式 off 且已配置短信渠道时，才关闭固定验证码
  if grep -qE '^DEMO_CODE_ENABLED=off' .env 2>/dev/null && [ -n "$sms_provider" ]; then
    export DEMO_CODE_ENABLED=off
    echo "[deploy] 登录验证码：真实短信（SMS_PROVIDER=${sms_provider}）"
  else
    export DEMO_CODE_ENABLED=on
    local code="888888"
    if grep -qE '^DEMO_VERIFICATION_CODE=' .env 2>/dev/null; then
      code="$(grep -E '^DEMO_VERIFICATION_CODE=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
      code="${code:-888888}"
    fi
    export DEMO_VERIFICATION_CODE="$code"
    if grep -qE '^DEMO_CODE_ENABLED=off' .env 2>/dev/null; then
      echo "[deploy] 登录验证码：固定演示码 ${DEMO_VERIFICATION_CODE}（.env 为 off 但未配 SMS_PROVIDER，已自动回退）"
    else
      echo "[deploy] 登录验证码：固定演示码 ${DEMO_VERIFICATION_CODE}（DEMO_CODE_ENABLED=on）"
    fi
    # 同步写回 .env，避免 compose 下次启动仍读旧值 off
    if grep -qE '^DEMO_CODE_ENABLED=' .env 2>/dev/null; then
      sed -i.bak -E 's/^DEMO_CODE_ENABLED=.*/DEMO_CODE_ENABLED=on/' .env
    else
      echo "DEMO_CODE_ENABLED=on" >> .env
    fi
    if grep -qE '^DEMO_VERIFICATION_CODE=' .env 2>/dev/null; then
      sed -i.bak2 -E "s/^DEMO_VERIFICATION_CODE=.*/DEMO_VERIFICATION_CODE=${DEMO_VERIFICATION_CODE}/" .env
    else
      echo "DEMO_VERIFICATION_CODE=${DEMO_VERIFICATION_CODE}" >> .env
    fi
  fi
}
