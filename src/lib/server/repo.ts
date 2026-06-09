import "server-only";
import { normalizeBountyTrack } from "@/lib/bounty-tracks";
import { prisma } from "./db";
import type {
  AdminClientRow,
  AdminDesignerRow,
  Bounty,
  Client,
  Designer,
  ClientLevel,
  DesignerLevel,
  DesignerProjectReview,
  FeedbackMessage,
  InvoiceRequest,
  Dispute,
  Order,
  ReviewItem,
  ScheduleRequest,
  WalletTransaction,
} from "@/lib/types";
import {
  normalizePlatformContent,
  type PlatformContentConfig,
} from "@/lib/platform-content";
import {
  DEFAULT_CLIENT_LEVEL,
  DEFAULT_DESIGNER_LEVEL,
  LEVEL_CATEGORIES,
  normalizeLevelManagement,
  type CategoryLevelStats,
  type LevelCategory,
  type LevelManagementConfig,
  type ManagedLevel,
} from "@/lib/level-management";
import { demoFeedbackMessages } from "@/mocks/feedback-messages";
import type { ServiceProvider } from "@/mocks/service-providers";
import {
  normalizePricingConfig,
  type PlatformPricingConfig,
} from "@/lib/platform-pricing";
import { formatClientCode } from "@/lib/client-code";
import { formatDesignerCode, normalizeDesignerCode } from "@/lib/designer-code";
import { clients as mockClients } from "@/mocks/clients";
import { designers as mockDesigners } from "@/mocks/designers";
import { reviewQueue } from "@/mocks/reviews";
import { demoDisputes } from "@/mocks/disputes";
import { withdrawalRequests as demoWithdrawals } from "@/mocks/withdrawals";
import {
  normalizeContractTemplates,
  type ContractTemplatesConfig,
} from "@/lib/contract-templates";
import { demoDataEnabled } from "./demo-data";
import type {
  WithdrawalRequest,
  WithdrawalRequestStatus,
} from "@/lib/withdrawal-requests";

function parse<T>(json: string): T {
  return JSON.parse(json) as T;
}

type DesignerRow = { data: string; code: string | null };

function mergeDesignerRow(row: DesignerRow): Designer {
  const d = parse<Designer>(row.data);
  const code = d.code || row.code || "";
  return { ...d, code };
}

function mergeDesignerContact(
  row: DesignerRow & { user?: { phone: string | null } | null },
): Designer {
  const designer = mergeDesignerRow(row);
  const phone = row.user?.phone ?? designer.phone;
  return phone ? { ...designer, phone } : designer;
}

/** 分配唯一的设计师对外编号 */
export async function allocateDesignerCode(): Promise<string> {
  const count = await prisma.designer.count();
  for (let i = 0; i < 20; i++) {
    const code = formatDesignerCode(count + 1 + i);
    const exists = await prisma.designer.findUnique({ where: { code } });
    if (!exists) return code;
  }
  return `DS${Date.now().toString().slice(-6)}`;
}

/** 分配唯一的委托人对外编号 */
export async function allocateClientCode(): Promise<string> {
  const rows = await prisma.client.findMany({ select: { data: true } });
  let maxSeq = 0;
  for (const row of rows) {
    const c = parse<Client>(row.data);
    const match = c.code?.match(/^CL(\d+)$/i);
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]));
  }
  for (let i = 0; i < 20; i++) {
    const code = formatClientCode(maxSeq + 1 + i);
    const taken = rows.some((r) => parse<Client>(r.data).code === code);
    if (!taken) return code;
  }
  return `CL${Date.now().toString().slice(-6)}`;
}

function sumClientTotalPaid(transactions: WalletTransaction[]): number {
  return Math.abs(
    transactions
      .filter((t) => t.type === "income" && t.amount < 0)
      .reduce((acc, t) => acc + t.amount, 0),
  );
}

/* ---------------- 设计师 ---------------- */

export async function listDesigners(): Promise<Designer[]> {
  const rows = await prisma.designer.findMany({
    where: { reviewStatus: "approved" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { phone: true } } },
  });
  return rows.map((r) => mergeDesignerContact(r));
}

const ONGOING_ORDER_STATUSES = new Set([
  "matching",
  "pending_schedule",
  "pending_contract",
  "in_progress",
  "pending_review",
  "in_revision",
]);

/** 管理员查看设计师列表（含注册手机号、账号状态、进行中订单数） */
export async function listDesignersForAdmin() {
  const rows = await prisma.designer.findMany({
    where: { reviewStatus: "approved" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, phone: true, status: true } },
    },
  });

  const orderRows = await prisma.order.findMany({
    select: { designerId: true, status: true },
  });
  const ongoingByDesigner = new Map<string, number>();
  for (const o of orderRows) {
    if (!o.designerId) continue;
    if (ONGOING_ORDER_STATUSES.has(o.status)) {
      ongoingByDesigner.set(
        o.designerId,
        (ongoingByDesigner.get(o.designerId) ?? 0) + 1,
      );
    }
  }

  return rows.map((r) => ({
    ...mergeDesignerRow(r),
    phone: r.user?.phone,
    userId: r.user?.id,
    accountStatus: (r.user?.status ?? "active") as "active" | "disabled",
    ongoingOrdersCount: ongoingByDesigner.get(r.id) ?? 0,
    registeredAt: r.createdAt.toISOString(),
  }));
}

