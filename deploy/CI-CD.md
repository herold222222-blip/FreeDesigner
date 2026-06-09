# GitHub → ECS 自动部署

> **国内 ECS 推荐 Self-hosted Runner**：GitHub 云 runner 外网 SSH 连 ECS 常失败（6–12 秒报错），改为在 ECS 本机跑 Actions。

---

## 推荐架构（Self-hosted Runner）

```
本地 push → GitHub → ECS 上的 Runner 拉代码 → remote-deploy.sh → Docker 重建
```

`.env` 和数据库卷 **保留在服务器**，不会被覆盖。

---

## 一次性配置 Runner（约 10 分钟）

### 1. GitHub 获取 Runner Token

打开：  
https://github.com/lipenglucky/lezyou-platform-prototype/settings/actions/runners/new

选 **Linux** · **x64**，复制页面上的 **token**（一次性）。

### 2. ECS 安装 Runner

Workbench 终端：

```bash
cd /opt/lezyou
curl -fsSL -o /tmp/setup-runner.sh \
  https://raw.githubusercontent.com/lipenglucky/lezyou-platform-prototype/main/deploy/setup-github-runner.sh
# 若 GitHub 拉不到，用手动上传的脚本：
# bash deploy/setup-github-runner.sh

RUNNER_TOKEN=粘贴token bash deploy/setup-github-runner.sh
```

或若 `/opt/lezyou` 已有 `deploy/setup-github-runner.sh`：

```bash
cd /opt/lezyou
RUNNER_TOKEN=粘贴token bash deploy/setup-github-runner.sh
```

### 3. 确认 Runner 在线

GitHub → Settings → Actions → **Runners** → 应看到 **ecs-lezyou** 状态 **Idle**。

### 4. 推送 workflow 并测试

```bash
git push origin main
```

Actions 里 **Deploy to ECS** 应在本机 runner 上跑绿。

---

## 日常用法

```bash
git add .
git commit -m "fix: 某改动"
git push origin main
```

---

## 备选：SSH 部署（海外 ECS）

<details>
<summary>展开 SSH 方式（国内 ECS 通常不可用）</summary>

## 架构（SSH）

在 **ECS Workbench 终端**执行：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /root/.ssh/github_deploy -N ""

cat /root/.ssh/github_deploy.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

echo "===== 复制下面整段到 GitHub Secret ECS_SSH_KEY ====="
cat /root/.ssh/github_deploy
```

复制输出的 **完整私钥**（含 `BEGIN` / `END` 行）。

---

### 3. GitHub 配置 Secrets

打开仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret 名称 | 值 |
|-------------|-----|
| `ECS_HOST` | `47.113.186.224` |
| `ECS_USER` | `root` |
| `ECS_SSH_KEY` | 上一步复制的私钥全文 |
| `ECS_SSH_PORT` | `22`（可选，默认 22） |

---

### 4. 确认 ECS 安全组

入方向放行 **TCP 22**（GitHub Actions IP 不固定，内测需填 `0.0.0.0/0`）。

### 4.1 确认 ECS 上 authorized_keys

```bash
# Workbench 执行
cat /root/.ssh/github_deploy.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
grep github-actions /root/.ssh/authorized_keys
```

### 4.2 ECS_SSH_KEY 格式（最常见失败原因）

粘贴到 GitHub Secret 时必须**完整保留换行**，格式如下：

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAA...
...多行...
-----END OPENSSH PRIVATE KEY-----
```

❌ 不要加引号、不要合并成一行、不要有多余空格。

---

### 5. 首次手动验证 SSH（可选）

在本地 Mac 保存私钥测试：

```bash
# 将 ECS 私钥保存到本地文件后
chmod 600 ~/github_deploy
ssh -i ~/github_deploy root@47.113.186.224 "echo SSH OK"
```

---

</details>

## 手动触发部署

GitHub → Actions → Deploy to ECS → **Run workflow**

---

## 故障排查

| 现象 | 处理 |
|------|------|
| Workflow 一直 Queued | Runner 未在线；ECS 执行 `./svc.sh status` |
| Runner 注册失败 | Token 过期，重新 New self-hosted runner 获取 |
| 构建失败 | Actions 日志查看 docker build 报错 |
| 部署后 .env 丢失 | rsync 已排除 `.env`；检查 `/tmp/lezyou.env.bak` |
| 页面 502 | `docker compose ps` + `docker compose logs app` |

ECS 上手动部署（不经过 GitHub）：

```bash
cd /opt/lezyou
bash deploy/remote-deploy.sh
```

---

## 正式环境

`.env` 中 `COOKIE_SECURE=true` 时，`remote-deploy.sh` 自动使用 `docker-compose.production.yml`（仅 127.0.0.1:3000，配合 Nginx）。

---

© 2026 乐自由 · CI/CD 手册
