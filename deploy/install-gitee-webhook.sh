#!/usr/bin/env bash
# 安装 Gitee WebHook 自动部署服务（systemd）
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lezyou}"
ENV_FILE="$APP_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "缺少 $ENV_FILE，请先配置 .env"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [ -z "${GITEE_WEBHOOK_SECRET:-}" ] || echo "$GITEE_WEBHOOK_SECRET" | grep -q "请改"; then
  echo "请先在 .env 设置 GITEE_WEBHOOK_SECRET（随机字符串）"
  exit 1
fi

PORT="${GITEE_WEBHOOK_PORT:-9000}"
chmod +x "$APP_DIR/deploy/gitee-deploy.sh"
chmod +x "$APP_DIR/deploy/gitee-webhook.py"

touch /var/log/lezyou-gitee-deploy.log

cat > /etc/systemd/system/lezyou-gitee-webhook.service << EOF
[Unit]
Description=Lezyou Gitee WebHook Deploy
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
Environment=LEZYOU_APP_DIR=${APP_DIR}
ExecStart=/usr/bin/python3 ${APP_DIR}/deploy/gitee-webhook.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable lezyou-gitee-webhook
systemctl restart lezyou-gitee-webhook
systemctl status lezyou-gitee-webhook --no-pager

echo ""
echo "WebHook 服务已启动 ✓"
echo "健康检查: curl http://127.0.0.1:${PORT}/health"
echo ""
echo "Gitee WebHook URL（在 Gitee 仓库 → 管理 → WebHooks 填写）:"
echo "  http://47.113.186.224:${PORT}?token=${GITEE_WEBHOOK_SECRET}"
echo "  （把 IP 换成你的公网 IP；HTTPS 上线后改 https 域名）"