export async function getDesigner(id: string): Promise<Designer | null> {
  const row = await prisma.designer.findUnique({
    where: { id },
    include: { user: { select: { phone: true } } },
  });
  return row ? mergeDesignerContact(row) : null;
}

export async function getDesignerByCode(code: string): Promise<Designer | null> {
  const normalized = normalizeDesignerCode(code);
  if (!normalized) return null;
  const row = await prisma.designer.findUnique({
    where: { code: normalized },
    include: { user: { select: { phone: true } } },
  });
  if (row) return mergeDesignerContact(row);
  const rows = await prisma.designer.findMany({
    include: { user: { select: { phone: true } } },
  });
  for (const r of rows) {
    const d = mergeDesignerContact(r);
    if (normalizeDesignerCode(d.code) === normalized) return d;
  }
  return null;
}

export async function saveDesigner(designer: Designer) {
  await prisma.designer.update({
    where: { id: designer.id },
    data: {
      name: designer.name,
      avatar: designer.avatar,
      subjectType: designer.subjectType ?? "individual",
      specialty: designer.specialty,
      level: designer.level,
      regionTier: designer.regionTier,
      location: designer.location,
      acceptingOrders: designer.acceptingOrders ?? true,
      rating: designer.rating,
      dailyRate: designer.dailyRate,
      monthlyRate: designer.monthlyRate,
      code: designer.code || null,
      data: JSON.stringify(designer),
    },
  });
}

/** 管理员设置设计师等级（同步列字段与 JSON 数据） */
export async function updateDesignerLevel(
  id: string,
  level: DesignerLevel
): Promise<Designer | null> {
  const designer = await getDesigner(id);
  if (!designer) return null;
  designer.level = level;
  await prisma.designer.update({
    where: { id },
    data: { level, data: JSON.stringify(designer) },
  });
  return designer;
}

/** 冻结 / 解冻设计师关联账号 */
export async function setDesignerAccountStatus(
  designerId: string,
  status: "active" | "disabled",
) {
  const row = await prisma.designer.findUnique({
    where: { id: designerId },
    select: { userId: true },
  });
  if (!row?.userId) return null;
  await prisma.user.update({
    where: { id: row.userId },
    data: { status },
  });
  if (status === "disabled") {
    await prisma.session.deleteMany({ where: { userId: row.userId } });
  }
  return { userId: row.userId, status };
}

/** 管理员全量更新设计师资料与账号信息 */
export async function updateDesignerForAdmin(
  id: string,
  designer: Designer,
  opts?: { phone?: string; name?: string },
) {
  const row = await prisma.designer.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!row) return null;

  await saveDesigner(designer);

  if (row.userId) {
    const userData: { phone?: string; name?: string; avatar?: string | null } =
      {};
    if (opts?.phone) userData.phone = opts.phone;
    if (opts?.name) userData.name = opts.name;
    if (designer.avatar !== undefined) userData.avatar = designer.avatar;
    if (Object.keys(userData).length > 0) {
      await prisma.user.update({ where: { id: row.userId }, data: userData });
    }
  }

  return getDesigner(id);
}

/** 超级管理员删除设计师及其关联账号 */
export async function deleteDesignerForAdmin(designerId: string) {
  const row = await prisma.designer.findUnique({
    where: { id: designerId },
    select: { userId: true },
  });
  if (!row) return false;
  if (row.userId) {
    await prisma.session.deleteMany({ where: { userId: row.userId } });
    await prisma.user.delete({ where: { id: row.userId } });
  }
  await prisma.designer.delete({ where: { id: designerId } });
  return true;
}

/* ---------------- 委托人 ---------------- */

export async function getClient(id: string): Promise<Client | null> {
  const row = await prisma.client.findUnique({ where: { id } });
  return row ? parse<Client>(row.data) : null;
}

export async function listClients(): Promise<Client[]> {
  const rows = await prisma.client.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => parse<Client>(r.data));
}

