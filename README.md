# 乐自由 · 工程设计服务对接平台

> 建筑 / 景观 / 室内 · 效果图 / 动画 · 造价咨询 五大设计专业的双向对接平台。
> 委托人定向下单或悬赏招标，设计师在线交付，资金由平台分阶段托管。

本项目为 **可部署的全栈应用**（Next.js + Prisma + API）。委托下单、签约、支付、验收、评价等核心业务数据均持久化到数据库。
仓库默认关闭演示：`NEXT_PUBLIC_DEMO_MODE=off`（隐藏右下角身份切换）、`DEMO_CODE_ENABLED=off`（登录必须走短信，需配置 `SMS_*`；见 `.env.example` / `.env.production.example`）。  
说明：`src/lib/server/sms.ts` 中阿里云发送目前为接入占位，需补全 dysmsapi 调用后用户才能真正收到短信。

---

## v1.1 更新（2026-05）

> 基于《擎天筑 · 版本更新 v1-1》产品文档全面升级。

### 体系重构

- **5 大一级专业**：建筑设计 / 景观设计 / 室内设计 / 效果图 · 动画 / 造价咨询
- **三级专业层级**：每个一级专业拆分为方案设计、施工图设计两大二级专业，再细分到具体的三级专业（如「景观园建专业」、「景观给排水 + 自动喷灌」）
- **设计师等级**：见习（85%）/ 中级 v1（100%）/ 高级 v1（130%）/ 特级（默认 150%，可自定义），影响取费基数
- **客户等级**：战略 90% / 优质 95% / 普通 100% / 次级 110% / 灰名单
- **设计师区域系数**：六大梯队（北上广深 120% → 其余县市 70%），按城市归属自动判定
- **项目类型系数**：景观 25 种类型差异化系数（如自然风景区 60%、主题乐园 150%）

### 新增页面 / 组件

- **`/calculator` 景观费用计算器**：按面积 / 按时间双 Tab，覆盖 v1.1 取费公式（出图费 + 审图费 + 项目管理费 + 平台管理费 + 商务费 + 税）
- **多语言切换器**：顶部导航中 / 英 / 阿 切换（UI 演示）
- **收藏系统**：设计师卡片右上角 ❤、`/client/favorites` 收藏管理
- **三维度评价 + 印象标签**：设计师主页展示「专业 / 服务 / 响应」三维度评分 + 委托人盖戳印象（"图纸严谨 +32"）

### 增值服务

- **第三方审图**（+8% 出图费）：独立审图师审核图纸并五档评级设计师
- **项目管理**（+20% 出图费）：同城项目经理代为对外沟通、对内协调
- 在 `/order/new` 第 2 步可勾选加购，订单汇总页显示叠加费用

---

## 快速开始

> 项目已从纯前端原型升级为 **全栈应用**：含真实数据库（Prisma）、手机验证码鉴权、服务端会话与 API。

```bash
# 1. 安装依赖（postinstall 会自动 prisma generate）
npm install

# 2. 准备环境变量（首次）：复制 .env.example 为 .env，按需修改
#    本地默认使用 SQLite，无需额外数据库

# 3. 初始化数据库并导入演示数据
npm run db:migrate     # 应用数据库迁移
npm run db:seed        # 将 mock 数据写入数据库（生成演示账号）

# 4. 启动
npm run dev
# 访问 http://localhost:3000
```

生产构建：`npm run build && npm run start`。

环境要求：Node.js ≥ 18（已在 Node 22 + Windows 11 + npm 11 验证通过）。

### 种子测试账号（`npm run db:seed` 后）

**账号密码登录**：

| 账号 | 密码 | 角色 |
|------|------|------|
| `FD001` | `FD19076652` | 超级管理员 |
| `FD002` / `FD003` / `FD004` | `FD4006801231` | 普通管理员 |
| `FD005`–`FD010` | `4006801231` | 普通账号（登录后可选注册委托人/设计师） |

**手机号短信登录**（需配置短信或临时开启演示码）：

| 角色 | 手机号 |
|------|--------|
| 委托人（林家三口） | `13800010000` |
| 设计师（陈牧之） | `13900010000` |

> 登录页支持「账号密码」与「手机验证码」，登录时无需先选身份；双重身份会在登录后弹窗选择。  
> 也可在 `/login?register=1` 注册新账号。

