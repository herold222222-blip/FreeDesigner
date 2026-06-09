# 乐自由平台 · 阿里云 ECS 部署手册（0 → 1）

> 适用：Ubuntu 22.04 / Alibaba Cloud Linux 3 · Docker Compose · 内置 PostgreSQL  
> 预计首次部署 **30–60 分钟**（含备案域名则另计）

---

## 目录

1. [架构概览](#1-架构概览)
2. [购买与初始化 ECS](#2-购买与初始化-ecs)
3. [服务器一键初始化](#3-服务器一键初始化)
4. [上传代码与配置环境变量](#4-上传代码与配置环境变量)
5. [首次部署](#5-首次部署)
6. [配置 Nginx + HTTPS（正式环境）](#6-配置-nginx--https正式环境)
7. [日常更新与维护](#7-日常更新与维护)
8. [数据库备份与恢复](#8-数据库备份与恢复)
9. [定时任务（订单超时）](#9-定时任务订单超时)
10. [故障排查](#10-故障排查)
11. [生产上线检查清单](#11-生产上线检查清单)

---

## 1. 架构概览

```
                    ┌─────────────────────────────────────┐
  用户浏览器  ──►   │  Nginx (80/443)                     │
                    │    └─► app:3000 (Next.js 全栈)      │
                    │           └─► db:5432 (PostgreSQL)  │
                    └─────────────────────────────────────┘
                              Docker Compose
                              数据卷 pgdata 持久化
```

| 组件 | 说明 |
|------|------|
| **app** | Next.js 14 全栈，含 API、Prisma、会话鉴权 |
| **db** | PostgreSQL 16，数据保存在 Docker 卷 `pgdata` |
| **Nginx** | 宿主机安装，反向代理 + HTTPS（正式环境） |
| **crontab** | 每小时调用订单超时 API |

**两种部署模式：**

| 模式 | 适用 | 访问方式 | 配置文件 |
|------|------|----------|----------|
| **内测** | 团队试用、联调 | `http://公网IP:3000` | `.env.internal.example` |
| **正式** | 对外运营 | `https://域名` | `.env.production.example` |

---

## 2. 购买与初始化 ECS

### 2.1 规格建议

| 场景 | CPU / 内存 | 磁盘 | 带宽 |
|------|-----------|------|------|
| 内测 | 2 核 4G | 40G SSD | 3–5 Mbps |
| 正式（<500 日活） | 2 核 8G | 80G SSD | 5 Mbps 起 |
| 正式（高并发） | 4 核 16G + RDS | — | 按量 |

操作系统推荐：**Ubuntu 22.04 LTS** 或 **Alibaba Cloud Linux 3**。

### 2.2 安全组（入方向）

| 端口 | 协议 | 来源 | 用途 |
|------|------|------|------|
| 22 | TCP | 你的办公 IP | SSH 运维 |
| 80 | TCP | 0.0.0.0/0 | HTTP（正式） |
| 443 | TCP | 0.0.0.0/0 | HTTPS（正式） |
| 3000 | TCP | 0.0.0.0/0 | 内测直连（正式上线后可关闭） |

> **安全提示**：SSH 端口 22 不要对全网开放，仅允许已知 IP。

### 2.3 域名与备案

- 面向国内用户、使用域名 + 80/443：**必须在阿里云完成 ICP 备案**。
- 内测阶段可先用 **公网 IP + 3000 端口**，无需备案。

### 2.4 SSH 登录

```bash
ssh root@你的公网IP
# 或使用密钥：ssh -i ~/.ssh/your-key.pem root@你的公网IP
```

---

## 3. 服务器一键初始化

在 ECS 上执行（仅需一次）：

```bash
# 下载初始化脚本（若已 git clone 可跳过 wget）
curl -fsSL https://raw.githubusercontent.com/你的仓库/main/deploy/ecs-init.sh -o /tmp/ecs-init.sh
# 或：cd /opt/lezyou && bash deploy/ecs-init.sh

bash /tmp/ecs-init.sh
```

脚本会自动：

- 安装 Docker + Docker Compose 插件
- 创建项目目录 `/opt/lezyou`
- （可选）安装 Nginx
- 配置 Docker 开机自启

手动安装 Docker（不用脚本时）：

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker compose version   # 确认 compose 插件可用
```

**国内镜像加速**（拉取慢时）：登录 [阿里云容器镜像服务](https://cr.console.aliyun.com/) → 镜像加速器 → 复制专属地址，写入 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": ["https://你的加速器地址.mirror.aliyuncs.com"]
}
```

然后 `systemctl restart docker`。

---

## 4. 上传代码与配置环境变量

### 4.1 上传代码（三选一）

**方式 A：Git（推荐）**

```bash
cd /opt/lezyou
git clone https://github.com/你的账号/lezyou.git .
# 私有仓库：git clone git@github.com:你的账号/lezyou.git .
```

**方式 B：本地打包上传**

```bash
# 在你本地电脑（项目根目录）
tar czf lezyou.tar.gz --exclude=node_modules --exclude=.next --exclude=prisma/dev.db .
scp lezyou.tar.gz root@公网IP:/opt/lezyou/
# ECS 上：
cd /opt/lezyou && tar xzf lezyou.tar.gz
```

**方式 C：rsync 同步**

```bash
rsync -avz --exclude node_modules --exclude .next --exclude .git \
  ./ root@公网IP:/opt/lezyou/
```

### 4.2 配置 .env

**内测环境：**

```bash
cd /opt/lezyou
cp .env.internal.example .env
vi .env
```

**正式环境：**

```bash
cp .env.production.example .env
vi .env
```

**必须修改的项：**

```bash
# 生成强随机密钥
openssl rand -base64 48    # 用于 AUTH_SECRET
openssl rand -base64 32    # 用于 CRON_SECRET、POSTGRES_PASSWORD
```

| 变量 | 内测示例 | 正式示例 |
|------|----------|----------|
| `POSTGRES_PASSWORD` | 强密码 | 强密码 |
| `AUTH_SECRET` | 随机 48 字节 | 随机 48 字节 |
| `PUBLIC_BASE_URL` | `http://1.2.3.4:3000` | `https://your-domain.com` |
| `COOKIE_SECURE` | `false` | `true` |
| `DEMO_CODE_ENABLED` | `on` | `off` |
| `NEXT_PUBLIC_DEMO_MODE` | `on` | `off` |
| `CRON_SECRET` | 随机字符串 | 随机字符串 |

### 4.3 部署前预检

```bash
cd /opt/lezyou
node scripts/deploy-preflight.mjs
# 正式环境加 --production 参数
node scripts/deploy-preflight.mjs --production
```

预检通过后再继续下一步。

---

## 5. 首次部署

### 5.1 内测（IP:3000 直连）

```bash
cd /opt/lezyou
bash deploy/deploy.sh --internal
```

等价于：

```bash
docker compose -f docker-compose.yml -f docker-compose.internal.yml up -d --build
```

### 5.2 正式（仅本机 3000，配合 Nginx）

```bash
bash deploy/deploy.sh --production
```

等价于：

```bash
docker compose up -d --build
```

### 5.3 验证启动

```bash
# 查看日志（看到 Ready 且 [entrypoint] 播种完成）
docker compose logs -f app

# 健康检查
bash deploy/health-check.sh

# API 全流程自检（内测）
BASE_URL=http://你的公网IP:3000 npm run verify:flow
```

浏览器访问 `PUBLIC_BASE_URL`，内测验证码为 `888888`。

**演示账号：**

| 角色 | 手机号 |
|------|--------|
| 委托人 | 13800010000 |
| 设计师 | 13900010000 |
| 管理员 | 13700000000 |
| 超级管理员 | 13700000001 |

---

## 6. 配置 Nginx + HTTPS（正式环境）

### 6.1 安装并配置 Nginx

```bash
apt-get install -y nginx
cp /opt/lezyou/deploy/nginx.conf.example /etc/nginx/conf.d/lezyou.conf
vi /etc/nginx/conf.d/lezyou.conf   # 替换 your-domain.com
nginx -t && systemctl reload nginx
```

### 6.2 申请 SSL 证书

**方案 A：阿里云免费证书**

1. 控制台 → SSL 证书 → 免费证书 → 申请
2. 下载 Nginx 格式
3. 上传到 `/etc/nginx/ssl/`
4. 在 `lezyou.conf` 中启用 HTTPS 段

**方案 B：Let's Encrypt（certbot）**

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

### 6.3 启用 HTTPS 后

1. Nginx 配置中取消 80→443 跳转注释
2. `.env` 设置 `COOKIE_SECURE=true`、`PUBLIC_BASE_URL=https://your-domain.com`
3. 重新部署：`bash deploy/deploy.sh --production`
4. 安全组可关闭 3000 端口

---

## 7. 日常更新与维护

### 7.1 标准更新流程

```bash
cd /opt/lezyou
bash deploy/update.sh
```

脚本会：

1. `git pull`（或提示手动同步代码）
2. 重新构建并滚动重启容器
3. 同步数据库结构（`prod:db:push`）
4. 运行健康检查

手动更新：

```bash
git pull
docker compose up -d --build
docker compose exec app npm run prod:db:push   # 模型有变更时
bash deploy/health-check.sh
```

### 7.2 查看状态

```bash
docker compose ps                    # 容器状态
docker compose logs -f app --tail=100  # 应用日志
docker compose logs db --tail=50     # 数据库日志
docker stats                         # 资源占用
```

### 7.3 重启 / 停止

```bash
docker compose restart app           # 仅重启应用
docker compose down                  # 停止（数据卷保留）
docker compose down -v               # ⚠️ 停止并删除数据卷（会丢数据！）
```

### 7.4 手动重播种（仅空库或测试环境）

```bash
docker compose exec app npm run prod:db:seed
```

> **警告**：seed 会写入演示数据，生产环境慎用。

---

## 8. 数据库备份与恢复

### 8.1 手动备份

```bash
bash deploy/backup-db.sh
# 备份文件：/opt/lezyou/backups/lezyou_YYYYMMDD_HHMMSS.sql.gz
```

### 8.2 设置自动备份（推荐）

```bash
bash deploy/install-backup-crontab.sh
# 默认每天凌晨 3 点备份，保留 14 天
```

### 8.3 恢复

```bash
bash deploy/restore-db.sh backups/lezyou_20260608_030000.sql.gz
```

### 8.4 改用阿里云 RDS

1. 在 `docker-compose.yml` 中删除 `db` 服务
2. `.env` 中设置 `DATABASE_URL=postgresql://user:pass@rds-host:5432/lezyou?schema=public`
3. 在 `app.environment` 中覆盖 `DATABASE_URL`
4. 重新 `docker compose up -d --build`

---

## 9. 定时任务（订单超时）

订单 10 天未验收 / 30 天未结案需自动处理：

```bash
bash deploy/install-crontab.sh
```

或手动添加 crontab：

```bash
chmod +x /opt/lezyou/scripts/cron-order-timeouts.sh
crontab -e
# 添加：
0 * * * * /opt/lezyou/scripts/cron-order-timeouts.sh >> /var/log/lezyou-cron.log 2>&1
```

确保 `.env` 中已设置 `CRON_SECRET`。

---

## 10. 故障排查

### 无法登录 / Cookie 无效

- 检查 `COOKIE_SECURE` 是否与访问协议一致（HTTP → `false`，HTTPS → `true`）
- 检查 `PUBLIC_BASE_URL` 是否与浏览器地址栏一致

### 容器启动失败

```bash
docker compose logs app
docker compose logs db
# 常见：POSTGRES_PASSWORD / AUTH_SECRET 未设置
```

### 数据库连接失败

```bash
docker compose exec db pg_isready -U lezyou
docker compose exec app node -e "console.log(process.env.DATABASE_URL)"
```

### 构建 OOM（内存不足）

```bash
# 临时增加 swap
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

或升级 ECS 规格至 4G+ 内存。

### 端口被占用

```bash
ss -tlnp | grep 3000
docker compose down && docker compose up -d --build
```

### 支付回调失败

- 确认 `PUBLIC_BASE_URL` 为公网可访问的 HTTPS 地址
- 微信/支付宝商户平台登记的回调 URL 与代码一致：
  - `{PUBLIC_BASE_URL}/api/payments/notify/wechat`
  - `{PUBLIC_BASE_URL}/api/payments/notify/alipay`

---

## 11. 生产上线检查清单

- [ ] `DEMO_CODE_ENABLED=off`
- [ ] `NEXT_PUBLIC_DEMO_MODE=off`（需重新 build）
- [ ] `COOKIE_SECURE=true`
- [ ] `PUBLIC_BASE_URL` 为 HTTPS 域名
- [ ] `AUTH_SECRET`、`POSTGRES_PASSWORD`、`CRON_SECRET` 均为强随机值
- [ ] 已接入阿里云短信（`SMS_*` 变量）
- [ ] Nginx + SSL 已配置
- [ ] 安全组已关闭 3000 对外端口
- [ ] 数据库自动备份 crontab 已安装
- [ ] 订单超时 crontab 已安装
- [ ] `npm run verify:flow` 自检通过

---

## 快速命令参考

```bash
# 首次内测部署
bash deploy/ecs-init.sh && cd /opt/lezyou && cp .env.internal.example .env && vi .env
bash deploy/deploy.sh --internal

# 首次正式部署
cp .env.production.example .env && vi .env
bash deploy/deploy.sh --production

# 日常更新
bash deploy/update.sh

# 备份
bash deploy/backup-db.sh

# 健康检查
bash deploy/health-check.sh
```

---

© 2026 乐自由 · ECS 部署手册