/** 管理员查看委托人列表（含手机号、账号状态、订单与支付统计） */
export async function listClientsForAdmin(): Promise<AdminClientRow[]> {
  const rows = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, phone: true, status: true } } },
  });

  const orderRows = await prisma.order.findMany({
    select: { clientId: true, status: true },
  });
  const ongoingByClient = new Map<string, number>();
  for (const o of orderRows) {
    if (ONGOING_ORDER_STATUSES.has(o.status)) {
      ongoingByClient.set(
        o.clientId,
        (ongoingByClient.get(o.clientId) ?? 0) + 1,
      );
    }
  }

  const walletRows = await prisma.walletTransaction.findMany({
    where: { ownerType: "client" },
    select: { ownerId: true, data: true },
  });
  const paidByClient = new Map<string, number>();
  for (const w of walletRows) {
    const tx = parse<WalletTransaction>(w.data);
    if (tx.type === "income" && tx.amount < 0) {
      paidByClient.set(
        w.ownerId,
        (paidByClient.get(w.ownerId) ?? 0) + Math.abs(tx.amount),
      );
    }
  }

  return rows.map((r, index) => {
    const client = parse<Client>(r.data);
    const code = client.code || formatClientCode(index + 1);
    return {
      ...client,
      code,
      phone: r.user?.phone ?? client.phone,
      userId: r.user?.id,
      accountStatus: (r.user?.status ?? "active") as "active" | "disabled",
      ongoingOrdersCount: ongoingByClient.get(r.id) ?? 0,
      totalPaidAmount: paidByClient.get(r.id) ?? 0,
      registeredAt: r.createdAt.toISOString(),
    };
  });
}

export async function saveClient(client: Client) {
  await prisma.client.update({
    where: { id: client.id },
    data: {
      name: client.name,
      avatar: client.avatar,
      type: client.type,
      verified: client.verified,
      level: client.level,
      data: JSON.stringify(client),
    },
  });
}

export async function setClientAccountStatus(
  clientId: string,
  status: "active" | "disabled",
) {
  const row = await prisma.client.findUnique({
    where: { id: clientId },
    select: { userId: true },
  });
  if (!row?.userId) return null;
  await prisma.user.update({
    where: { id: row.userId },
    data: { status },
  });
  if (status === "disabled") {
    await prisma.session.deleteMany({ where: { userId: row.userId } });
  }
  return { userId: row.userId, status };
}

/** 管理员全量更新委托人资料与账号信息 */
export async function updateClientForAdmin(
  id: string,
  client: Client,
  opts?: { phone?: string; name?: string },
) {
  const row = await prisma.client.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!row) return null;

  await saveClient(client);

  if (row.userId) {
    const userData: { phone?: string; name?: string; avatar?: string | null } =
      {};
    if (opts?.phone) userData.phone = opts.phone;
    if (opts?.name) userData.name = opts.name;
    if (client.avatar !== undefined) userData.avatar = client.avatar;
    if (Object.keys(userData).length > 0) {
      await prisma.user.update({ where: { id: row.userId }, data: userData });
    }
  }

  return getClient(id);
}

/** 超级管理员删除委托人及其关联账号 */
export async function deleteClientForAdmin(clientId: string) {
  const row = await prisma.client.findUnique({
    where: { id: clientId },
    select: { userId: true },
  });
  if (!row) return false;
  if (row.userId) {
    await prisma.session.deleteMany({ where: { userId: row.userId } });
    await prisma.user.delete({ where: { id: row.userId } });
  }
  await prisma.client.delete({ where: { id: clientId } });
  return true;
}

/** 管理员查看委托人付款流水 */
export async function listClientPaymentsForAdmin(clientId: string) {
  const transactions = await listWalletTransactions(clientId, "client");
  return {
    transactions,
    totalPaidAmount: sumClientTotalPaid(transactions),
  };
}

/* ---------------- 订单 ---------------- */