### 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run db:migrate` | 创建 / 应用数据库迁移（开发） |
| `npm run db:seed` | 重新播种演示数据 |
| `npm run db:reset` | 重置数据库并重新迁移 + 播种 |
| `npm run db:studio` | 打开 Prisma Studio 可视化查看数据 |
| `npm run db:deploy` | 生产环境应用迁移 |

**数据库表说明（22 张表字段与业务含义）** → [docs/DATABASE-TABLES.md](docs/DATABASE-TABLES.md)
| `npm run verify:flow` | 委托全流程 API 自检（`BASE_URL` 指向内测地址） |
| `npm run verify:preflight` | 部署前检查 `.env` 是否填全 |
| `scripts/cron-order-timeouts.sh` | 服务器 crontab 调用，处理订单超时 |

### Gitee 自动部署（国内推荐）

**push Gitee → ECS 自动更新** 见 **[deploy/GITEE.md](deploy/GITEE.md)**。

### ECS 完整部署手册

**从零部署、更新、备份、HTTPS 上线** 见 **[deploy/DEPLOY.md](deploy/DEPLOY.md)**。

**GitHub push 自动部署 ECS** 见 **[deploy/CI-CD.md](deploy/CI-CD.md)**。

### Netlify 部署

本仓库含 [`netlify.toml`](netlify.toml)，构建命令为 `npm run netlify:build`（PostgreSQL Prisma schema + `db push` + `next build`）。

1. 准备托管 PostgreSQL（Neon / Supabase 等），拿到 `DATABASE_URL`（Serverless 建议连接池 URL）。
2. 在 Netlify → Site configuration → Environment variables 按 [`.env.netlify.example`](.env.netlify.example) 填写至少：`DATABASE_URL`、`AUTH_SECRET`、`PUBLIC_BASE_URL`、`DEMO_CODE_ENABLED=off`、`NEXT_PUBLIC_DEMO_MODE=off`。
3. 重新 Deploy。首次若页面无设计师数据，对本机执行一次：  
   `DATABASE_URL=... npm run prod:generate && npm run prod:db:seed`
4. **不要用本地 SQLite**：Netlify Serverless 无法读写 `file:./dev.db`。

### 内测部署（阿里云 ECS · 约 15 分钟）

适合团队内测：**沙箱支付、空库自动播种**；演示开关默认关闭，需配置短信后登录。

**1. ECS 安全组**：放行 TCP `3000`（直连内测）或 `80`/`443`（Nginx）。

**2. 安装 Docker 并上传代码**（见下方「部署到阿里云」第 1 步）。

**3. 配置并启动**

```bash
cd /opt/lezyou
cp .env.internal.example .env
vi .env   # 改 POSTGRES_PASSWORD、AUTH_SECRET、PUBLIC_BASE_URL、CRON_SECRET、SMS_*
node scripts/deploy-preflight.mjs

# 直连 IP:3000（无需 Nginx）
docker compose -f docker-compose.yml -f docker-compose.internal.yml up -d --build
docker compose logs -f app   # 看到 Ready 且 [entrypoint] 播种完成即可
```

**4. 访问与验收**

- 浏览器打开 `PUBLIC_BASE_URL`（如 `http://公网IP:3000`）
- 使用短信验证码登录（管理员亦可用登录名 + 密码）
- API 全流程自检需临时开演示码：见 `scripts/verify-entrust-flow.mjs` 说明

**5. 可选：订单超时 crontab**

```bash
chmod +x scripts/cron-order-timeouts.sh
# crontab -e 添加：
# 0 * * * * /opt/lezyou/scripts/cron-order-timeouts.sh >> /var/log/lezyou-cron.log 2>&1
```

内测通过后，再切 `.env.production.example`、配 Nginx + HTTPS 即可进入正式环境。

### 部署到阿里云服务器（国内使用 · 推荐 Docker）

本仓库已内置容器化部署：`Dockerfile` + `docker-compose.yml`（应用 + PostgreSQL）+ Nginx 反代示例。
本地开发仍用 SQLite（`prisma/schema.prisma`），生产用 PostgreSQL（`prisma/schema.production.prisma`），两套 datasource 共享同一份模型，互不影响。

**0. 准备阿里云 ECS**

- 购买一台 ECS（建议 2核4G 起；操作系统 Ubuntu 22.04 / Alibaba Cloud Linux）。
- 安全组放行入方向端口：`80`、`443`（如需临时用 IP 测试再放行 `3000`）。
- 备案：面向国内、使用域名 + 80/443 对外，**域名需在阿里云完成 ICP 备案**。

