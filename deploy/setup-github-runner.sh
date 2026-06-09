#!/usr/bin/env bash
# 在 ECS 上安装 GitHub Actions Self-hosted Runner（国内推荐，无需外网 SSH）
# 用法：bash deploy/setup-github-runner.sh
#
# 前置：GitHub 仓库 → Settings → Actions → Runners → New self-hosted runner
#       复制页面上的 TOKEN，执行：
#       RUNNER_TOKEN=ghp_xxx bash deploy/setup-github-runner.sh

set -euo pipefail

RUNNER_VERSION="${RUNNER_VERSION:-2.334.0}"
RUNNER_DIR="${RUNNER_DIR:-/opt/actions-runner}"
REPO="${GITHUB_REPO:-lipenglucky/lezyou-platform-prototype}"

if [ -z "${RUNNER_TOKEN:-}" ]; then
  echo "请设置 RUNNER_TOKEN（GitHub → Settings → Actions → Runners → New self-hosted runner）"
  echo "  RUNNER_TOKEN=你的token bash deploy/setup-github-runner.sh"
  exit 1
fi

# 依赖
command -v curl >/dev/null || yum install -y curl || apt-get install -y curl
command -v rsync >/dev/null || yum install -y rsync || apt-get install -y rsync

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [ ! -f ./config.sh ]; then
  echo "[runner] 下载 actions-runner v${RUNNER_VERSION}..."
  curl -fsSL -o actions-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  tar xzf actions-runner.tar.gz
  rm -f actions-runner.tar.gz
fi

if [ ! -f .runner ]; then
  echo "[runner] 注册 runner..."
  ./config.sh \
    --url "https://github.com/${REPO}" \
    --token "$RUNNER_TOKEN" \
    --name "ecs-lezyou" \
    --labels "ecs,self-hosted,linux,x64" \
    --work _work \
    --unattended \
    --replace
fi

echo "[runner] 安装并启动服务..."
./svc.sh install
./svc.sh start
./svc.sh status

echo ""
echo "Runner 安装完成 ✓"
echo "GitHub → Settings → Actions → Runners 应看到 ecs-lezyou (Idle)"
echo "之后 push 到 main 会自动在此 ECS 上部署"
