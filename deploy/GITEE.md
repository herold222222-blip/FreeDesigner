# Gitee → 阿里云 ECS 自动部署（完整步骤）

> 国内推荐：**代码放 Gitee**，ECS 直接 `git pull`，push 后 WebHook 触发自动部署。  
> 比 GitHub + Self-hosted Runner 更简单、更稳定。

---

## 架构

```
本地 push → Gitee → WebHook POST → ECS:9000 → gitee-deploy.sh → docker compose 重建
```

---

## 一、Gitee 创建仓库并推送代码

### 1. 注册 / 登录 Gitee

https://gitee.com

### 2. 新建仓库

- 仓库名：`lezyou-platform-prototype`（或任意）
- **私有**（推荐）
- **不要**勾选「使用 Readme 初始化」（保持空仓库）

### 3. 本地 Mac 改 remote 并推送

```bash
cd "/Users/li_warehouse/Downloads/乐自由下单完整版_cursor 2"

# 查看当前 remote
git remote -v

# 去掉 GitHub，改用 Gitee（把 你的用户名 换成 Gitee 用户名）
git remote remove origin 2>/dev/null || true
git remote add origin https://gitee.com/你的用户名/lezyou-platform-prototype.git

# 或使用 SSH（推荐，需先在 Gitee 添加 SSH 公钥）
# git remote add origin git@gitee.com:你的用户名/lezyou-platform-prototype.git

git add .
git commit -m "feat: migrate to gitee with auto deploy" || true
git push -u origin main
```

> HTTPS 推送时用户名填 Gitee 账号，密码填 **私人令牌**（设置 → 私人令牌）。

---

## 二、ECS 从 Gitee 克隆项目

Workbench 终端：

### 1. 生成 ECS 部署密钥（私有仓库必做）

```bash
ssh-keygen -t ed25519 -C "ecs-gitee-deploy" -f /root/.ssh/gitee_deploy -N ""
cat /root/.ssh/gitee_deploy.pub
```

复制公钥 → Gitee 仓库 → **管理** → **部署公钥** → 添加（勾选读写或只读即可 pull）

### 2. 配置 SSH 使用这把密钥

```bash
cat >> /root/.ssh/config << 'EOF'
Host gitee.com
  HostName gitee.com
  User git
  IdentityFile /root/.ssh/gitee_deploy
  StrictHostKeyChecking no
EOF
chmod 600 /root/.ssh/config

ssh -T git@gitee.com
# 应看到 Hi xxx! You've successfully authenticated
```

### 3. 克隆代码

```bash
# 若 /opt/lezyou 已有旧代码，先备份 .env
cp /opt/lezyou/.env /tmp/lezyou.env.bak 2>/dev/null || true

rm -rf /opt/lezyou
git clone git@gitee.com:你的用户名/lezyou-platform-prototype.git /opt/lezyou

cp /tmp/lezyou.env.bak /opt/lezyou/.env 2>/dev/null || cp /opt/lezyou/.env.internal.example /opt/lezyou/.env
```

### 4. 配置 .env（若还没有）

```bash
cd /opt/lezyou
vi .env
```

内测至少包含：

```bash
COOKIE_SECURE=false
PUBLIC_BASE_URL=http://47.113.186.224:3000
GITEE_WEBHOOK_SECRET=随机字符串
GITEE_WEBHOOK_PORT=9000
```

生成 secret：

```bash
echo "GITEE_WEBHOOK_SECRET=$(openssl rand -base64 32)"
```

### 5. 首次部署

```bash
cd /opt/lezyou
docker compose -f docker-compose.yml -f docker-compose.internal.yml up -d --build
```

---

## 三、安装 WebHook 自动部署服务

```bash
cd /opt/lezyou
bash deploy/install-gitee-webhook.sh
```

确认：

```bash
curl http://127.0.0.1:9000/health
# 应返回 ok
systemctl status lezyou-gitee-webhook
```

---

## 四、Gitee 配置 WebHook

Gitee 仓库 → **管理** → **WebHooks** → **添加 WebHook**

| 项 | 值 |
|----|-----|
| URL | `http://47.113.186.224:9000?token=你的GITEE_WEBHOOK_SECRET` |
| 密码/Token | 留空（token 已在 URL） |
| 勾选事件 | **Push** |

点 **添加**，再点 **测试** → 应返回 200。

查看 ECS 部署日志：

```bash
tail -f /var/log/lezyou-gitee-deploy.log
docker compose logs -f app
```

---

## 五、阿里云安全组

入方向放行：

| 端口 | 说明 |
|------|------|
| 3000 | 网站访问 |
| 9000 | Gitee WebHook（仅 Gitee 服务器 IP 更好，内测可 0.0.0.0/0） |
| 22 | SSH 运维 |

---

## 六、日常使用

```bash
# 本地改完代码
git add .
git commit -m "fix: 某功能"
git push origin main
```

push 后 **约 5–15 分钟** ECS 自动更新，访问 http://47.113.186.224:3000

也可在 ECS 手动部署：

```bash
cd /opt/lezyou && bash deploy/gitee-deploy.sh
```

---

## 七、故障排查

| 现象 | 处理 |
|------|------|
| WebHook 测试失败 | 安全组是否放行 9000；`systemctl status lezyou-gitee-webhook` |
| git pull 失败 | `ssh -T git@gitee.com`；检查部署公钥 |
| 部署脚本没跑 | `tail /var/log/lezyou-gitee-deploy.log` |
| 页面没更新 | `docker compose ps`；是否 push 到 main 分支 |
| 收不到登录验证码 | 检查 `.env` 中 `SMS_*` 是否配置完整，并确认 `src/lib/server/sms.ts` 已接入真实短信通道 |

---

## 与 GitHub 对比

| | GitHub | Gitee |
|---|--------|-------|
| 国内 push/pull | 慢/不稳定 | 快 |
| ECS git clone | 常失败 | 正常 |
| 自动部署 | 需 Runner 或 SSH | WebHook + git pull |
| 配置难度 | 高 | 低 |

GitHub Actions workflow 可保留或删除，**以 Gitee WebHook 为准**。

---

© 2026 乐自由 · Gitee 部署手册