**1. 安装 Docker（在 ECS 上）**

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
# 国内拉取镜像慢可配置加速器（阿里云容器镜像服务控制台获取你的专属地址）
```

**2. 上传代码并配置环境变量**

```bash
# 方式一：git clone 你的仓库；方式二：scp 上传项目目录
cd /opt/lezyou               # 项目目录
cp .env.production.example .env
vi .env                      # 填写 POSTGRES_PASSWORD、AUTH_SECRET 等
# 生成强随机密钥：openssl rand -base64 48
```

`.env` 关键项：

- `POSTGRES_PASSWORD`：数据库密码（务必改强密码）
- `AUTH_SECRET`：会话签名密钥（`openssl rand -base64 48`）
- `COOKIE_SECURE`：配好 HTTPS 后设 `true`；仅用 `http://公网IP` 临时测试时设 `false`，否则无法登录
- `DEMO_CODE_ENABLED`：正式默认 `off`；须配置 `SMS_PROVIDER` 及短信密钥。仅本地调试可临时 `on`

**3. 构建并启动**

```bash
docker compose up -d --build      # 首次构建+启动（entrypoint 自动 db push；空库自动 seed）
docker compose logs -f app        # 看到 Ready 即启动成功
# 若需手动重播种：docker compose exec app npm run prod:db:seed
```

此时应用监听在 `127.0.0.1:3000`（仅本机），通过下面的 Nginx 对外。

**4. 配置 Nginx 反向代理 + HTTPS**

```bash
apt-get install -y nginx
cp deploy/nginx.conf.example /etc/nginx/conf.d/lezyou.conf
vi /etc/nginx/conf.d/lezyou.conf  # 把 your-domain.com 改为你的域名
nginx -t && systemctl reload nginx
```

HTTPS 证书二选一：

- **阿里云免费 SSL 证书**：控制台申请 → 下载 Nginx 格式 → 填到配置的 `ssl_certificate` / `ssl_certificate_key` → 启用 443 段。
- **certbot**：`apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d your-domain.com`

证书就绪后在 Nginx 配置启用 80→443 跳转，并把 `.env` 的 `COOKIE_SECURE=true` 后 `docker compose up -d`。

**5. 升级 / 维护**

```bash
git pull                          # 或重新上传代码
docker compose up -d --build      # 重新构建并滚动重启（数据保存在 pgdata 卷，不丢失）
docker compose exec app npm run prod:db:push   # 模型有变更时同步表结构
```

> 不用 Docker 也可：在 ECS 上装 Node 20 + PostgreSQL，设置 `DATABASE_URL`，执行
> `npm ci && npm run prod:db:push && npm run prod:db:seed && npm run prod:build`，再用 `pm2 start "npm run prod:start"` 守护进程。

#### 上线前须知（国内环境）

- **登录验证码**：仓库默认 `DEMO_CODE_ENABLED=off`，须配置 `SMS_*`。请在 `src/lib/server/sms.ts` 补全**阿里云短信** dysmsapi 调用（当前为占位日志）。
- **支付**：已内置「沙箱 / 微信支付 / 支付宝」三渠道，默认 `sandbox`（免凭证即可走通下单→扫码→托管→验收）。接入真实渠道见下方「支付渠道接入」。
- **图片**：演示头像/作品图来自 `dicebear`、`unsplash` 等境外站点，国内访问可能较慢或失败；正式上线建议将素材迁移到**阿里云 OSS**，并更新 `next.config.mjs` 的 `images.remotePatterns`。
- **用阿里云 RDS**（而非内置 db 容器）：删除 `docker-compose.yml` 的 `db` 服务，在 `app.environment` 直接写 `DATABASE_URL=postgresql://...rds-host:5432/lezyou?schema=public` 即可。

#### 支付渠道接入（微信支付 / 支付宝）

平台用「分阶段托管」模型：委托人对每个付款阶段发起支付 → 扫码完成 → 资金进入平台托管（设计师侧冻结）→ 验收后解冻并扣 8% 手续费。支付编排在 `src/lib/server/payment-service.ts`，渠道实现在 `src/lib/server/payment/`。

切换渠道只需设环境变量 `PAYMENT_PROVIDER`：

