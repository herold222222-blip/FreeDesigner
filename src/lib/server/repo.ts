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
import type { ServiceProvider } from "@/lib/types";
import {
  normalizePricingConfig,
  type PlatformPricingConfig,
} from "@/lib/platform-pricing";
import { formatClientCode } from "@/lib/client-code";
import {
  normalizeConfirmedReviewStatus,
  normalizePaymentStages,
} from "@/lib/order-payment-stages";
import { hydrateClientReviewWindow } from "@/lib/client-review";
import { isContractFullySigned, normalizeCompletedStatus } from "@/lib/order-lifecycle";
import { syncTrackAssignmentStatuses } from "@/lib/order-track-status";
import { resolveDesignerRegionTier } from "@/lib/constants";
import { formatDesignerCode, normalizeDesignerCode } from "@/lib/designer-code";
import { applyDesignerPresence } from "@/lib/designer-presence";
import { applyReviewStatsToDesigner } from "@/lib/designer-rating";
import { buildDesignerOnboardingReviewItem } from "@/lib/designer-onboarding-review";
import {
  notifyLevelUpgraded,
  userIdForDesigner,
} from "@/lib/server/inbox";
import {
  CLIENT_LEVEL_META,
  DESIGNER_LEVEL_META,
} from "@/lib/constants";
import {
  normalizeContractTemplates,
  type ContractTemplatesConfig,
} from "@/lib/contract-templates";
import type {
  WithdrawalRequest,
  WithdrawalRequestStatus,
} from "@/lib/withdrawal-requests";

function parse<T>(json: string): T {
  return JSON.parse(json) as T;
}

function parseDesignerReview(row: {
  data: string;
  overall?: number | null;
}): DesignerProjectReview {
  const review = parse<DesignerProjectReview>(row.data);
  if (typeof review.overall !== "number" || !Number.isFinite(review.overall)) {
    review.overall = row.overall ?? 0;
  }
  return review;
}

type DesignerRow = {
  data: string;
  code: string | null;
  reviewStatus?: string | null;
  acceptingOrders?: boolean | null;
};

function mergeDesignerRow(row: DesignerRow): Designer {
  const d = parse<Designer>(row.data);
  const code = d.code || row.code || "";
  const portfolio = d.portfolio ?? [];
  const projectTypeTags = [
    ...new Set(portfolio.map((p) => p.category).filter(Boolean)),
  ];
  const regionTier = resolveDesignerRegionTier(d);
  const reviewStatus =
    (row.reviewStatus as Designer["reviewStatus"] | undefined) ??
    d.reviewStatus ??
    "approved";
  const acceptingOrders =
    typeof row.acceptingOrders === "boolean"
      ? row.acceptingOrders
      : d.acceptingOrders !== false;
  return applyDesignerPresence({
    ...d,
    code,
    portfolio,
    projectTypeTags,
    regionTier,
    reviewStatus,
    acceptingOrders,
  });
}

function mergeDesignerContact(
  row: DesignerRow & { user?: { phone: string | null } | null },
): Designer {
  const designer = mergeDesignerRow(row);
  const phone = row.user?.phone ?? designer.phone;
  return phone ? { ...designer, phone } : designer;
}

async function loadReviewsByDesignerId(): Promise<
  Map<string, DesignerProjectReview[]>
> {
  const rows = await prisma.designerReview.findMany();
  const map = new Map<string, DesignerProjectReview[]>();
  for (const row of rows) {
    const review = parseDesignerReview(row);
    const list = map.get(row.designerId) ?? [];
    list.push(review);
    map.set(row.designerId, list);
  }
  return map;
}

function attachReviewStats(
  designer: Designer,
  reviewsByDesigner: Map<string, DesignerProjectReview[]>,
): Designer {
  return applyReviewStatsToDesigner(
    designer,
    reviewsByDesigner.get(designer.id) ?? [],
  );
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
  const [rows, reviewsByDesigner] = await Promise.all([
    prisma.designer.findMany({
      where: { reviewStatus: "approved" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { phone: true } } },
    }),
    loadReviewsByDesignerId(),
  ]);
  return rows.map((r) =>
    attachReviewStats(mergeDesignerContact(r), reviewsByDesigner),
  );
}

const ONGOING_ORDER_STATUSES = new Set([
  "matching",
  "pending_designer_accept",
  "pending_schedule",
  "pending_contract",
  "in_progress",
  "pending_review",
  "in_revision",
]);

