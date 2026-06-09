# 乐自由平台 · 数据库表说明

> Schema 定义：`prisma/schema.prisma`（本地 SQLite）/ `prisma/schema.production.prisma`（生产 PostgreSQL）  
> 两套 schema **模型完全一致**，仅 `datasource provider` 不同。

---

## 设计约定

- **PostgreSQL 表名**与 Prisma 模型名相同，首字母大写，查询时需加双引号，例如 `"User"`、`"Order"`。
- 多数业务表采用 **「索引列 + JSON」** 模式：
  - 少量字段用于筛选、排序、关联（如 `status`、`clientId`）
  - 完整业务对象序列化在 **`data` 列**（`String` 类型的 JSON 文本）
- **单例配置表**的 `id` 固定为 `"default"`，全库通常只有一行。

---

## 表总览（22 张）

| 分类 | 表名 | 一句话说明 |
|------|------|------------|
| 账号登录 | User | 平台账号（手机号、角色） |
| 账号登录 | Session | 登录会话 / Cookie |
| 账号登录 | VerificationCode | 手机验证码 |
| 角色资料 | Designer | 设计师资料 |
| 角色资料 | Client | 委托人资料 |
| 角色资料 | ServiceProvider | 审图师 / 项目管理员 |
| 订单交易 | Order | 委托订单 |
| 订单交易 | Bounty | 悬赏项目 |
| 订单交易 | ScanOrder | 扫码下单 |
| 订单交易 | ScheduleRequest | 档期申请 |
| 订单交易 | Payment | 分阶段支付单 |
| 订单交易 | Dispute | 订单纠纷 |
| 评价审核 | DesignerReview | 设计师历史评价 |
| 评价审核 | ReviewItem | 入驻审核工单 |
| 钱包财务 | WalletTransaction | 钱包流水 |
| 钱包财务 | WithdrawalRequest | 提现申请 |
| 钱包财务 | InvoiceRequest | 电子发票 |
| 平台配置 | PlatformPricing | 计价参数 |
| 平台配置 | LevelManagement | 等级管理 |
| 平台配置 | PlatformContent | FAQ / 协议等内容 |
| 平台配置 | ContractTemplates | 合同模板 |
| 客服 | FeedbackMessage | 在线留言 |

---

## 一、账号与登录

### User（用户表）

平台核心账号，一个账号可关联委托人（Client）和/或设计师（Designer）资料。

| 字段 | 说明 |
|------|------|
| id | 主键（cuid） |
| phone | 手机号，唯一；委托人/设计师登录用 |
| loginName | 管理员登录名，唯一；管理员/超管用 |
| passwordHash | 密码哈希（管理员等） |
| name | 显示名称 |
| avatar | 头像 URL |
| role | `client` / `designer` / `admin` / `super_admin` |
| status | `active` / `pending` / `disabled` |
| createdAt / updatedAt | 创建 / 更新时间 |

**关联：** `Designer`、`Client`、`Session`

---

### Session（登录会话）

存储 httpOnly Cookie 对应的会话 token。

| 字段 | 说明 |
|------|------|
| token | 会话 token，唯一 |
| userId | 关联 User |
| role | 当前会话角色 |
| identityId | 当前生效的业务身份 id |
| expiresAt | 过期时间 |

---

### VerificationCode（验证码）

注册 / 登录用的手机短信验证码。

| 字段 | 说明 |
|------|------|
| phone | 手机号 |
| code | 验证码 |
| purpose | `login` / `register` |
| consumed | 是否已使用 |
| expiresAt | 过期时间 |

---

## 二、角色资料

### Designer（设计师）

| 字段 | 说明 |
|------|------|
| id | 业务 id（如 designer_chen） |
| userId | 关联 User，可选 |
| name / avatar | 名称、头像 |
| subjectType | `individual` / `team` / `company` |
| specialty | 一级专业 |
| level | 设计师等级 |
| regionTier | 区域梯队 |
| location | 所在地区 |
| acceptingOrders | 是否接单 |
| rating | 评分 |
| dailyRate / monthlyRate | 日 / 月费率 |
| reviewStatus | `pending` / `approved` / `rejected` |
| code | 对外编号，如 DS000001 |
| **data** | JSON：作品集、档期、标签等完整 Designer 对象 |

---

### Client（委托人）

| 字段 | 说明 |
|------|------|
| id | 业务 id |
| userId | 关联 User |
| name / avatar | 名称、头像 |
| type | `individual` / `enterprise` |
| verified | 是否企业认证 |
| level | 客户等级（战略/优质/普通等） |
| **data** | JSON：完整 Client 对象 |

---

### ServiceProvider（增值服务方）

审图师、施工图项目管理员等第三方服务提供者。

| 字段 | 说明 |
|------|------|
| id | 主键 |
| name | 名称 |
| role | `auditor`（审图）/ `project_manager`（项目管理） |
| **data** | JSON：完整 ServiceProvider 对象 |

---

## 三、订单与交易

### Order（委托订单）

定向下单、三步下单产生的核心订单。

| 字段 | 说明 |
|------|------|
| id | 订单 id |
| code | 订单号，唯一 |
| title | 项目名称 |
| clientId | 委托人 id |
| designerId | 设计师 id，可选 |
| status | 订单状态（进行中/验收/结案等） |
| orderSource | 订单来源 |
| specialty | 专业 |
| totalAmount | 总金额（分） |
| **data** | JSON：分阶段付款、消息、返修、合同、文件等 |

---

### Bounty（悬赏）

委托人发布的悬赏招标项目。

| 字段 | 说明 |
|------|------|
| code | 悬赏编号 |
| publisherId | 发布人（委托人） |
| status | 悬赏状态 |
| reward | 赏金（分） |
| **data** | JSON：申请人列表等 |