- `sandbox`（默认）：免凭证，扫码弹窗中点「模拟支付成功」即到账，用于演示/试运营。
- `wechat`：微信支付 V3 · Native 扫码。需在 `.env` 配置：
  `WECHAT_PAY_APPID` / `WECHAT_PAY_MCH_ID` / `WECHAT_PAY_SERIAL_NO` / `WECHAT_PAY_PRIVATE_KEY`（商户 API 私钥）/ `WECHAT_PAY_APIV3_KEY`（回调解密）/ `WECHAT_PAY_PLATFORM_PUBLIC_KEY`（回调验签）。
- `alipay`：支付宝当面付（precreate）扫码。需配置：
  `ALIPAY_APP_ID` / `ALIPAY_PRIVATE_KEY`（应用私钥）/ `ALIPAY_PUBLIC_KEY`（回调验签）。

**必须配置 `PUBLIC_BASE_URL`** 为公网可访问的站点根地址（如 `https://your-domain.com`），用于拼接异步回调 `notify_url`：

- 微信回调：`POST {PUBLIC_BASE_URL}/api/payments/notify/wechat`
- 支付宝回调：`POST {PUBLIC_BASE_URL}/api/payments/notify/alipay`

在微信支付商户平台 / 支付宝开放平台把上述地址登记为回调地址即可。回调路由已实现验签、（微信）AES-GCM 解密与幂等落账。

> 说明：微信/支付宝两套渠道代码已按官方签名/验签算法实现，但**真实凭证需你方提供后联调**；沙箱渠道已端到端验证可用。结算到设计师可提现的「提现打款」（企业付款到零钱 / 转账）属另一独立能力，待商户开通对应权限后在 `releaseStage` 附近扩展。

---

## 演示主线(端到端走一遍)

1. **首页** `/` → 看品牌叙事 + 发布委托项目 / 浏览设计师入口 + 五大专业入口 + 增值服务介绍 + 热门设计师 + 悬赏 + 平台流程。
2. **找设计** `/designers` → 多维度筛选(专业 / **团队规模** / **设计师等级** / 负荷 / 所在地区 / 在线 / 出差 / 手改图)。
4. **设计师主页** `/designers/designer_chen` → 等级徽章 + 区域梯队、**三维评价 + 印象标签**、作品集、档期、收藏按钮、下单 CTA。
5. **三步下单** `/order/new?designer=designer_chen` →
   - Step 1 选服务模式(线上 / 上门) + 计费模式(按天 / 按月)。
   - Step 2 填项目名称 / 子专业 / 类型 / 描述 / **加购审图 + 项目管理**。
   - Step 3 看 30/40/30 分阶段付款方案,合同自动生成提示。
6. **费用计算器** `/calculator` → 按面积 / 按时间两套 v1.1 公式，所有系数透明展示。
7. **委托人工作台** `/client` → 看到刚才的新订单出现在「我的订单」。
8. **我的收藏** `/client/favorites` → 收藏的设计师可按专业/关键词二次筛选、一键清空。
9. **订单详情(委托人视角)** `/client/orders/order_001` → 阶段付款时间线、文件预览/下载锁、合同入口、返修按钮、消息记录。
10. 右下角 **演示身份切换器** → 切到「设计师 · 陈牧之」。
11. **设计师工作台** `/designer` → 看忙闲负荷三档切换、状态控件、收入趋势。
12. **同一笔订单(设计师视角)** `/designer/orders/order_001` → 上传成果、接收返修按钮。
13. **设计师钱包** `/designer/wallet` → 可提现 / 冻结中 / 累计收入,提现弹窗。
14. 切到 **管理员** → `/admin` → 资质审核队列(设计师入驻 + 企业认证两 tab)、用户管理表格、手续费配置。

---

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS + shadcn/ui 风格组件 + lucide-react 图标 |
| 状态 | Zustand(身份切换 + Toast + 草稿订单) |
| 表单 | react-hook-form + zod(预装,Phase B 用) |
| 图表 | recharts |
| 图片 | next/image + Unsplash CDN(已在 next.config.mjs 白名单) |
| Mock | `src/mocks/*.ts` |

---

## 目录结构