export async function listOrders(filter?: {
  clientId?: string;
  designerId?: string;
}): Promise<Order[]> {
  const rows = await prisma.order.findMany({
    where: {
      clientId: filter?.clientId,
      designerId: filter?.designerId,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => parse<Order>(r.data));
}

export async function getOrder(id: string): Promise<Order | null> {
  const row = await prisma.order.findUnique({ where: { id } });
  return row ? parse<Order>(row.data) : null;
}

export async function findOrderByContractId(
  contractId: string,
): Promise<Order | null> {
  const rows = await prisma.order.findMany({ select: { data: true } });
  for (const row of rows) {
    const order = parse<Order>(row.data);
    if (order.contractId === contractId) return order;
  }
  return null;
}

export async function toggleClientFavorite(
  clientId: string,
  designerId: string,
): Promise<Client | null> {
  const client = await getClient(clientId);
  if (!client) return null;
  const ids = client.favoriteDesignerIds ?? [];
  client.favoriteDesignerIds = ids.includes(designerId)
    ? ids.filter((id) => id !== designerId)
    : [...ids, designerId];
  await saveClient(client);
  return client;
}

export async function createOrder(order: Order) {
  await prisma.order.create({
    data: {
      id: order.id,
      code: order.code,
      title: order.title,
      clientId: order.clientId,
      designerId: order.designerId,
      status: order.status,
      orderSource: order.orderSource,
      specialty: order.specialty,
      totalAmount: order.totalAmount,
      data: JSON.stringify(order),
    },
  });
  return order;
}

export async function saveOrder(order: Order) {
  await prisma.order.update({
    where: { id: order.id },
    data: {
      title: order.title,
      designerId: order.designerId,
      status: order.status,
      totalAmount: order.totalAmount,
      data: JSON.stringify(order),
    },
  });
  return order;
}

/* ---------------- 悬赏 ---------------- */

function normalizeBountyData(bounty: Bounty): Bounty {
  return {
    ...bounty,
    primaryTrack: normalizeBountyTrack(bounty.primaryTrack),
  };
}

export async function listBounties(): Promise<Bounty[]> {
  const rows = await prisma.bounty.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((r) => normalizeBountyData(parse<Bounty>(r.data)));
}

export async function getBounty(id: string): Promise<Bounty | null> {
  const row = await prisma.bounty.findUnique({ where: { id } });
  return row ? normalizeBountyData(parse<Bounty>(row.data)) : null;
}

export async function createBounty(bounty: Bounty) {
  await prisma.bounty.create({
    data: {
      id: bounty.id,
      code: bounty.code,
      title: bounty.title,
      publisherId: bounty.publisherId,
      status: bounty.status,
      specialty: bounty.specialty,
      reward: bounty.reward,
      data: JSON.stringify(bounty),
    },
  });
  return bounty;
}

export async function saveBounty(bounty: Bounty) {
  await prisma.bounty.update({
    where: { id: bounty.id },
    data: {
      title: bounty.title,
      status: bounty.status,
      reward: bounty.reward,
      data: JSON.stringify(bounty),
    },
  });
  return bounty;
}

export async function deleteBounty(id: string) {
  await prisma.bounty.delete({ where: { id } });
}

/* ---------------- 服务方 ---------------- */

export async function listServiceProviders(): Promise<ServiceProvider[]> {
  const rows = await prisma.serviceProvider.findMany();
  return rows.map((r) => parse<ServiceProvider>(r.data));
}

/* ---------------- 设计师评价 ---------------- */

export async function listDesignerReviews(
  designerId: string
): Promise<DesignerProjectReview[]> {
  const rows = await prisma.designerReview.findMany({
    where: { designerId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => parse<DesignerProjectReview>(r.data));
}

export async function createDesignerReview(review: DesignerProjectReview) {
  await prisma.designerReview.create({
    data: {
      id: review.id,
      designerId: review.designerId,
      orderCode: review.orderCode ?? null,
      overall: review.overall,
      data: JSON.stringify(review),
    },
  });
  return review;
}

/* ---------------- 钱包 ---------------- */

export async function listWalletTransactions(
  ownerId: string,
  ownerType: "designer" | "client"
): Promise<WalletTransaction[]> {
  const rows = await prisma.walletTransaction.findMany({
    where: { ownerId, ownerType },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map((r) => parse<WalletTransaction>(r.data));
}

export async function createWalletTransaction(
  ownerId: string,
  ownerType: "designer" | "client",
  tx: WalletTransaction
) {
  await prisma.walletTransaction.create({
    data: {
      id: tx.id,
      ownerId,
      ownerType,
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      data: JSON.stringify(tx),
    },
  });
  return tx;
}

export async function updateWalletTransaction(tx: WalletTransaction) {
  await prisma.walletTransaction.update({
    where: { id: tx.id },
    data: {
      type: tx.type,
      amount: tx.amount,
      status: tx.status,
      data: JSON.stringify(tx),
    },
  });
  return tx;
}

export async function getWalletTransactionForOwner(
  id: string,
  ownerId: string,
  ownerType: "designer" | "client",
): Promise<WalletTransaction | null> {
  const row = await prisma.walletTransaction.findFirst({
    where: { id, ownerId, ownerType },
  });
  if (!row) return null;
  return parse<WalletTransaction>(row.data);
}

/* ---------------- 发票 ---------------- */

export async function listInvoicesByClient(clientId: string): Promise<InvoiceRequest[]> {
  const rows = await prisma.invoiceRequest.findMany({
    where: { clientId },
    orderBy: { issuedAt: "desc" },
  });
  return rows.map((r) => parse<InvoiceRequest>(r.data));
}

export async function getInvoiceByWalletTransactionId(
  walletTransactionId: string,
): Promise<InvoiceRequest | null> {
  const row = await prisma.invoiceRequest.findUnique({
    where: { walletTransactionId },
  });
  if (!row) return null;
  return parse<InvoiceRequest>(row.data);
}

export async function getInvoiceById(id: string): Promise<InvoiceRequest | null> {
  const row = await prisma.invoiceRequest.findUnique({ where: { id } });
  if (!row) return null;
  return parse<InvoiceRequest>(row.data);
}

export async function createInvoiceRequest(invoice: InvoiceRequest) {
  await prisma.invoiceRequest.create({
    data: {
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      clientId: invoice.clientId,
      walletTransactionId: invoice.walletTransactionId,
      data: JSON.stringify(invoice),
      issuedAt: new Date(invoice.issuedAt),
    },
  });
  return invoice;
}

export async function countInvoicesIssuedToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.invoiceRequest.count({
    where: { issuedAt: { gte: start } },
  });
}

/* ---------------- 审核工单 ---------------- */

function mergeDemoReviewItems(dbItems: ReviewItem[]): ReviewItem[] {
  const byId = new Map(dbItems.map((item) => [item.id, item]));
  if (demoDataEnabled()) {
    for (const demo of reviewQueue) {
      if (!byId.has(demo.id)) byId.set(demo.id, demo);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

export async function listReviewItems(): Promise<ReviewItem[]> {
  const rows = await prisma.reviewItem.findMany({
    orderBy: { submittedAt: "desc" },
  });
  return mergeDemoReviewItems(rows.map((r) => parse<ReviewItem>(r.data)));
}

export async function getReviewItem(id: string): Promise<ReviewItem | null> {
  const row = await prisma.reviewItem.findUnique({ where: { id } });
  if (row) return parse<ReviewItem>(row.data);
  return demoDataEnabled()
    ? (reviewQueue.find((r) => r.id === id) ?? null)
    : null;
}

export async function createReviewItem(item: ReviewItem): Promise<ReviewItem> {
  await prisma.reviewItem.create({
    data: {
      id: item.id,
      type: item.type,
      name: item.name,
      status: item.status,
      submittedAt: new Date(item.submittedAt),
      data: JSON.stringify(item),
    },
  });
  return item;
}

export async function updateReviewItemStatus(
  id: string,
  status: ReviewItem["status"]
): Promise<ReviewItem | null> {
  const item = await getReviewItem(id);
  if (!item) return null;
  const updated = { ...item, status };
  const row = await prisma.reviewItem.findUnique({ where: { id } });
  if (row) {
    await prisma.reviewItem.update({
      where: { id },
      data: { status, data: JSON.stringify(updated) },
    });
  } else {
    await prisma.reviewItem.create({
      data: {
        id: updated.id,
        type: updated.type,
        name: updated.name,
        status: updated.status,
        submittedAt: new Date(updated.submittedAt),
        data: JSON.stringify(updated),
      },
    });
  }
  return updated;
}

/** 是否已存在某设计师的待处理晋升工单（去重用） */
export async function hasPendingPromotion(
  designerId: string
): Promise<boolean> {
  const rows = await prisma.reviewItem.findMany({
    where: {
      type: { in: ["designer_promotion", "designer_level_promotion"] },
      status: "pending",
    },
  });
  return rows.some((r) => parse<ReviewItem>(r.data).refId === designerId);
}

/* ---------------- 档期申请 ---------------- */

export async function listScheduleRequests(filter?: {
  designerId?: string;
  clientId?: string;
}): Promise<ScheduleRequest[]> {
  const rows = await prisma.scheduleRequest.findMany({
    where: { designerId: filter?.designerId, clientId: filter?.clientId },
    orderBy: { submittedAt: "desc" },
  });
  return rows.map((r) => parse<ScheduleRequest>(r.data));
}

export async function createScheduleRequest(req: ScheduleRequest) {
  await prisma.scheduleRequest.create({
    data: {
      id: req.id,
      orderId: req.orderId,
      designerId: req.designerId,
      clientId: req.clientId,
      status: req.status,
      data: JSON.stringify(req),
    },
  });
  return req;
}

export async function getScheduleRequest(id: string): Promise<ScheduleRequest | null> {
  const row = await prisma.scheduleRequest.findUnique({ where: { id } });
  return row ? parse<ScheduleRequest>(row.data) : null;
}

export async function saveScheduleRequest(req: ScheduleRequest) {
  await prisma.scheduleRequest.update({
    where: { id: req.id },
    data: {
      orderId: req.orderId,
      designerId: req.designerId,
      clientId: req.clientId,
      status: req.status,
      data: JSON.stringify(req),
    },
  });
  return req;
}

/* ---------------- 支付单 ---------------- */

export interface PaymentRecord {
  id: string;
  orderId: string;
  stageId: string;
  clientId: string;
  provider: string;
  amount: number;
  status: string;
  outTradeNo: string;
  transactionId: string | null;
  data: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export async function createPayment(input: {
  orderId: string;
  stageId: string;
  clientId: string;
  provider: string;
  amount: number;
  outTradeNo: string;
}): Promise<PaymentRecord> {
  return prisma.payment.create({
    data: {
      orderId: input.orderId,
      stageId: input.stageId,
      clientId: input.clientId,
      provider: input.provider,
      amount: input.amount,
      outTradeNo: input.outTradeNo,
      status: "pending",
    },
  });
}

export async function getPayment(id: string): Promise<PaymentRecord | null> {
  return prisma.payment.findUnique({ where: { id } });
}

export async function getPaymentByOutTradeNo(
  outTradeNo: string
): Promise<PaymentRecord | null> {
  return prisma.payment.findUnique({ where: { outTradeNo } });
}

export async function updatePayment(
  id: string,
  patch: {
    status?: string;
    transactionId?: string | null;
    data?: string | null;
    paidAt?: Date | null;
  }
): Promise<PaymentRecord> {
  return prisma.payment.update({ where: { id }, data: patch });
}

/* ---------------- 平台计价参数 ---------------- */

export async function getPlatformPricing(): Promise<PlatformPricingConfig> {
  const row = await prisma.platformPricing.findUnique({ where: { id: "default" } });
  if (!row) return normalizePricingConfig({});
  return normalizePricingConfig(parse<PlatformPricingConfig>(row.data));
}

export async function savePlatformPricing(config: PlatformPricingConfig) {
  const normalized = normalizePricingConfig(config);
  await prisma.platformPricing.upsert({
    where: { id: "default" },
    create: { id: "default", data: JSON.stringify(normalized) },
    update: { data: JSON.stringify(normalized) },
  });
  return normalized;
}

/* ---------------- 等级管理 ---------------- */

export async function getLevelManagement(): Promise<LevelManagementConfig> {
  const row = await prisma.levelManagement.findUnique({ where: { id: "default" } });
  if (!row) return normalizeLevelManagement(null);
  return normalizeLevelManagement(
    parse<Record<string, ManagedLevel[] | undefined>>(row.data),
  );
}

export async function saveLevelManagement(config: LevelManagementConfig) {
  const normalized = normalizeLevelManagement(config);
  await prisma.levelManagement.upsert({
    where: { id: "default" },
    create: { id: "default", data: JSON.stringify(normalized) },
    update: { data: JSON.stringify(normalized) },
  });
  return normalized;
}

export async function getLevelManagementStats(): Promise<CategoryLevelStats[]> {
  const config = await getLevelManagement();
  let designers: AdminDesignerRow[] = await listDesignersForAdmin();
  let clients: AdminClientRow[] = await listClientsForAdmin();
  if (demoDataEnabled()) {
    if (designers.length === 0) designers = mockDesigners;
    if (clients.length === 0) clients = mockClients;
  }

  return LEVEL_CATEGORIES.map((category) => {
    const levels = config[category.key];
    const counts = new Map<string, number>();

    if (category.kind === "designer") {
      for (const designer of designers) {
        const levelId = designer.level ?? DEFAULT_DESIGNER_LEVEL;
        counts.set(levelId, (counts.get(levelId) ?? 0) + 1);
      }
    } else {
      for (const client of clients) {
        const levelId = client.level ?? DEFAULT_CLIENT_LEVEL;
        counts.set(levelId, (counts.get(levelId) ?? 0) + 1);
      }
    }

    const levelNameById = new Map(levels.map((level) => [level.id, level.name]));
    const knownIds = new Set(levels.map((level) => level.id));
    const statsLevels = levels.map((level) => ({
      levelId: level.id,
      levelName: level.name,
      count: counts.get(level.id) ?? 0,
    }));

    for (const [levelId, count] of counts) {
      if (!knownIds.has(levelId)) {
        statsLevels.push({
          levelId,
          levelName: levelNameById.get(levelId) ?? levelId,
          count,
        });
      }
    }

    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    return {
      category: category.key,
      categoryLabel: category.label,
      total,
      levels: statsLevels,
    };
  });
}

export async function migrateLevelUsers(params: {
  category: LevelCategory;
  fromLevelId: string;
  toLevelId: string;
}): Promise<{ migrated: number }> {
  const { category, fromLevelId, toLevelId } = params;
  if (!fromLevelId || !toLevelId || fromLevelId === toLevelId) {
    return { migrated: 0 };
  }

  let migrated = 0;

  if (category === "design_subject") {
    const rows = await prisma.designer.findMany();
    for (const row of rows) {
      const designer = mergeDesignerRow(row);
      const current = designer.level ?? DEFAULT_DESIGNER_LEVEL;
      if (current !== fromLevelId) continue;
      designer.level = toLevelId as DesignerLevel;
      await prisma.designer.update({
        where: { id: row.id },
        data: { level: toLevelId, data: JSON.stringify(designer) },
      });
      migrated += 1;
    }
  } else {
    const rows = await prisma.client.findMany();
    for (const row of rows) {
      const client = parse<Client>(row.data);
      const current = client.level ?? DEFAULT_CLIENT_LEVEL;
      if (current !== fromLevelId) continue;
      client.level = toLevelId as ClientLevel;
      await prisma.client.update({
        where: { id: row.id },
        data: { level: toLevelId, data: JSON.stringify(client) },
      });
      migrated += 1;
    }
  }

  return { migrated };
}

/* ---------------- 平台内容 ---------------- */

export async function getPlatformContent(): Promise<PlatformContentConfig> {
  const row = await prisma.platformContent.findUnique({ where: { id: "default" } });
  if (!row) return normalizePlatformContent(null);
  return normalizePlatformContent(parse<PlatformContentConfig>(row.data));
}

export async function savePlatformContent(config: PlatformContentConfig) {
  const normalized = normalizePlatformContent(config);
  await prisma.platformContent.upsert({
    where: { id: "default" },
    create: { id: "default", data: JSON.stringify(normalized) },
    update: { data: JSON.stringify(normalized) },
  });
  return normalized;
}

/* ---------------- 意见反馈 ---------------- */

function feedbackFromRow(row: {
  id: string;
  audience: string;
  userId: string | null;
  identityId: string | null;
  userName: string;
  phone: string | null;
  message: string;
  status: string;
  createdAt: Date;
  repliedAt: Date | null;
  replyNote: string | null;
}): FeedbackMessage {
  return {
    id: row.id,
    audience: row.audience as FeedbackMessage["audience"],
    userId: row.userId ?? undefined,
    identityId: row.identityId ?? undefined,
    userName: row.userName,
    phone: row.phone ?? undefined,
    message: row.message,
    status: row.status as FeedbackMessage["status"],
    createdAt: row.createdAt.toISOString(),
    repliedAt: row.repliedAt?.toISOString(),
    replyNote: row.replyNote ?? undefined,
  };
}

function mergeDemoFeedbackMessages(dbItems: FeedbackMessage[]): FeedbackMessage[] {
  if (!demoDataEnabled()) {
    return [...dbItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const ids = new Set(dbItems.map((item) => item.id));
  const demo = demoFeedbackMessages.filter((item) => !ids.has(item.id));
  return [...demo, ...dbItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function listFeedbackMessages(): Promise<FeedbackMessage[]> {
  const rows = await prisma.feedbackMessage.findMany({
    orderBy: { createdAt: "desc" },
  });
  return mergeDemoFeedbackMessages(rows.map(feedbackFromRow));
}

export async function createFeedbackMessage(input: {
  audience: FeedbackMessage["audience"];
  userId?: string;
  identityId?: string;
  userName: string;
  phone?: string;
  message: string;
}): Promise<FeedbackMessage> {
  const row = await prisma.feedbackMessage.create({
    data: {
      audience: input.audience,
      userId: input.userId,
      identityId: input.identityId,
      userName: input.userName,
      phone: input.phone,
      message: input.message,
      status: "pending",
    },
  });
  return feedbackFromRow(row);
}

export async function updateFeedbackMessage(
  id: string,
  patch: {
    status?: FeedbackMessage["status"];
    replyNote?: string;
  },
): Promise<FeedbackMessage | null> {
  const row = await prisma.feedbackMessage.update({
    where: { id },
    data: {
      status: patch.status,
      replyNote: patch.replyNote,
      repliedAt:
        patch.status === "replied" || patch.status === "closed"
          ? new Date()
          : undefined,
    },
  });
  return feedbackFromRow(row);
}

/* ---------------- 提现审批 ---------------- */

function mergeDemoWithdrawalRequests(
  dbItems: WithdrawalRequest[],
): WithdrawalRequest[] {
  const byId = new Map(dbItems.map((item) => [item.id, item]));
  if (demoDataEnabled()) {
    for (const demo of demoWithdrawals) {
      if (!byId.has(demo.id)) byId.set(demo.id, demo);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

export async function listWithdrawalRequests(): Promise<WithdrawalRequest[]> {
  const rows = await prisma.withdrawalRequest.findMany({
    orderBy: { submittedAt: "desc" },
  });
  return mergeDemoWithdrawalRequests(
    rows.map((r) => parse<WithdrawalRequest>(r.data)),
  );
}

export async function getWithdrawalRequest(
  id: string,
): Promise<WithdrawalRequest | null> {
  const row = await prisma.withdrawalRequest.findUnique({ where: { id } });
  if (row) return parse<WithdrawalRequest>(row.data);
  return demoDataEnabled()
    ? (demoWithdrawals.find((r) => r.id === id) ?? null)
    : null;
}

export async function updateWithdrawalRequestStatus(
  id: string,
  status: WithdrawalRequestStatus,
  patch?: { rejectReason?: string },
): Promise<WithdrawalRequest | null> {
  const item = await getWithdrawalRequest(id);
  if (!item) return null;

  const updated: WithdrawalRequest = {
    ...item,
    status,
    processedAt: new Date().toISOString(),
    rejectReason:
      status === "rejected" ? patch?.rejectReason?.trim() : undefined,
  };

  const row = await prisma.withdrawalRequest.findUnique({ where: { id } });
  if (row) {
    await prisma.withdrawalRequest.update({
      where: { id },
      data: { status, data: JSON.stringify(updated) },
    });
  } else {
    await prisma.withdrawalRequest.create({
      data: {
        id: updated.id,
        status: updated.status,
        submittedAt: new Date(updated.submittedAt),
        data: JSON.stringify(updated),
      },
    });
  }
  return updated;
}

/* ---------------- 纠纷 ---------------- */

function mergeDemoDisputes(dbItems: Dispute[]): Dispute[] {
  const byId = new Map(dbItems.map((d) => [d.id, d]));
  if (demoDataEnabled()) {
    for (const demo of demoDisputes) {
      if (!byId.has(demo.id)) byId.set(demo.id, demo);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.raisedAt).getTime() - new Date(a.raisedAt).getTime(),
  );
}

export async function listDisputes(filter?: {
  status?: Dispute["status"];
  orderId?: string;
  clientId?: string;
  designerId?: string;
}): Promise<Dispute[]> {
  const rows = await prisma.dispute.findMany({
    where: {
      status: filter?.status,
      orderId: filter?.orderId,
      clientId: filter?.clientId,
      designerId: filter?.designerId,
    },
    orderBy: { raisedAt: "desc" },
  });
  const items = mergeDemoDisputes(rows.map((r) => parse<Dispute>(r.data)));
  if (!filter) return items;
  return items.filter((d) => {
    if (filter.status && d.status !== filter.status) return false;
    if (filter.orderId && d.orderId !== filter.orderId) return false;
    if (filter.clientId && d.clientId !== filter.clientId) return false;
    if (filter.designerId && d.designerId !== filter.designerId) return false;
    return true;
  });
}

export async function getDispute(id: string): Promise<Dispute | null> {
  const row = await prisma.dispute.findUnique({ where: { id } });
  if (row) return parse<Dispute>(row.data);
  return demoDataEnabled()
    ? (demoDisputes.find((d) => d.id === id) ?? null)
    : null;
}

export async function findOpenDisputeForOrder(
  orderId: string,
): Promise<Dispute | null> {
  const rows = await prisma.dispute.findMany({
    where: { orderId, status: { in: ["open", "in_review"] } },
  });
  if (rows.length > 0) return parse<Dispute>(rows[0]!.data);
  if (demoDataEnabled()) {
    return (
      demoDisputes.find(
        (d) =>
          d.orderId === orderId &&
          (d.status === "open" || d.status === "in_review"),
      ) ?? null
    );
  }
  return null;
}

export async function createDispute(dispute: Dispute): Promise<Dispute> {
  await prisma.dispute.create({
    data: {
      id: dispute.id,
      orderId: dispute.orderId,
      orderCode: dispute.orderCode,
      clientId: dispute.clientId,
      designerId: dispute.designerId,
      status: dispute.status,
      raisedAt: new Date(dispute.raisedAt),
      data: JSON.stringify(dispute),
    },
  });
  return dispute;
}

export async function saveDispute(dispute: Dispute): Promise<Dispute> {
  await prisma.dispute.upsert({
    where: { id: dispute.id },
    create: {
      id: dispute.id,
      orderId: dispute.orderId,
      orderCode: dispute.orderCode,
      clientId: dispute.clientId,
      designerId: dispute.designerId,
      status: dispute.status,
      raisedAt: new Date(dispute.raisedAt),
      data: JSON.stringify(dispute),
    },
    update: {
      status: dispute.status,
      data: JSON.stringify(dispute),
    },
  });
  return dispute;
}

export async function countActiveDisputes(): Promise<number> {
  const dbCount = await prisma.dispute.count({
    where: { status: { in: ["open", "in_review"] } },
  });
  if (!demoDataEnabled()) return dbCount;
  const dbIds = new Set(
    (
      await prisma.dispute.findMany({
        where: { status: { in: ["open", "in_review"] } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  const demoExtra = demoDisputes.filter(
    (d) =>
      (d.status === "open" || d.status === "in_review") && !dbIds.has(d.id),
  ).length;
  return dbCount + demoExtra;
}

/* ---------------- 合同模板 ---------------- */

export async function getContractTemplates(): Promise<ContractTemplatesConfig> {
  const row = await prisma.contractTemplates.findUnique({
    where: { id: "default" },
  });
  if (!row) return normalizeContractTemplates(null);
  return normalizeContractTemplates(parse<ContractTemplatesConfig>(row.data));
}

export async function saveContractTemplates(config: ContractTemplatesConfig) {
  const normalized = normalizeContractTemplates(config);
  const payload = {
    ...normalized,
    templates: normalized.templates.map((t) => ({
      ...t,
      updatedAt: new Date().toISOString(),
    })),
  };
  await prisma.contractTemplates.upsert({
    where: { id: "default" },
    create: { id: "default", data: JSON.stringify(payload) },
    update: { data: JSON.stringify(payload) },
  });
  return payload;
}