---

### ScanOrder（扫码下单）

设计师二维码扫码产生的快捷下单。

| 字段 | 说明 |
|------|------|
| designerId | 设计师 |
| clientId | 委托人，可选 |
| status | 状态 |
| **data** | JSON：扫码下单详情 |

---

### ScheduleRequest（档期申请）

委托人向设计师申请档期的记录。

| 字段 | 说明 |
|------|------|
| orderId | 关联订单，可选 |
| designerId / clientId | 设计师 / 委托人 |
| status | 申请状态 |
| **data** | JSON：档期详情 |

---

### Payment（支付单）

某订单 **某一付款阶段** 的一次收款记录。

| 字段 | 说明 |
|------|------|
| orderId / stageId | 订单与阶段 |
| clientId | 付款委托人 |
| provider | `sandbox` / `wechat` / `alipay` |
| amount | 金额（分） |
| status | `pending` / `paid` / `failed` / `canceled` |
| outTradeNo | 商户订单号，唯一 |
| transactionId | 支付网关交易号 |
| data | 网关回调原文等 JSON |
| paidAt | 支付完成时间 |

---

### Dispute（订单纠纷）

订单争议、平台介入处理。

| 字段 | 说明 |
|------|------|
| orderId / orderCode | 关联订单 |
| clientId / designerId | 双方 |
| status | `open` / `in_review` / `resolved` |
| **data** | JSON：纠纷详情 |

---

## 四、评价与审核

### DesignerReview（设计师评价）

设计师完成项目后收到的历史评价。

| 字段 | 说明 |
|------|------|
| designerId | 设计师 |
| orderCode | 关联订单号 |
| overall | 综合评分 |
| **data** | JSON：专业/服务/响应三维度、印象标签等 |

---

### ReviewItem（入驻审核）

管理员审核队列：设计师入驻、企业认证。

| 字段 | 说明 |
|------|------|
| type | `designer` / `enterprise` |
| name | 申请人/企业名 |
| status | 审核状态 |
| **data** | JSON：审核材料与详情 |

---

## 五、钱包与财务

### WalletTransaction（钱包流水）

设计师 / 委托人的资金变动记录。

| 字段 | 说明 |
|------|------|
| ownerId / ownerType | 所属人 id 与类型（`designer` / `client`） |
| type | `income` / `withdraw` / `fee` / `refund` |
| amount | 金额（分） |
| status | `frozen` / `available` / `withdrawn` |
| **data** | JSON：完整流水详情 |
| occurredAt | 发生时间 |

---

### WithdrawalRequest（提现申请）

设计师申请提现到银行卡/微信等。

| 字段 | 说明 |
|------|------|
| status | 提现状态 |
| **data** | JSON：提现金额、账户等 |

---

### InvoiceRequest（电子发票）

委托人支付后自助开具的电子发票。

| 字段 | 说明 |
|------|------|
| invoiceNo | 发票号，唯一 |
| clientId | 委托人 |
| walletTransactionId | 关联钱包流水，唯一 |
| **data** | JSON：开票抬头、税号等 |
| issuedAt | 开具时间 |

---

## 六、平台配置（单例表）

以下表通常 **仅一行**，`id = "default"`。

| 表名 | data 中大致内容 |
|------|-----------------|
| **PlatformPricing** | 景观/建筑等费用公式、系数、加购项价格 |
| **LevelManagement** | 设计师等级、客户等级及费率系数 |
| **PlatformContent** | FAQ、入驻协议、关于我们、帮助文案 |
| **ContractTemplates** | 按服务类型划分的合同模板 |

---

## 七、客服

### FeedbackMessage（在线留言）

联系客服 / 意见反馈。

| 字段 | 说明 |
|------|------|
| audience | `client` / `designer` |
| userId / identityId | 留言用户 |
| userName / phone | 姓名、手机 |
| message | 留言内容 |
| status | `pending` / `replied` / `closed` |
| replyNote | 客服回复 |
| repliedAt | 回复时间 |

---

## 表关系简图

```text
User ──┬── Designer ──┬── Order
       │              ├── DesignerReview
       │              ├── ScanOrder
       │              ├── ScheduleRequest
       │              └── WalletTransaction (ownerType=designer)
       │
       ├── Client ────┬── Order
       │              ├── Bounty (publisherId)
       │              ├── Payment
       │              ├── InvoiceRequest
       │              └── WalletTransaction (ownerType=client)
       │
       └── Session

Order ── Payment / Dispute / ScheduleRequest
```

---

## 常用 SQL（PostgreSQL / ECS）

```bash
# 进入 psql
docker compose exec db psql -U lezyou -d lezyou
```

```sql
-- 列出所有表
\dt

-- 用户数量
SELECT COUNT(*) FROM "User";

-- 查看用户列表
SELECT id, phone, name, role, status FROM "User";

-- 订单列表
SELECT id, code, title, status, "totalAmount" FROM "Order";

-- 某设计师的订单
SELECT code, title, status FROM "Order" WHERE "designerId" = 'designer_chen';
```

---

## 演示账号（seed 后）

| 角色 | 手机号 |
|------|--------|
| 委托人 | 13800010000 |
| 设计师 | 13900010000 |
| 管理员 | 13700000000 |
| 超级管理员 | 13700000001 |

验证码（演示模式）：`888888`

---

## 相关文档

- 部署与数据库连接：[deploy/DEPLOY.md](../deploy/DEPLOY.md)
- Schema 源码：[prisma/schema.prisma](../prisma/schema.prisma)
- 生产 Schema：[prisma/schema.production.prisma](../prisma/schema.production.prisma)