```
.
├── app/
│   ├── (public)/            公共域路由组(含顶部导航 + footer)
│   │   ├── page.tsx         首页
│   │   ├── designers/       设计师列表 + 主页
│   │   ├── bounties/        悬赏大厅 + 详情 + 发布
│   │   ├── order/new/       三步下单流程
│   │   └── login/           登录 + 身份选择
│   ├── client/              委托人控制台(共享 sidebar layout)
│   ├── designer/            设计师控制台(共享 sidebar layout)
│   ├── admin/               管理员后台(共享 sidebar layout)
│   ├── globals.css
│   └── layout.tsx           根 layout · 含 Toaster + 身份切换器 FAB
├── src/
│   ├── components/
│   │   ├── ui/              shadcn 风格原子组件(Button/Card/Tabs/Dialog/Switch/Select 等)
│   │   ├── domain/          业务组件(DesignerCard/OrderRow/StageTimeline/StatusControls 等)
│   │   └── layout/          PublicHeader/PublicFooter/ConsoleShell/RoleSwitcherFab
│   ├── lib/                 utils, types, constants
│   ├── mocks/               designers / clients / orders / bounties / wallet / reviews
│   └── store/               Zustand stores(role, session)
├── tailwind.config.ts
├── next.config.mjs
└── package.json
```

---

## 关键产品要点(对照 PRD)

- **三大状态可视化**:在线状态(头像角标绿点)、负荷状态(胶囊标签三档)、活跃度指示灯(头像旁绿/黄/红)。
- **两种下单模式**:定向精准下单 + 悬赏发布招标。
- **两种计费模式**:按天计费(单价 × 天数)+ 按月雇佣(首月预付,20 号续约)。
- **分阶段付款**:30 / 40 / 30 默认方案,委托人付款后资金 30 天托管。
- **成果交付闭环**:设计师上传 → 委托人在线预览 → 付款解锁下载 → 资金进入设计师托管钱包。
- **返修与异议**:委托人申请返修,设计师接收并重传新版,循环到验收通过。
- **钱包与提现**:实时收入 / 冻结资金 / 可提现 / 平台手续费明细 / 6 月趋势图 / 一键提现。
- **资质审核**:设计师入驻 + 企业委托人营业执照,两 tab 队列管理。
- **手续费配置**:费率与冻结周期可在管理员后台调整。
- **【v1.1】五大专业三级层级 + 设计师 / 客户 / 区域 / 项目类型 多重系数取费**。
- **【v1.1】多语言切换 + 收藏系统 + 三维评价 + 印象标签**。
- **【v1.1】审图与项目管理两项增值服务**，可在下单流程加购。

---

## 本地调试辅助（默认关闭，勿用于公开部署）

- **右下角身份切换器**：仅当 `NEXT_PUBLIC_DEMO_MODE=on`（或部署时 `ENABLE_DEMO_UI=true`）时显示。
- **固定验证码**：仅当 `DEMO_CODE_ENABLED=on` 时启用（配合 `DEMO_VERIFICATION_CODE`）。
- **本地状态持久化**：部分 UI 状态存于浏览器 localStorage。

---

## Phase B 已完成扩展

| 路由 | 说明 |
|------|------|
| `/onboarding/designer` | 设计师入驻 5 步向导(基础 → 专业 → 作品 → 服务 → 档期 + 提交) |
| `/onboarding/enterprise` | 企业委托人注册 + 营业执照 mock 上传 |
| `/contracts/[id]` | 电子合同预览 + 双方签署 + 区块链存证提示 |
| `/pay/[id]` | 兼容旧链接，重定向至订单详情并打开阶段支付弹窗 |
| `/admin/disputes` | 三档纠纷处理(待受理/处理中/已解决)+ 三方裁决操作 |
| `/client/monthly` | 按月雇佣续约中心 + 20 号窗口期提醒 + 自动续约管理 |

## 真实化下一步(Production Ready)

- 接入 Prisma + PostgreSQL,把 `src/mocks/*.ts` 替换为 Prisma 模型与 API Routes
- 接入真实支付:微信支付、支付宝
- 接入阿里云 / 腾讯云短信
- 接入 e签宝 或 法大大 真实电子合同
- 接入阿里云 OSS 文件上传
- 引入 NextAuth.js 做真实手机号 OTP 鉴权
- 引入 Sentry + Vercel Analytics + 阿里云 RAM 做监控

---

## 常见问题

**Q. 首次启动很慢?**
A. Next.js 首次访问每条路由都会编译,平均 1-3 秒。后续访问从内存缓存秒级加载。生产构建后无此问题。

**Q. 图片加载失败?**
A. 演示图来自 Unsplash CDN,需要可访问国际网络。可在 `next.config.mjs` 中加入其他可访问的图片源,或本地化资源。

**Q. 修改 mock 数据后要重启吗?**
A. 不用。修改 `src/mocks/*.ts` 后保存,Next 热更新会自动刷新页面。

---

© 2026 乐自由原型 · 内部演示用