/** 管理员查看设计师列表（含注册手机号、账号名、账号状态、进行中订单数） */
export async function listDesignersForAdmin() {
  const rows = await prisma.designer.findMany({
    where: { reviewStatus: "approved" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, phone: true, loginName: true, status: true } },
    },
  });

  const [orderRows, reviewsByDesigner] = await Promise.all([
    prisma.order.findMany({
      select: { designerId: true, status: true },
    }),
    loadReviewsByDesignerId(),
  ]);
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
    ...attachReviewStats(mergeDesignerRow(r), reviewsByDesigner),
    phone: r.user?.phone,
    userId: r.user?.id,
    loginName: r.user?.loginName ?? undefined,
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
  if (!row) return null;
  const reviews = await listDesignerReviews(id);
  return applyReviewStatsToDesigner(mergeDesignerContact(row), reviews);
}

export async function getDesignerByCode(code: string): Promise<Designer | null> {
  const normalized = normalizeDesignerCode(code);
  if (!normalized) return null;
  const row = await prisma.designer.findUnique({
    where: { code: normalized },
    include: { user: { select: { phone: true } } },
  });
  const attach = async (designer: Designer) => {
    const reviews = await listDesignerReviews(designer.id);
    return applyReviewStatsToDesigner(designer, reviews);
  };
  if (row) return attach(mergeDesignerContact(row));
  const rows = await prisma.designer.findMany({
    include: { user: { select: { phone: true } } },
  });
  for (const r of rows) {
    const d = mergeDesignerContact(r);
    if (normalizeDesignerCode(d.code) === normalized) return attach(d);
  }
  return null;
}

