#!/usr/bin/env bash
# 乐自由 · ECS 服务器首次初始化（Docker + 目录 + 可选 Nginx）
# 用法：sudo bash deploy/ecs-init.sh [--with-nginx]
set -euo pipefail

INSTALL_NGINX=false
for arg in "$@"; do
  case "$arg" in
    --with-nginx) INSTALL_NGINX=true ;;
  esac
done

APP_DIR="${APP_DIR:-/opt/lezyou}"
LOG_PREFIX="[ecs-init]"

log() { echo "$LOG_PREFIX $*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 root 或 sudo 运行此脚本"
  exit 1
fi

log "开始初始化 ECS 环境..."

# --- Docker ---
if ! command -v docker >/dev/null 2>&1; then
  log "安装 Docker..."
  curl -fsSL https://get.docker.com | sh
else
  log "Docker 已安装：$(docker --version)"
fi

systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  log "警告：docker compose 插件不可用，请确认 Docker 版本 ≥ 20.10"
fi

# --- 项目目录 ---
if [ ! -d "$APP_DIR" ]; then
  log "创建项目目录 $APP_DIR"
  mkdir -p "$APP_DIR"
fi

mkdir -p "$APP_DIR/backups"
mkdir -p /var/log/lezyou

# --- 可选 Nginx ---
if [ "$INSTALL_NGINX" = true ]; then
  if command -v apt-get >/dev/null 2>&1; then
    log "安装 Nginx..."
    apt-get update -y
    apt-get install -y nginx curl
    systemctl enable nginx
  elif command -v yum >/dev/null 2>&1; then
    log "安装 Nginx..."
    yum install -y nginx curl
    systemctl enable nginx
  else
    log "无法自动安装 Nginx，请手动安装"
  fi
fi

# --- 常用工具 ---
if command -v apt-get >/dev/null 2>&1; then
  apt-get install -y curl git openssl >/dev/null 2>&1 || true
fi

log "初始化完成 ✓"
echo ""
echo "下一步："
echo "  1. 将代码放到 $APP_DIR（git clone 或 scp）"
echo "  2. cp .env.internal.example .env  并填写密码/密钥"
echo "  3. bash deploy/deploy.sh --internal   # 内测"
echo "     或 bash deploy/deploy.sh --production  # 正式"
echo ""
echo "完整文档：deploy/DEPLOY.md"