export async function saveDesigner(designer: Designer) {
  const regionTier = resolveDesignerRegionTier(designer);
  const payload: Designer = { ...designer, regionTier };
  await prisma.designer.update({
    where: { id: designer.id },
    data: {
      name: payload.name,
      avatar: payload.avatar,
      subjectType: payload.subjectType ?? "individual",
      specialty: payload.specialty,
      level: payload.level,
      regionTier: payload.regionTier,
      location: payload.location,
      acceptingOrders: payload.acceptingOrders ?? true,
      rating: payload.rating,
      dailyRate: payload.dailyRate,
      monthlyRate: payload.monthlyRate,
      code: payload.code || null,
      data: JSON.stringify(payload),
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
  const prevLevel = designer.level;
  designer.level = level;
  await prisma.designer.update({
    where: { id },
    data: { level, data: JSON.stringify(designer) },
  });
  if (prevLevel !== level) {
    const userId = await userIdForDesigner(id);
    const levelLabel = DESIGNER_LEVEL_META[level]?.label ?? level;
    await notifyLevelUpgraded({
      userId,
      subjectLabel: "设计师",
      levelLabel,
      linkHref: "/designer/profile",
    });
  }
  return designer;
}

/** 管理员设置入驻审核状态（同步列字段与 JSON） */
export async function setDesignerReviewStatus(
  id: string,
  reviewStatus: NonNullable<Designer["reviewStatus"]>,
): Promise<Designer | null> {
  const designer = await getDesigner(id);
  if (!designer) return null;
  const next: Designer = { ...designer, reviewStatus };
  await prisma.designer.update({
    where: { id },
    data: { reviewStatus, data: JSON.stringify(next) },
  });
  return next;
}

/** 创建设计师入驻审核工单（幂等：已有待审工单则跳过） */
export async function createDesignerOnboardingReview(
  designer: Designer,
  phone?: string,
): Promise<ReviewItem | null> {
  const existing = await prisma.reviewItem.findUnique({
    where: { id: `rv_designer_${designer.id}` },
  });
  if (existing) {
    const item = parse<ReviewItem>(existing.data);
    if (item.status === "pending") return item;
    return null;
  }
  const item = buildDesignerOnboardingReviewItem(designer, phone);
  return createReviewItem(item);
}

/** 为尚未建工单的待审设计师补齐入驻审核条目 */
async function ensurePendingDesignerOnboardingReviews() {
  const pendingRows = await prisma.designer.findMany({
    where: { reviewStatus: "pending" },
    include: { user: { select: { phone: true } } },
  });
  for (const row of pendingRows) {
    const designer = mergeDesignerContact(row);
    await createDesignerOnboardingReview(designer, row.user?.phone ?? undefined);
  }
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

  const prev = await getDesigner(id);
  const prevLevel = prev?.level;
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

  if (designer.level && prevLevel !== designer.level) {
    const levelLabel =
      DESIGNER_LEVEL_META[designer.level]?.label ?? designer.level;
    await notifyLevelUpgraded({
      userId: row.userId,
      subjectLabel: "设计师",
      levelLabel,
      linkHref: "/designer/profile",
    });
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
    include: {
      user: { select: { id: true, phone: true, loginName: true, status: true } },
    },
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
      loginName: r.user?.loginName ?? undefined,
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

  const prev = await getClient(id);
  const prevLevel = prev?.level;
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

  if (client.level && prevLevel !== client.level) {
    const levelLabel = CLIENT_LEVEL_META[client.level]?.label ?? client.level;
    await notifyLevelUpgraded({
      userId: row.userId,
      subjectLabel: "委托人",
      levelLabel,
      linkHref: "/client/settings",
    });
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

function hydrateOrder(order: Order): Order {
  normalizePaymentStages(order);
  normalizeConfirmedReviewStatus(order);
  syncTrackAssignmentStatuses(order);
  normalizeCompletedStatus(order);
  hydrateClientReviewWindow(order);
  return order;
}

export async function listOrders(filter?: {
  clientId?: string;
  designerId?: string;
}): Promise<Order[]> {
  if (!filter?.designerId) {
    const rows = await prisma.order.findMany({
      where: {
        clientId: filter?.clientId,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => hydrateOrder(parse<Order>(r.data)));
  }

  const designerId = filter.designerId;
  const primaryRows = await prisma.order.findMany({
    where: {
      clientId: filter.clientId,
      designerId,
    },
    orderBy: { createdAt: "desc" },
  });
  const primaryIds = new Set(primaryRows.map((r) => r.id));
  const primary = primaryRows.map((r) => hydrateOrder(parse<Order>(r.data)));

  // 专业分工中的非主设计师：列不在 designerId 上，需从 JSON 数据中匹配
  const otherRows = await prisma.order.findMany({
    where: {
      clientId: filter.clientId,
      NOT: { designerId },
    },
    orderBy: { createdAt: "desc" },
  });
  const tracked = otherRows
    .map((r) => hydrateOrder(parse<Order>(r.data)))
    .filter(
      (o) =>
        !primaryIds.has(o.id) &&
        (o.trackAssignments ?? []).some((a) => a.designerId === designerId),
    );

  return [...primary, ...tracked].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function hasOrderBetweenClientAndDesigner(
  clientId: string,
  designerId: string,
): Promise<boolean> {
  if (!clientId || !designerId) return false;
  const orders = await listOrders({ clientId, designerId });
  return orders.length > 0;
}

/** 双方已完成合同签署后，才可互看对方电话 */
export async function hasSignedOrderBetweenClientAndDesigner(
  clientId: string,
  designerId: string,
): Promise<boolean> {
  if (!clientId || !designerId) return false;
  const orders = await listOrders({ clientId, designerId });
  return orders.some((order) => isContractFullySigned(order));
}

export async function getClientWithAccountPhone(
  id: string,
): Promise<Client | null> {
  const row = await prisma.client.findUnique({
    where: { id },
    include: { user: { select: { phone: true } } },
  });
  if (!row) return null;
  const client = parse<Client>(row.data);
  return {
    ...client,
    phone: row.user?.phone ?? client.phone,
  };
}

export async function getOrder(id: string): Promise<Order | null> {
  const row = await prisma.order.findUnique({ where: { id } });
  return row ? hydrateOrder(parse<Order>(row.data)) : null;
}

export async function findOrderByContractId(
  contractId: string,
): Promise<Order | null> {
  const key = contractId.trim();
  if (!key || key === "preview") return null;
  const rows = await prisma.order.findMany({ select: { data: true } });
  for (const row of rows) {
    const order = hydrateOrder(parse<Order>(row.data));
    if (order.contractId === key || order.id === key) return order;
  }
  return null;
}

export async function findOrderByDeliverablesConfirmShareId(
  shareId: string,
): Promise<{ order: Order; stageId: string } | null> {
  if (!shareId.trim()) return null;
  const rows = await prisma.order.findMany({ select: { data: true } });
  for (const row of rows) {
    const order = hydrateOrder(parse<Order>(row.data));
    const stage = order.stages.find(
      (s) => s.deliverablesConfirmShareId === shareId,
    );
    if (stage) return { order, stageId: stage.id };
  }
  return null;
}

export async function findOrderByReviewShareId(
  shareId: string,
): Promise<Order | null> {
  if (!shareId.trim()) return null;
  const rows = await prisma.order.findMany({ select: { data: true } });
  for (const row of rows) {
    const order = hydrateOrder(parse<Order>(row.data));
    if (order.reviewShareId === shareId) return order;
  }
  return null;
}

export async function findOrderBySelfOrderShareId(
  shareId: string,
): Promise<Order | null> {
  if (!shareId.trim()) return null;
  const rows = await prisma.order.findMany({ select: { data: true } });
  for (const row of rows) {
    const order = hydrateOrder(parse<Order>(row.data));
    if (order.selfOrderShareId === shareId) return order;
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
  normalizePaymentStages(order);
  normalizeConfirmedReviewStatus(order);
  syncTrackAssignmentStatuses(order);
  normalizeCompletedStatus(order);
  await prisma.order.update({
    where: { id: order.id },
    data: {
      title: order.title,
      clientId: order.clientId,
      designerId: order.designerId,
      status: order.status,
      totalAmount: order.totalAmount,
      data: JSON.stringify(order),
    },
  });
  return order;
}

/** 永久删除订单记录（不可恢复） */
export async function deleteOrder(id: string): Promise<void> {
  await prisma.order.delete({ where: { id } });
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

function isPlaceholderClientDisplayName(name?: string) {
  const value = (name ?? "").trim();
  return !value || value === "委托人";
}

async function hydrateDesignerReviewClientNames(
  reviews: DesignerProjectReview[],
): Promise<DesignerProjectReview[]> {
  const pending = reviews.filter(
    (review) =>
      isPlaceholderClientDisplayName(review.clientDisplayName) &&
      Boolean(review.orderCode),
  );
  if (pending.length === 0) return reviews;

  const codes = [...new Set(pending.map((review) => review.orderCode))];
  const orderRows = await prisma.order.findMany({
    where: { code: { in: codes } },
    select: { code: true, clientId: true },
  });
  const clientIds = [...new Set(orderRows.map((row) => row.clientId))];
  const clients = await Promise.all(clientIds.map((id) => getClient(id)));
  const clientById = new Map(
    clients.filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => [c.id, c]),
  );
  const clientIdByCode = new Map(orderRows.map((row) => [row.code, row.clientId]));

  const resolved = await Promise.all(
    reviews.map(async (review) => {
      if (!isPlaceholderClientDisplayName(review.clientDisplayName)) return review;
      const clientId = clientIdByCode.get(review.orderCode);
      const name = clientId ? clientById.get(clientId)?.name?.trim() : "";
      if (!name || name === "委托人") return review;
      const next = { ...review, clientDisplayName: name };
      await prisma.designerReview.update({
        where: { id: review.id },
        data: { data: JSON.stringify(next) },
      });
      return next;
    }),
  );
  return resolved;
}

export async function listDesignerReviews(
  designerId: string
): Promise<DesignerProjectReview[]> {
  const rows = await prisma.designerReview.findMany({
    where: { designerId },
    orderBy: { createdAt: "desc" },
  });
  return hydrateDesignerReviewClientNames(rows.map((r) => parseDesignerReview(r)));
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
  const [designer, reviews] = await Promise.all([
    prisma.designer.findUnique({
      where: { id: review.designerId },
      include: { user: { select: { phone: true } } },
    }),
    listDesignerReviews(review.designerId),
  ]);
  if (designer) {
    const next = applyReviewStatsToDesigner(
      mergeDesignerContact(designer),
      reviews,
    );
    await saveDesigner(next);
  }
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

export async function listReviewItems(): Promise<ReviewItem[]> {
  await ensurePendingDesignerOnboardingReviews();
  const rows = await prisma.reviewItem.findMany({
    orderBy: { submittedAt: "desc" },
  });
  return rows
    .map((r) => parse<ReviewItem>(r.data))
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
}

export async function getReviewItem(id: string): Promise<ReviewItem | null> {
  const row = await prisma.reviewItem.findUnique({ where: { id } });
  return row ? parse<ReviewItem>(row.data) : null;
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
  const designers: AdminDesignerRow[] = await listDesignersForAdmin();
  const clients: AdminClientRow[] = await listClientsForAdmin();

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

export async function listFeedbackMessages(): Promise<FeedbackMessage[]> {
  const rows = await prisma.feedbackMessage.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(feedbackFromRow);
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

export async function listWithdrawalRequests(): Promise<WithdrawalRequest[]> {
  const rows = await prisma.withdrawalRequest.findMany({
    orderBy: { submittedAt: "desc" },
  });
  return rows
    .map((r) => parse<WithdrawalRequest>(r.data))
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
}

export async function getWithdrawalRequest(
  id: string,
): Promise<WithdrawalRequest | null> {
  const row = await prisma.withdrawalRequest.findUnique({ where: { id } });
  return row ? parse<WithdrawalRequest>(row.data) : null;
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
  return rows.map((r) => parse<Dispute>(r.data));
}

export async function getDispute(id: string): Promise<Dispute | null> {
  const row = await prisma.dispute.findUnique({ where: { id } });
  return row ? parse<Dispute>(row.data) : null;
}

export async function findOpenDisputeForOrder(
  orderId: string,
): Promise<Dispute | null> {
  const rows = await prisma.dispute.findMany({
    where: { orderId, status: { in: ["open", "in_review"] } },
  });
  if (rows.length > 0) return parse<Dispute>(rows[0]!.data);
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
  return prisma.dispute.count({
    where: { status: { in: ["open", "in_review"] } },
  });
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
