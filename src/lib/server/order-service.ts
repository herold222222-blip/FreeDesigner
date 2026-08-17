import "server-only";
import type {
  DeliverableFile,
  DesignerLevel,
  DesignerProjectReview,
  Order,
  OrderStatus,
  OrderTrackAssignment,
  RatingBreakdown,
  ReviewItem,
  ServiceMode,
  Specialty,
  WalletTransaction,
  BountyAttachment,
} from "@/lib/types";
import { designerHasL3 } from "@/lib/bounty-tracks";
import {
  extractOrderAssignTracks,
  formatAssignTrackLabel,
  orderInvolvesDesigner,
  resolveL2ForL3,
} from "@/lib/order-assign-tracks";
import { resolveTrackLabels } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import {
  buildMatchPools,
  buildTrackMatchPools,
  designerEligibleForClientMatch,
  explainClientMatchFailure,
  pickRematchDesigner,
  pickRematchDesignerForTrack,
  trackPoolTitle,
} from "@/lib/client-quote-match";
import {
  buildDefaultPaymentStages,
  isPrepaymentStage,
} from "@/lib/order-payment-stages";
import {
  CLIENT_REVIEW_DAYS,
  allOrderStagesPaid,
  resolveReviewDeadlineAt,
} from "@/lib/client-review";
import { needsCsQuoteConfirm } from "@/lib/order-supervision";
import { describeEntrustUpdates } from "@/lib/entrust-update-diff";
import { CLIENT_QUOTE_LEVELS, buildRegularTimeQuotesByLevel, extractTimeQuoteLineInputsFromOrder, rebuildTimeQuoteFromAssignments, type RegularTimeQuoteLineInput } from "@/lib/regular-entrust-quote";
import { DEFAULT_CLIENT_LEVEL } from "@/lib/level-management";
import {
  createOrder,
  getOrder,
  saveOrder,
  deleteOrder,
  createScheduleRequest,
  getScheduleRequest,
  saveScheduleRequest,
  createWalletTransaction,
  updateWalletTransaction,
  getWalletTransactionForOwner,
  getDesigner,
  listDesigners,
  listOrders,
  getClient,
  createReviewItem,
  hasPendingPromotion,
  createDesignerReview,
  getBounty,
  saveBounty,
} from "./repo";
import { buildOrder, type CreateOrderInput } from "./order-builder";
import {
  designerCanAcceptOrders,
  designerCoversProjectType,
  projectTypeMismatchMessage,
} from "@/lib/designer-portfolio-readiness";
import {
  notifyAdminsMatchingOrder,
  notifyAdminsPendingCsQuote,
  notifyClientCsQuoteConfirmed,
  notifyClientDesignerAccepted,
  notifyClientEntrustUpdatedByAdmin,
  notifyAdminsAssignmentRejected,
  notifyClientDesignerRematch,
  notifyContractFullySigned,
  notifyCounterpartyContractSigned,
  notifyDeliverablesConfirmed,
  notifyDeliverablesSubmitted,
  notifyDesignerAssignmentOffer,
  notifyDesignerReviewSubmitted,
  notifyFinalSettlementConfirmed,
  notifyOrderCancelledByAdmin,
  notifyRevisionRequested,
  notifySettlementRequested,
  notifyStagePaid,
  notifyStageReleased,
  notifyClientReviewOpened,
} from "@/lib/server/inbox";

/** 管理员可取消的早期订单状态（尚未进入履约） */
export const ADMIN_CANCELLABLE_ORDER_STATUSES: OrderStatus[] = [
  "pending_quote",
  "matching",
];

function rebuildDefaultStages(order: Order) {
  order.stages = buildDefaultPaymentStages({
    orderId: order.id,
    totalAmount: order.totalAmount,
    billingMode: order.billingMode,
    selectedMonths: order.selectedMonths,
  });
}
import { AuthError } from "./auth";

const ACCEPTANCE_DAYS = 10;
const SETTLEMENT_DAYS = 30;

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function addDays(from: string, days: number): string {
  return new Date(
    new Date(from).getTime() + days * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function isContractFullySigned(order: Order): boolean {
  return (
    order.clientSignedContract === true && order.designerSignedContract === true
  );
}

function ensureContractReady(order: Order) {
  if (order.status === "cancelled") {
    throw new AuthError(409, "订单已取消，不可操作");
  }
  if (!isContractFullySigned(order)) {
    throw new AuthError(409, "请先完成双方电子签约");
  }
}

function assertOrderNotCancelled(order: Order) {
  if (order.status === "cancelled") {
    throw new AuthError(409, "订单已取消，不可操作");
  }
}

function markContractReady(order: Order): boolean {
  if (!order.contractId) {
    order.contractId = `CT-${Date.now().toString(36).toUpperCase()}`;
  }
  const newlyFullySigned =
    isContractFullySigned(order) && !order.contractSignedAt;
  if (newlyFullySigned) {
    order.contractSignedAt = nowIso();
    order.messages.push({
      id: randomId("msg"),
      authorId: "system",
      authorRole: "system",
      content: "双方已完成电子签约，请委托人支付预付款启动项目。",
      createdAt: nowIso(),
    });
  }
  if (isContractFullySigned(order) && order.status === "pending_contract") {
    order.status = "in_progress";
  }
  return newlyFullySigned;
}

function unlockStageCadDeliverables(stage: Order["stages"][number]) {
  if (!stage.deliverables?.length) return;
  for (const file of stage.deliverables) {
    if (file.locked) file.locked = false;
  }
}

function allStagesReleased(order: Order): boolean {
  return order.stages.every((s) => s.status === "released");
}

function randomReviewMessage(at: string, content: string) {
  return {
    id: randomId("msg"),
    authorId: "system" as const,
    authorRole: "system" as const,
    content,
    createdAt: at,
  };
}

/** 最后一笔费用支付后开启 30 天评价窗口。返回是否新开窗（需通知委托人）。 */
function openClientReviewWindow(order: Order, at: string): boolean {
  if (order.status === "cancelled" || order.clientReviewed) return false;
  if (!allOrderStagesPaid(order)) return false;
  const deadline =
    resolveReviewDeadlineAt(order) ?? addDays(at, CLIENT_REVIEW_DAYS);
  const firstOpen = !order.reviewDeadlineAt;
  order.reviewDeadlineAt = deadline;
  if (new Date(deadline).getTime() <= Date.now()) {
    order.reviewExpired = true;
    return false;
  }
  order.reviewExpired = false;
  if (!firstOpen) return false;
  order.messages.push(
    randomReviewMessage(
      at,
      `最后一笔费用已支付。欢迎对设计师进行评分和评论，评价将于 ${CLIENT_REVIEW_DAYS} 天后关闭。`,
    ),
  );
  return true;
}

/** 已接单且未结束的状态（用于见习「同时仅可接 1 单」限制） */
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "pending_contract",
  "in_progress",
  "pending_review",
  "in_revision",
];

/** 委托人下单：创建订单并视来源生成档期申请 */
export async function placeOrder(input: CreateOrderInput): Promise<Order> {
  if (input.designerId) {
    const designer = await getDesigner(input.designerId);
    if (!designer) throw new AuthError(404, "设计师不存在");
    if (!designerCanAcceptOrders(designer)) {
      throw new AuthError(
        403,
        "该设计师尚未上传作品案例，暂不可承接订单",
      );
    }
    if (
      input.projectType?.trim() &&
      !designerCoversProjectType(designer, input.projectType)
    ) {
      throw new AuthError(
        403,
        projectTypeMismatchMessage(input.projectType.trim()),
      );
    }
  }

  const order = buildOrder(input);
  await createOrder(order);

  if (order.status === "pending_schedule" && order.designerId) {
    const scheduleId = `sch_${order.id}`;
    await createScheduleRequest({
      id: scheduleId,
      orderId: order.id,
      designerId: order.designerId,
      clientId: order.clientId,
      serviceMode: order.serviceMode,
      billingMode: order.billingMode === "monthly" ? "monthly" : "daily",
      title: order.title,
      slots: order.selectedSlots ?? [],
      selectedMonths: input.selectedMonths,
      address: order.onsiteSchedule?.address,
      totalAmount: order.totalAmount,
      status: "pending",
      submittedAt: nowIso(),
    });
    order.scheduleRequestId = scheduleId;
    await saveOrder(order);
  }

  if (
    order.status === "pending_quote" &&
    (order.levelQuotes?.length || order.quote)
  ) {
    await notifyAdminsPendingCsQuote(order);
  }

  return order;
}

export type MatchingOrderUpdateInput = {
  title?: string;
  description?: string;
  projectType?: string;
  totalAmount?: number;
  expectedDeliveryAt?: string;
  serviceMode?: ServiceMode;
  withAuditService?: boolean;
  withProjectManagement?: boolean;
  projectAreaSqm?: number;
  taxCoefficient?: number;
  attachments?: BountyAttachment[];
  timeQuoteLines?: RegularTimeQuoteLineInput[];
};

/** 委托人确认系统报价 → matching，并推送管理员分配设计师 */
export async function confirmOrderQuote(
  orderId: string,
  clientId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");
  if (order.status !== "pending_quote") {
    throw new AuthError(409, "当前订单状态不可确认报价");
  }
  if (!order.quote || order.quote.status !== "pending") {
    throw new AuthError(409, "报价单不存在或已确认");
  }

  order.quote = {
    ...order.quote,
    status: "confirmed",
    confirmedAt: nowIso(),
  };
  order.totalAmount = order.quote.total;
  rebuildDefaultStages(order);
  order.status = "matching";
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "委托人已确认报价，订单进入待匹配，已通知平台管理员分配设计师。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
  await notifyAdminsMatchingOrder(order);
  return order;
}

function ensureLevelQuotes(order: Order) {
  if (order.levelQuotes?.length) return order.levelQuotes;
  if (order.quote) return [order.quote];
  return [];
}

/**
 * 委托人勾选等级报价卡 → 按三级专业分别匹配备选设计师。
 * pending_quote → matching（等待委托人按专业确认人选）
 */
export async function matchDesignersFromQuoteCards(
  orderId: string,
  clientId: string,
  levels: DesignerLevel[],
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");
  assertOrderNotCancelled(order);
  if (order.status !== "pending_quote" && order.status !== "matching") {
    throw new AuthError(409, "当前订单状态不可匹配设计师");
  }
  if (needsCsQuoteConfirm(order)) {
    throw new AuthError(409, "客服尚未确认本单需求，暂不可匹配设计师");
  }
  if (
    order.status === "matching" &&
    (order.clientMatch?.offerStatus === "pending" ||
      order.clientMatch?.trackPools?.some((p) => p.offerStatus === "pending"))
  ) {
    throw new AuthError(409, "已有设计师确认中，请等待其回应");
  }

  const uniqueLevels = Array.from(
    new Set(levels.filter((l) => CLIENT_QUOTE_LEVELS.includes(l))),
  );
  if (!uniqueLevels.length) {
    throw new AuthError(400, "请至少选择一档报价卡");
  }

  const quotes = ensureLevelQuotes(order);
  if (!quotes.length) {
    throw new AuthError(409, "订单尚无系统报价，无法匹配");
  }

  const quoteTotalByLevel: Partial<Record<DesignerLevel, number>> = {};
  for (const q of quotes) {
    quoteTotalByLevel[q.assumptions.designerLevel] = q.total;
  }
  for (const level of uniqueLevels) {
    if (!quoteTotalByLevel[level]) {
      throw new AuthError(400, `缺少「${level}」档报价`);
    }
  }

  const designers = await listDesigners();
  const excluded = new Set(order.clientMatch?.excludedDesignerIds ?? []);
  const trackPools = buildTrackMatchPools({
    designers,
    order,
    levels: uniqueLevels,
    excludeIds: excluded,
  });

  const emptyTracks = trackPools.filter((p) => p.candidates.length === 0);
  if (emptyTracks.length === trackPools.length) {
    throw new AuthError(
      409,
      explainClientMatchFailure({
        designers,
        order,
        levels: uniqueLevels,
        excludeIds: excluded,
      }),
    );
  }
  if (emptyTracks.length > 0) {
    const names = emptyTracks.map((p) => trackPoolTitle(p)).join("、");
    throw new AuthError(
      409,
      `以下专业暂无符合所选等级的可接单设计师：${names}。请增选其他等级后重试。`,
    );
  }

  const totalCandidates = trackPools.reduce(
    (n, p) => n + p.candidates.length,
    0,
  );

  // 锁定展示价：取所选档中价最低者作为默认展示，确认人选时再按所选设计师等级改写
  const minTotal = Math.min(...uniqueLevels.map((l) => quoteTotalByLevel[l]!));
  const primaryQuote =
    quotes.find((q) => q.total === minTotal) ??
    quotes.find((q) => q.assumptions.designerLevel === uniqueLevels[0]) ??
    quotes[0]!;

  order.quote = {
    ...primaryQuote,
    status: "confirmed",
    confirmedAt: nowIso(),
  };
  order.totalAmount = primaryQuote.total;
  rebuildDefaultStages(order);
  order.status = "matching";
  order.clientMatch = {
    selectedLevels: uniqueLevels,
    trackPools,
    matchedAt: nowIso(),
    excludedDesignerIds: Array.from(excluded),
  };
  order.designerId = "";
  order.trackAssignments = undefined;
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `委托人已选择 ${uniqueLevels.length} 档报价并启动匹配，系统已按 ${trackPools.length} 个专业给出共 ${totalCandidates} 名备选，请分别为各专业确认设计师。`,
    createdAt: nowIso(),
  });
  await saveOrder(order);
  return order;
}

/** 管理员二次确认委托需求 → 开放委托人选卡匹配 */
export async function confirmCsQuote(
  orderId: string,
  adminUserId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  assertOrderNotCancelled(order);
  if (order.status !== "pending_quote") {
    throw new AuthError(409, "仅待确认报价的订单可开放选卡匹配");
  }
  if (!order.levelQuotes?.length && !order.quote) {
    throw new AuthError(409, "订单尚无报价卡，无法确认");
  }
  if (order.csQuoteConfirmedAt) {
    throw new AuthError(409, "客服已确认，委托人可直接选卡匹配");
  }

  order.csQuoteConfirmedAt = nowIso();
  order.csQuoteConfirmedBy = adminUserId;
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "客服已根据委托需求更新报价并完成确认，委托人可查看等级报价卡并匹配设计师。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
  await notifyClientCsQuoteConfirmed(order);
  return order;
}

export type ConfirmMatchInput = {
  designerId?: string;
  selections?: Array<{ trackKey: string; designerId: string }>;
};

/**
 * 委托人按三级专业确认设计师 → pending_designer_accept，并通知对方。
 */
export async function confirmClientMatchedDesigner(
  orderId: string,
  clientId: string,
  input: string | ConfirmMatchInput,
): Promise<Order> {
  const payload: ConfirmMatchInput =
    typeof input === "string" ? { designerId: input } : input;

  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");
  assertOrderNotCancelled(order);
  if (order.status !== "matching") {
    throw new AuthError(409, "请先完成报价卡匹配");
  }
  const match = order.clientMatch;
  if (!match) throw new AuthError(409, "尚未匹配备选设计师");

  if (match.offerStatus === "pending") {
    throw new AuthError(409, "已有待确认委派，请等待设计师回应");
  }

  // 新流程：按三级专业槽位确认
  if (match.trackPools?.length) {
    return confirmTrackPoolSelections(order, match, payload);
  }

  // 兼容旧版：按等级池单人确认
  if (!match.pools?.length) {
    throw new AuthError(409, "尚未匹配备选设计师");
  }
  if (!payload.designerId) {
    throw new AuthError(400, "请选择设计师");
  }
  const designerId = payload.designerId;
  const pool = match.pools.find((p) =>
    p.candidates.some((c) => c.designerId === designerId),
  );
  if (!pool) {
    throw new AuthError(400, "请从当前备选设计师中选择");
  }

  const designer = await getDesigner(designerId);
  if (!designer) throw new AuthError(404, "设计师不存在");
  if (!designerEligibleForClientMatch(designer, order)) {
    throw new AuthError(403, "该设计师当前不可接单，请另选或重新匹配");
  }

  const levelQuote =
    ensureLevelQuotes(order).find(
      (q) => q.assumptions.designerLevel === pool.level,
    ) ?? order.quote;
  if (levelQuote) {
    order.quote = {
      ...levelQuote,
      status: "confirmed",
      confirmedAt: nowIso(),
    };
    order.totalAmount = levelQuote.total;
    rebuildDefaultStages(order);
  }

  await applyDesignerOffer(order, designer.id, pool.level);
  order.clientMatch = {
    ...match,
    selectedDesignerId: designer.id,
    selectedLevel: pool.level,
    offerDesignerId: designer.id,
    offerLevel: pool.level,
    offerStatus: "pending",
    excludedDesignerIds: Array.from(
      new Set([...(match.excludedDesignerIds ?? []), designer.id]),
    ),
  };
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `委托人已确认设计师「${designer.name}」，等待对方接单。`,
    createdAt: nowIso(),
  });
  await saveOrder(order);
  await notifyDesignerAssignmentOffer(order, designer.id, {
    designerName: designer.name,
  });
  return order;
}

async function confirmTrackPoolSelections(
  order: Order,
  match: NonNullable<Order["clientMatch"]>,
  payload: ConfirmMatchInput,
): Promise<Order> {
  const trackPools = match.trackPools!;
  let selections = payload.selections;
  if (!selections?.length && payload.designerId) {
    selections = trackPools.map((p) => ({
      trackKey: p.trackKey,
      designerId: payload.designerId!,
    }));
  }
  if (!selections?.length) {
    throw new AuthError(400, "请为每个专业选择设计师");
  }

  const byKey = new Map(selections.map((s) => [s.trackKey, s.designerId]));
  const resolved: Array<{
    trackKey: string;
    designerId: string;
    level: DesignerLevel;
    l1: Specialty;
    l2: string;
    l3: string;
  }> = [];

  for (const pool of trackPools) {
    const designerId = byKey.get(pool.trackKey);
    if (!designerId) {
      throw new AuthError(
        400,
        `请为「${trackPoolTitle(pool)}」选择设计师`,
      );
    }
    const candidate = pool.candidates.find((c) => c.designerId === designerId);
    if (!candidate) {
      throw new AuthError(
        400,
        `「${trackPoolTitle(pool)}」请从当前备选中选择`,
      );
    }
    resolved.push({
      trackKey: pool.trackKey,
      designerId,
      level: candidate.level,
      l1: pool.l1,
      l2: pool.l2,
      l3: pool.l3,
    });
  }

  const uniqueDesignerIds = Array.from(new Set(resolved.map((r) => r.designerId)));
  const designers = [];
  for (const id of uniqueDesignerIds) {
    const designer = await getDesigner(id);
    if (!designer) throw new AuthError(404, `设计师不存在（${id}）`);
    if (!designerEligibleForClientMatch(designer, order)) {
      throw new AuthError(
        403,
        `设计师「${designer.name}」当前不可接单，请另选或重新匹配`,
      );
    }
    const missingL3 = resolved.find(
      (r) => r.designerId === id && r.l3 && !designerHasL3(designer, r.l3),
    );
    if (missingL3) {
      const pool = trackPools.find((p) => p.trackKey === missingL3.trackKey);
      throw new AuthError(
        403,
        `设计师「${designer.name}」不具备「${pool ? trackPoolTitle(pool) : "该专业"}」所需三级专业，请另选或重新匹配`,
      );
    }
    designers.push(designer);
  }

  // 多专业时按所选设计师中最高等级锁定报价
  const LEVEL_RANK: Record<DesignerLevel, number> = {
    intern: 1,
    mid_v1: 2,
    senior_v1: 3,
    specialist: 4,
  };
  const maxLevel = resolved.reduce(
    (best, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[best] ? r.level : best),
    resolved[0]!.level,
  );
  const levelQuote =
    ensureLevelQuotes(order).find(
      (q) => q.assumptions.designerLevel === maxLevel,
    ) ?? order.quote;

  await applyTrackDesignerOffers(order, resolved);

  const designerById = new Map(designers.map((d) => [d.id, d]));
  const rebuilt = rebuildTimeQuoteFromAssignments(order, (id) =>
    designerById.get(id),
  );
  const locked = rebuilt ?? levelQuote;
  if (locked) {
    order.quote = {
      ...locked,
      status: "confirmed",
      confirmedAt: nowIso(),
    };
    order.totalAmount = locked.total;
    rebuildDefaultStages(order);
  }

  const nameList = designers.map((d) => d.name).join("、");
  order.clientMatch = {
    ...match,
    trackPools: trackPools.map((p) => {
      const hit = resolved.find((r) => r.trackKey === p.trackKey)!;
      return {
        ...p,
        selectedDesignerId: hit.designerId,
        offerDesignerId: hit.designerId,
        offerLevel: hit.level,
        offerStatus: "pending" as const,
      };
    }),
    selectedDesignerId: resolved[0]!.designerId,
    selectedLevel: maxLevel,
    offerDesignerId: resolved[0]!.designerId,
    offerLevel: maxLevel,
    offerStatus: "pending",
    excludedDesignerIds: Array.from(
      new Set([
        ...(match.excludedDesignerIds ?? []),
        ...uniqueDesignerIds,
      ]),
    ),
  };
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content:
      resolved.length > 1
        ? `委托人已按 ${resolved.length} 个专业确认设计师「${nameList}」，等待各方接单。`
        : `委托人已确认设计师「${nameList}」，等待对方接单。`,
    createdAt: nowIso(),
  });
  await saveOrder(order);

  for (const designer of designers) {
    const myTracks = (order.trackAssignments ?? []).filter(
      (a) => a.designerId === designer.id,
    );
    const trackLabels = myTracks
      .map((a) => {
        const labels = resolveTrackLabels(a.l1, a.l2, a.l3);
        return `${labels.l2Label}·${labels.l3Label}`;
      })
      .join("、");
    await notifyDesignerAssignmentOffer(order, designer.id, {
      designerName: designer.name,
      trackLabels: trackLabels || undefined,
    });
  }
  return order;
}

/** 将设计师写入订单委派（含按专业 trackAssignments） */
async function applyDesignerOffer(
  order: Order,
  designerId: string,
  _level: DesignerLevel,
) {
  const designer = await getDesigner(designerId);
  if (!designer) throw new AuthError(404, "设计师不存在");
  if (!designerCanAcceptOrders(designer)) {
    throw new AuthError(403, "该设计师尚未上传作品案例，暂不可委派");
  }
  if (
    order.projectType?.trim() &&
    !designerCoversProjectType(designer, order.projectType)
  ) {
    throw new AuthError(
      403,
      projectTypeMismatchMessage(order.projectType.trim()),
    );
  }

  const stageId = order.stages[0]?.id ?? `${order.id}_s1`;
  const tracks = extractOrderAssignTracks(order);
  if (tracks.length > 0) {
    order.trackAssignments = tracks.map(
      (t) =>
        ({
          id: randomId("trk"),
          l1: t.l1,
          l2: t.l2,
          l3: t.l3,
          designerId,
          stageId,
          status: "pending_match",
        }) satisfies OrderTrackAssignment,
    );
  } else {
    order.trackAssignments = undefined;
  }
  order.designerId = designerId;
  order.status = "pending_designer_accept";
}

/** 按专业槽位分别写入委派 */
async function applyTrackDesignerOffers(
  order: Order,
  selections: Array<{
    designerId: string;
    l1: Specialty;
    l2: string;
    l3: string;
  }>,
) {
  for (const id of new Set(selections.map((s) => s.designerId))) {
    const designer = await getDesigner(id);
    if (!designer) throw new AuthError(404, `设计师不存在（${id}）`);
    if (!designerCanAcceptOrders(designer)) {
      throw new AuthError(
        403,
        `设计师「${designer.name}」尚未上传作品案例，暂不可委派`,
      );
    }
    if (
      order.projectType?.trim() &&
      !designerCoversProjectType(designer, order.projectType)
    ) {
      throw new AuthError(
        403,
        `设计师「${designer.name}」：${projectTypeMismatchMessage(order.projectType.trim())}`,
      );
    }
  }

  const stageId = order.stages[0]?.id ?? `${order.id}_s1`;
  const real = selections.filter((s) => s.l3);
  if (real.length > 0) {
    order.trackAssignments = real.map(
      (s) =>
        ({
          id: randomId("trk"),
          l1: s.l1,
          l2: s.l2,
          l3: s.l3,
          designerId: s.designerId,
          stageId,
          status: "pending_match",
        }) satisfies OrderTrackAssignment,
    );
    order.designerId = real[0]!.designerId;
  } else {
    order.trackAssignments = undefined;
    order.designerId = selections[0]!.designerId;
  }
  order.status = "pending_designer_accept";
}

/**
 * 设计师拒绝后：按专业槽位自动再匹配；若无人可配则回到 matching。
 */
async function rematchAfterDesignerReject(
  order: Order,
  rejectedDesignerId: string,
  rejectedName: string,
  reason?: string,
): Promise<Order> {
  const match = order.clientMatch;
  if (match?.trackPools?.length) {
    return rematchTrackPoolsAfterReject(
      order,
      match,
      rejectedDesignerId,
      rejectedName,
      reason,
    );
  }

  const level = match?.offerLevel ?? match?.selectedLevel;
  const excluded = new Set([
    ...(match?.excludedDesignerIds ?? []),
    rejectedDesignerId,
  ]);

  order.designerId = "";
  order.trackAssignments = undefined;

  if (match && level) {
    const designers = await listDesigners();
    const next = pickRematchDesigner({
      designers,
      order,
      level,
      excludeIds: excluded,
    });
    if (next) {
      const levelQuote = ensureLevelQuotes(order).find(
        (q) => q.assumptions.designerLevel === level,
      );
      if (levelQuote) {
        order.quote = {
          ...levelQuote,
          status: "confirmed",
          confirmedAt: nowIso(),
        };
        order.totalAmount = levelQuote.total;
        rebuildDefaultStages(order);
      }
      await applyDesignerOffer(order, next.id, level);
      const pools = buildMatchPools({
        designers,
        order,
        levels: match.selectedLevels,
        quoteTotalByLevel: Object.fromEntries(
          ensureLevelQuotes(order).map((q) => [
            q.assumptions.designerLevel,
            q.total,
          ]),
        ),
        excludeIds: excluded,
      });
      const pool = pools.find((p) => p.level === level);
      if (pool && !pool.candidates.some((c) => c.designerId === next.id)) {
        pool.candidates = [
          { designerId: next.id },
          ...pool.candidates,
        ].slice(0, 3);
      }
      order.clientMatch = {
        ...match,
        pools,
        offerDesignerId: next.id,
        offerLevel: level,
        offerStatus: "pending",
        selectedDesignerId: next.id,
        selectedLevel: level,
        excludedDesignerIds: Array.from(excluded),
      };
      order.messages.push({
        id: randomId("msg"),
        authorId: "system",
        authorRole: "system",
        content: reason?.trim()
          ? `设计师「${rejectedName}」已拒绝委派（${reason.trim()}）。系统已自动改派「${next.name}」。`
          : `设计师「${rejectedName}」已拒绝委派，系统已自动改派「${next.name}」。`,
        createdAt: nowIso(),
      });
      await saveOrder(order);
      await notifyDesignerAssignmentOffer(order, next.id, {
        designerName: next.name,
      });
      await notifyClientDesignerRematch(order, rejectedName, next.name);
      return order;
    }
  }

  order.status = "matching";
  if (match) {
    const designers = await listDesigners();
    const pools = buildMatchPools({
      designers,
      order,
      levels: match.selectedLevels,
      quoteTotalByLevel: Object.fromEntries(
        ensureLevelQuotes(order).map((q) => [
          q.assumptions.designerLevel,
          q.total,
        ]),
      ),
      excludeIds: excluded,
    });
    order.clientMatch = {
      ...match,
      pools,
      offerDesignerId: undefined,
      offerLevel: undefined,
      offerStatus: "rejected",
      selectedDesignerId: undefined,
      excludedDesignerIds: Array.from(excluded),
    };
  }
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: reason?.trim()
      ? `设计师「${rejectedName}」已拒绝委派（${reason.trim()}）。暂无更多同等级可接单设计师，请重新选择备选或换档匹配。`
      : `设计师「${rejectedName}」已拒绝委派。暂无更多同等级可接单设计师，请重新选择备选或换档匹配。`,
    createdAt: nowIso(),
  });
  await saveOrder(order);
  await notifyClientDesignerRematch(order, rejectedName);
  await notifyAdminsAssignmentRejected(order, rejectedName, reason);
  return order;
}

async function rematchTrackPoolsAfterReject(
  order: Order,
  match: NonNullable<Order["clientMatch"]>,
  rejectedDesignerId: string,
  rejectedName: string,
  reason?: string,
): Promise<Order> {
  const excluded = new Set([
    ...(match.excludedDesignerIds ?? []),
    rejectedDesignerId,
  ]);
  const designers = await listDesigners();
  const keptAssignments = (order.trackAssignments ?? []).filter(
    (a) => a.designerId !== rejectedDesignerId,
  );
  const rejectedAssignments = (order.trackAssignments ?? []).filter(
    (a) => a.designerId === rejectedDesignerId,
  );

  // 整单无专业分工：等同旧版整单再匹配
  if (!rejectedAssignments.length && order.designerId === rejectedDesignerId) {
    order.designerId = "";
    order.trackAssignments = undefined;
    const next = pickRematchDesignerForTrack({
      designers,
      order,
      levels: match.selectedLevels,
      excludeIds: excluded,
    });
    if (next) {
      const pool = match.trackPools![0]!;
      await applyTrackDesignerOffers(order, [
        {
          designerId: next.designer.id,
          l1: pool.l1,
          l2: pool.l2,
          l3: pool.l3,
        },
      ]);
      const refreshed = buildTrackMatchPools({
        designers,
        order,
        levels: match.selectedLevels,
        excludeIds: excluded,
      });
      const first = refreshed[0] ?? pool;
      if (!first.candidates.some((c) => c.designerId === next.designer.id)) {
        first.candidates = [
          { designerId: next.designer.id, level: next.level },
          ...first.candidates,
        ].slice(0, 3);
      }
      order.clientMatch = {
        ...match,
        trackPools: [
          {
            ...first,
            selectedDesignerId: next.designer.id,
            offerDesignerId: next.designer.id,
            offerLevel: next.level,
            offerStatus: "pending",
          },
        ],
        offerDesignerId: next.designer.id,
        offerLevel: next.level,
        offerStatus: "pending",
        selectedDesignerId: next.designer.id,
        selectedLevel: next.level,
        excludedDesignerIds: Array.from(
          new Set([...excluded, next.designer.id]),
        ),
      };
      order.messages.push({
        id: randomId("msg"),
        authorId: "system",
        authorRole: "system",
        content: reason?.trim()
          ? `设计师「${rejectedName}」已拒绝委派（${reason.trim()}）。系统已自动改派「${next.designer.name}」。`
          : `设计师「${rejectedName}」已拒绝委派，系统已自动改派「${next.designer.name}」。`,
        createdAt: nowIso(),
      });
      await saveOrder(order);
      await notifyDesignerAssignmentOffer(order, next.designer.id, {
        designerName: next.designer.name,
      });
      await notifyClientDesignerRematch(
        order,
        rejectedName,
        next.designer.name,
      );
      return order;
    }

    order.status = "matching";
    order.clientMatch = {
      ...match,
      trackPools: buildTrackMatchPools({
        designers,
        order,
        levels: match.selectedLevels,
        excludeIds: excluded,
      }),
      offerDesignerId: undefined,
      offerLevel: undefined,
      offerStatus: "rejected",
      selectedDesignerId: undefined,
      excludedDesignerIds: Array.from(excluded),
    };
    order.messages.push({
      id: randomId("msg"),
      authorId: "system",
      authorRole: "system",
      content: reason?.trim()
        ? `设计师「${rejectedName}」已拒绝委派（${reason.trim()}）。暂无更多可接单设计师，请重新选择备选或换档匹配。`
        : `设计师「${rejectedName}」已拒绝委派。暂无更多可接单设计师，请重新选择备选或换档匹配。`,
      createdAt: nowIso(),
    });
    await saveOrder(order);
    await notifyClientDesignerRematch(order, rejectedName);
    await notifyAdminsAssignmentRejected(order, rejectedName, reason);
    return order;
  }

  const rematched: OrderTrackAssignment[] = [];
  const rematchNames: string[] = [];
  const failedTitles: string[] = [];
  const notified = new Set<string>();

  for (const a of rejectedAssignments) {
    const trackKey = `${a.l2}:${a.l3}`;
    const pool =
      match.trackPools!.find((p) => p.trackKey === trackKey) ??
      match.trackPools!.find((p) => p.l2 === a.l2 && p.l3 === a.l3);
    const next = pickRematchDesignerForTrack({
      designers,
      order,
      levels: match.selectedLevels,
      excludeIds: excluded,
      preferL3: a.l3,
    });
    if (!next) {
      failedTitles.push(
        pool ? trackPoolTitle(pool) : formatAssignTrackLabel(a.l1, a.l2, a.l3),
      );
      continue;
    }
    excluded.add(next.designer.id);
    rematched.push({
      ...a,
      id: randomId("trk"),
      designerId: next.designer.id,
      status: "pending_match",
    });
    rematchNames.push(next.designer.name);
    if (!notified.has(next.designer.id)) {
      notified.add(next.designer.id);
    }
  }

  order.trackAssignments = [...keptAssignments, ...rematched];
  order.designerId =
    order.trackAssignments[0]?.designerId ??
    keptAssignments[0]?.designerId ??
    "";

  // 刷新备选池，并把新派设计师写回对应槽位
  const refreshedPools = buildTrackMatchPools({
    designers,
    order,
    levels: match.selectedLevels,
    excludeIds: excluded,
  }).map((p) => {
    const prev = match.trackPools!.find((x) => x.trackKey === p.trackKey);
    const assignment = order.trackAssignments?.find(
      (a) => a.l2 === p.l2 && a.l3 === p.l3,
    );
    if (!assignment) {
      return {
        ...p,
        selectedDesignerId: undefined,
        offerDesignerId: undefined,
        offerLevel: undefined,
        offerStatus: "rejected" as const,
      };
    }
    const level =
      prev?.candidates.find((c) => c.designerId === assignment.designerId)
        ?.level ??
      p.candidates.find((c) => c.designerId === assignment.designerId)?.level ??
      match.selectedLevels[0]!;
    if (!p.candidates.some((c) => c.designerId === assignment.designerId)) {
      p.candidates = [
        { designerId: assignment.designerId, level },
        ...p.candidates,
      ].slice(0, 3);
    }
    return {
      ...p,
      selectedDesignerId: assignment.designerId,
      offerDesignerId: assignment.designerId,
      offerLevel: level,
      offerStatus:
        assignment.status === "serving"
          ? ("accepted" as const)
          : ("pending" as const),
    };
  });

  if (failedTitles.length === 0 && rematched.length > 0) {
    order.status = "pending_designer_accept";
    order.clientMatch = {
      ...match,
      trackPools: refreshedPools,
      offerStatus: "pending",
      offerDesignerId: rematched[0]!.designerId,
      excludedDesignerIds: Array.from(excluded),
    };
    const names = Array.from(new Set(rematchNames)).join("、");
    order.messages.push({
      id: randomId("msg"),
      authorId: "system",
      authorRole: "system",
      content: reason?.trim()
        ? `设计师「${rejectedName}」已拒绝委派（${reason.trim()}）。系统已自动改派「${names}」。`
        : `设计师「${rejectedName}」已拒绝委派，系统已自动改派「${names}」。`,
      createdAt: nowIso(),
    });
    await saveOrder(order);
    for (const designerId of notified) {
      const d = await getDesigner(designerId);
      if (!d) continue;
      const myTracks = (order.trackAssignments ?? []).filter(
        (a) => a.designerId === designerId,
      );
      const trackLabels = myTracks
        .map((a) => {
          const labels = resolveTrackLabels(a.l1, a.l2, a.l3);
          return `${labels.l2Label}·${labels.l3Label}`;
        })
        .join("、");
      await notifyDesignerAssignmentOffer(order, designerId, {
        designerName: d.name,
        trackLabels: trackLabels || undefined,
      });
    }
    await notifyClientDesignerRematch(order, rejectedName, names);
    return order;
  }

  // 部分/全部专业无法再匹配 → 回到 matching，已接单专业保留
  order.status = "matching";
  order.clientMatch = {
    ...match,
    trackPools: refreshedPools,
    offerDesignerId: undefined,
    offerLevel: undefined,
    offerStatus: "rejected",
    selectedDesignerId: undefined,
    excludedDesignerIds: Array.from(excluded),
  };
  // 保留已接单专业的 trackAssignments，清空待确认中被拒且未改派的
  if (keptAssignments.some((a) => a.status === "serving")) {
    order.trackAssignments = keptAssignments.filter((a) => a.status === "serving");
    order.designerId = order.trackAssignments[0]?.designerId ?? "";
  } else {
    order.trackAssignments = undefined;
    order.designerId = "";
  }

  const failNote = failedTitles.length
    ? `「${failedTitles.join("、")}」暂无更多可接单设计师，请重新选择或换档匹配。`
    : "请重新选择备选或换档匹配。";
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: reason?.trim()
      ? `设计师「${rejectedName}」已拒绝委派（${reason.trim()}）。${failNote}`
      : `设计师「${rejectedName}」已拒绝委派。${failNote}`,
    createdAt: nowIso(),
  });
  await saveOrder(order);
  await notifyClientDesignerRematch(order, rejectedName);
  await notifyAdminsAssignmentRejected(order, rejectedName, reason);
  return order;
}

/** 修改待确认报价 / 待匹配订单的委托信息（委托人或管理员） */
export async function updateMatchingOrder(
  orderId: string,
  clientId: string | null,
  patch: MatchingOrderUpdateInput,
  options?: { asAdmin?: boolean },
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  assertOrderNotCancelled(order);
  if (!options?.asAdmin) {
    if (!clientId || order.clientId !== clientId) {
      throw new AuthError(403, "无权操作该订单");
    }
    if (order.status !== "pending_quote") {
      throw new AuthError(409, "已匹配设计师后不可再修改项目信息");
    }
  } else if (order.status !== "matching" && order.status !== "pending_quote") {
    throw new AuthError(409, "仅待确认报价或待匹配设计师状态可修改委托信息");
  }
  if (
    order.status === "matching" &&
    (order.clientMatch?.offerStatus === "pending" ||
      order.clientMatch?.trackPools?.some((p) => p.offerStatus === "pending"))
  ) {
    throw new AuthError(409, "设计师确认接单中，暂不可修改；请等待对方回应");
  }

  const hadCsConfirm = Boolean(order.csQuoteConfirmedAt);
  const beforeUpdate = JSON.parse(JSON.stringify(order)) as Order;

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new AuthError(400, "项目标题不能为空");
    order.title = title;
  }
  if (patch.description !== undefined) {
    order.description = patch.description.trim();
  }
  if (patch.projectType !== undefined) {
    order.projectType = patch.projectType.trim();
  }
  if (patch.expectedDeliveryAt !== undefined) {
    order.expectedDeliveryAt = patch.expectedDeliveryAt;
  }
  if (patch.serviceMode !== undefined) {
    order.serviceMode = patch.serviceMode;
  }
  if (patch.withAuditService !== undefined) {
    order.withAuditService = patch.withAuditService;
  }
  if (patch.withProjectManagement !== undefined) {
    order.withProjectManagement = patch.withProjectManagement;
  }
  if (patch.projectAreaSqm !== undefined) {
    order.projectAreaSqm =
      patch.projectAreaSqm > 0 ? patch.projectAreaSqm : undefined;
  }
  if (patch.attachments !== undefined) {
    order.attachments = patch.attachments.length ? patch.attachments : undefined;
  }

  const isTimeBilling =
    order.billingMode === "daily" || order.billingMode === "monthly";
  const lineInputs =
    patch.timeQuoteLines?.length
      ? patch.timeQuoteLines
      : extractTimeQuoteLineInputsFromOrder(order);
  let regeneratedQuotes = false;

  if (isTimeBilling && lineInputs.length > 0) {
    const baseQuote =
      order.levelQuotes?.find((q) => q.lines?.length) ?? order.quote;
    const unit =
      baseQuote?.lines[0]?.unit ??
      (order.billingMode === "monthly" ? "month" : "day");
    const taxCoefficient =
      patch.taxCoefficient && patch.taxCoefficient > 0
        ? patch.taxCoefficient
        : baseQuote?.taxCoefficient;
    try {
      const client = await getClient(order.clientId);
      const levelQuotes = buildRegularTimeQuotesByLevel({
        unit,
        serviceMode: order.serviceMode === "onsite" ? "onsite" : "remote",
        withDrawing: Boolean(baseQuote?.assumptions.withDrawing),
        withAudit: Boolean(order.withAuditService),
        withPM: Boolean(order.withProjectManagement),
        lines: lineInputs,
        designerRegion: baseQuote?.assumptions.designerRegion,
        clientLevel: client?.level ?? DEFAULT_CLIENT_LEVEL,
        taxCoefficient,
      });
      order.levelQuotes = levelQuotes;
      const mid =
        levelQuotes.find((q) => q.assumptions.designerLevel === "mid_v1") ??
        levelQuotes[0]!;
      order.quote = { ...mid, status: "pending" };
      order.totalAmount = mid.total;
      rebuildDefaultStages(order);
      regeneratedQuotes = true;
    } catch (e) {
      throw new AuthError(
        400,
        e instanceof Error ? e.message : "无法按最新信息重新生成报价",
      );
    }
  } else if (patch.totalAmount !== undefined) {
    if (!(patch.totalAmount > 0)) {
      throw new AuthError(400, "订单预算须大于 0");
    }
    const next = Math.round(patch.totalAmount);
    if (next !== order.totalAmount) {
      order.totalAmount = next;
      rebuildDefaultStages(order);
    }
  }

  // 修改后需重新选卡 / 匹配，并重新走客服确认
  order.clientMatch = undefined;
  order.designerId = "";
  order.trackAssignments = undefined;
  order.csQuoteConfirmedAt = undefined;
  order.csQuoteConfirmedBy = undefined;
  if (regeneratedQuotes || order.levelQuotes?.length) {
    order.status = "pending_quote";
    if (order.quote) {
      order.quote = { ...order.quote, status: "pending", confirmedAt: undefined };
    }
  }

  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: regeneratedQuotes
      ? options?.asAdmin
        ? "管理员已更新委托信息，系统已按最新内容重新生成等级报价卡。请客服再次确认后，委托人方可匹配设计师。"
        : "委托人已更新委托信息，系统已按最新内容重新生成等级报价卡。请客服再次确认后，方可匹配设计师。"
      : options?.asAdmin
        ? "管理员已更新委托信息，请客服确认后按最新内容匹配设计师。"
        : "委托人已更新委托信息，请客服确认后按最新内容匹配设计师。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
  if (options?.asAdmin) {
    try {
      const changes = describeEntrustUpdates(beforeUpdate, order);
      await notifyClientEntrustUpdatedByAdmin(order, changes);
    } catch (err) {
      console.error("[order] 通知委托人委托信息已更新失败", order.id, err);
    }
  }
  if (
    hadCsConfirm &&
    order.status === "pending_quote" &&
    (order.levelQuotes?.length || order.quote)
  ) {
    await notifyAdminsPendingCsQuote(order);
  }
  return order;
}

/** 管理员取消尚未履约的订单 → cancelled，并通知委托人 */
export async function cancelOrderByAdmin(
  orderId: string,
  reason?: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (!ADMIN_CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
    throw new AuthError(
      409,
      "仅待确认报价或待匹配设计师的订单可由管理员取消",
    );
  }

  const note = reason?.trim();
  order.status = "cancelled";
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: note
      ? `平台已取消本订单。原因：${note}`
      : "平台已取消本订单。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
  await notifyOrderCancelledByAdmin(order, note);
  return order;
}

/**
 * 永久删除订单。仅「已取消」「已完成」可删；委托人删本人订单，管理员可删任意。
 * 删除后不可恢复。
 */
export async function deleteOrderPermanently(
  orderId: string,
  actor: { role: string; identityId: string },
): Promise<void> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.status !== "cancelled" && order.status !== "completed") {
    throw new AuthError(409, "仅已取消或已完成的订单可以删除");
  }

  if (actor.role === "client") {
    if (order.clientId !== actor.identityId) {
      throw new AuthError(403, "无权删除该订单");
    }
  } else if (actor.role !== "admin" && actor.role !== "super_admin") {
    throw new AuthError(403, "无权删除订单");
  }

  await deleteOrder(orderId);
}

/** 管理员/平台为常规委托委派设计师：matching → pending_designer_accept */
export type AssignDesignerInput = {
  designerId?: string;
  totalAmount?: number;
  assignments?: Array<{
    l1?: Specialty;
    l2: string;
    l3: string;
    designerId: string;
  }>;
};

export async function assignDesignerToOrder(
  orderId: string,
  input: AssignDesignerInput | string,
  legacyTotalAmount?: number,
): Promise<Order> {
  const payload: AssignDesignerInput =
    typeof input === "string"
      ? { designerId: input, totalAmount: legacyTotalAmount }
      : input;

  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  assertOrderNotCancelled(order);
  if (order.status !== "matching") {
    throw new AuthError(409, "订单当前状态不可委派设计师");
  }

  const inferredTracks = extractOrderAssignTracks(order);
  let assignmentSpecs = payload.assignments?.length
    ? payload.assignments
    : null;

  if (!assignmentSpecs?.length && payload.designerId) {
    if (inferredTracks.length > 0) {
      assignmentSpecs = inferredTracks.map((t) => ({
        l1: t.l1,
        l2: t.l2,
        l3: t.l3,
        designerId: payload.designerId!,
      }));
    }
  }

  if (!assignmentSpecs?.length && !payload.designerId) {
    throw new AuthError(400, "请指定设计师");
  }

  const designerIds = Array.from(
    new Set(
      (assignmentSpecs ?? [{ designerId: payload.designerId! }]).map(
        (a) => a.designerId,
      ),
    ),
  );

  const designers = [];
  for (const id of designerIds) {
    const designer = await getDesigner(id);
    if (!designer) throw new AuthError(404, `设计师不存在（${id}）`);
    if (!designerCanAcceptOrders(designer)) {
      throw new AuthError(
        403,
        `设计师「${designer.name}」尚未上传作品案例，暂不可委派`,
      );
    }
    if (designer.acceptingOrders === false) {
      throw new AuthError(403, `设计师「${designer.name}」当前未开启接单`);
    }
    if (
      order.projectType?.trim() &&
      !designerCoversProjectType(designer, order.projectType)
    ) {
      throw new AuthError(
        403,
        `设计师「${designer.name}」：${projectTypeMismatchMessage(order.projectType.trim())}`,
      );
    }
    designers.push(designer);
  }

  if (payload.totalAmount != null && payload.totalAmount > 0) {
    order.totalAmount = payload.totalAmount;
    rebuildDefaultStages(order);
  }

  const stageId = order.stages[0]?.id ?? `${order.id}_s1`;
  if (assignmentSpecs?.length) {
    order.trackAssignments = assignmentSpecs.map((spec) => {
      const l1 = spec.l1 ?? order.specialty;
      const l2 =
        spec.l2 ||
        resolveL2ForL3(l1, spec.l3) ||
        inferredTracks.find((t) => t.l3 === spec.l3)?.l2 ||
        "";
      return {
        id: randomId("trk"),
        l1,
        l2,
        l3: spec.l3,
        designerId: spec.designerId,
        stageId,
        status: "pending_match" as const,
      } satisfies OrderTrackAssignment;
    });
    order.designerId = assignmentSpecs[0]!.designerId;
  } else {
    order.designerId = payload.designerId!;
    order.trackAssignments = undefined;
  }

  order.status = "pending_designer_accept";

  const nameList = designers.map((d) => d.name).join("、");
  const trackNote =
    order.trackAssignments && order.trackAssignments.length > 1
      ? `（已按 ${order.trackAssignments.length} 个专业分别委派）`
      : "";
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `平台已委派设计师「${nameList}」并确认费用${trackNote}，等待设计师确认接单。`,
    createdAt: nowIso(),
  });
  await saveOrder(order);

  for (const designer of designers) {
    const myTracks = (order.trackAssignments ?? []).filter(
      (a) => a.designerId === designer.id,
    );
    const trackLabels = myTracks
      .map((a) => {
        const labels = resolveTrackLabels(a.l1, a.l2, a.l3);
        return `${labels.l2Label}·${labels.l3Label}`;
      })
      .join("、");
    await notifyDesignerAssignmentOffer(order, designer.id, {
      designerName: designer.name,
      trackLabels: trackLabels || undefined,
    });
  }
  return order;
}

/** 设计师同意委派：全部相关设计师确认后 → pending_contract */
export async function acceptDesignerAssignment(
  orderId: string,
  designerId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (!orderInvolvesDesigner(order, designerId)) {
    throw new AuthError(403, "无权操作该订单");
  }
  if (order.status !== "pending_designer_accept") {
    throw new AuthError(409, "订单当前状态不可确认委派");
  }

  const designer = await getDesigner(designerId);
  if (designer?.level === "intern") {
    const active = (await listOrders({ designerId })).filter((o) =>
      ACTIVE_ORDER_STATUSES.includes(o.status),
    );
    if (active.length >= 1) {
      throw new AuthError(
        409,
        "见习设计师同时仅可承接 1 个进行中订单，请完成当前订单后再接单",
      );
    }
  }

  const assignments = order.trackAssignments ?? [];
  if (assignments.length > 0) {
    let touched = false;
    for (const a of assignments) {
      if (a.designerId === designerId && a.status === "pending_match") {
        a.status = "serving";
        touched = true;
      }
    }
    if (!touched && order.designerId !== designerId) {
      throw new AuthError(409, "您没有待确认的专业委派");
    }

    const designerName = designer?.name ?? "设计师";
    const pendingLeft = assignments.filter((a) => a.status === "pending_match");
    if (pendingLeft.length > 0) {
      order.messages.push({
        id: randomId("msg"),
        authorId: "system",
        authorRole: "system",
        content: `设计师「${designerName}」已确认接单，仍有 ${pendingLeft.length} 个专业等待其他设计师确认。`,
        createdAt: nowIso(),
      });
      await saveOrder(order);
      await notifyClientDesignerAccepted(order, designerName);
      return order;
    }
  } else if (order.designerId !== designerId) {
    throw new AuthError(403, "无权操作该订单");
  }

  order.status = "pending_contract";
  if (order.clientMatch) {
    order.clientMatch = {
      ...order.clientMatch,
      offerStatus: "accepted",
    };
  }
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "设计师已确认接单，请双方签署电子合同。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
  await notifyClientDesignerAccepted(order, designer?.name ?? "设计师");
  return order;
}

/** 设计师拒绝委派：有委托人匹配池则自动再派；否则回到 matching */
export async function rejectDesignerAssignment(
  orderId: string,
  designerId: string,
  reason?: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (!orderInvolvesDesigner(order, designerId)) {
    throw new AuthError(403, "无权操作该订单");
  }
  if (order.status !== "pending_designer_accept") {
    throw new AuthError(409, "订单当前状态不可拒绝委派");
  }

  const designer = await getDesigner(designerId);
  const designerName = designer?.name ?? "设计师";
  const note = reason?.trim();

  if (order.clientMatch?.trackPools?.length || order.clientMatch?.pools?.length) {
    return rematchAfterDesignerReject(order, designerId, designerName, note);
  }

  order.designerId = "";
  order.trackAssignments = undefined;
  order.status = "matching";
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: note
      ? `设计师「${designerName}」已拒绝委派。原因：${note}`
      : `设计师「${designerName}」已拒绝委派，请管理员重新匹配。`,
    createdAt: nowIso(),
  });
  await saveOrder(order);
  await notifyAdminsAssignmentRejected(order, designerName, note);
  return order;
}

/** 悬赏委托人确认中标设计师：创建订单并进入待签约 */
export async function awardBountyToDesigner(
  bountyId: string,
  designerId: string,
  clientId: string,
): Promise<Order> {
  const bounty = await getBounty(bountyId);
  if (!bounty) throw new AuthError(404, "悬赏不存在");
  if (bounty.publisherId !== clientId) {
    throw new AuthError(403, "无权操作该悬赏");
  }
  const applicant = bounty.applicants.find((a) => a.designerId === designerId);
  if (!applicant) throw new AuthError(404, "该设计师未报名此悬赏");

  const designer = await getDesigner(designerId);
  if (!designer) throw new AuthError(404, "设计师不存在");
  if (!designerCanAcceptOrders(designer)) {
    throw new AuthError(403, "该设计师尚未上传作品案例，暂不可中标");
  }
  if (
    bounty.projectType?.trim() &&
    !designerCoversProjectType(designer, bounty.projectType)
  ) {
    throw new AuthError(
      403,
      projectTypeMismatchMessage(bounty.projectType.trim()),
    );
  }

  const order = buildOrder({
    designerId,
    clientId,
    title: bounty.title,
    specialty: bounty.specialty,
    projectType: bounty.projectType ?? "",
    serviceMode: "online",
    billingMode: "area",
    orderSource: "bounty",
    totalAmount: applicant.quotedAmount ?? bounty.reward,
    description: bounty.description,
  });
  order.status = "pending_contract";
  order.bountyId = bountyId;
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `悬赏「${bounty.title}」已确认中标设计师，请双方签署合同。`,
    createdAt: nowIso(),
  });
  await createOrder(order);

  bounty.status = "awarded";
  bounty.awardedDesignerId = designerId;
  bounty.orderId = order.id;
  await saveBounty(bounty);

  return order;
}

/** 设计师确认档期：pending_schedule → pending_contract */
export async function confirmSchedule(
  orderId: string,
  designerId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.designerId !== designerId) throw new AuthError(403, "无权操作该订单");
  if (order.status !== "pending_schedule") {
    throw new AuthError(409, "订单当前状态不可确认档期");
  }

  const designer = await getDesigner(designerId);
  if ((designer?.level ?? "intern") === "intern") {
    const myOrders = await listOrders({ designerId });
    const hasActive = myOrders.some(
      (o) => o.id !== orderId && ACTIVE_ORDER_STATUSES.includes(o.status),
    );
    if (hasActive) {
      throw new AuthError(
        409,
        "见习等级同时仅可接 1 单，请先完成当前进行中的订单，或等待管理员晋升后再接单。",
      );
    }
  }

  order.status = "pending_contract";
  const at = nowIso();
  if (order.scheduleRequestId) {
    const sch = await getScheduleRequest(order.scheduleRequestId);
    if (sch) {
      sch.status = "accepted";
      sch.respondedAt = at;
      await saveScheduleRequest(sch);
    }
  }
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "设计师已确认档期，请双方签署电子合同。",
    createdAt: at,
  });
  await saveOrder(order);
  return order;
}

/** 设计师拒绝档期：订单终止并同步档期申请 */
export async function rejectSchedule(
  orderId: string,
  designerId: string,
  reason?: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.designerId !== designerId) throw new AuthError(403, "无权操作该订单");
  if (order.status !== "pending_schedule") {
    throw new AuthError(409, "订单当前状态不可拒绝档期");
  }

  const at = nowIso();
  order.status = "terminated";
  if (order.scheduleRequestId) {
    const sch = await getScheduleRequest(order.scheduleRequestId);
    if (sch) {
      sch.status = "rejected";
      sch.respondedAt = at;
      sch.rejectReason = reason?.trim() || "档期冲突，请重新选择";
      await saveScheduleRequest(sch);
    }
  }
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `设计师已拒绝档期：${reason?.trim() || "档期冲突"}`,
    createdAt: at,
  });
  await saveOrder(order);
  return order;
}

/** 委托人签署电子合同（签约与预付分离，保持 pending_contract） */
export async function signContract(
  orderId: string,
  clientId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");
  if (order.status !== "pending_contract") {
    throw new AuthError(409, "订单当前状态不可签约");
  }
  if (order.clientSignedContract) {
    throw new AuthError(409, "委托人已签署合同");
  }

  order.clientSignedContract = true;
  const newlyFullySigned = markContractReady(order);
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "委托人已签署电子合同。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
  if (newlyFullySigned) {
    await notifyContractFullySigned(order);
  } else {
    await notifyCounterpartyContractSigned(order, "client");
  }
  return order;
}

/** 设计师签署电子合同 */
export async function designerSignContract(
  orderId: string,
  designerId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.designerId !== designerId) throw new AuthError(403, "无权操作该订单");
  if (order.status !== "pending_contract") {
    throw new AuthError(409, "订单当前状态不可签约");
  }
  if (order.designerSignedContract) {
    throw new AuthError(409, "设计师已签署合同");
  }

  order.designerSignedContract = true;
  const newlyFullySigned = markContractReady(order);
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "设计师已签署电子合同。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
  if (newlyFullySigned) {
    await notifyContractFullySigned(order);
  } else {
    await notifyCounterpartyContractSigned(order, "designer");
  }
  return order;
}

/** 委托人支付某阶段款：资金进入平台托管（设计师侧冻结） */
export async function payStage(
  orderId: string,
  stageId: string,
  clientId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");
  ensureContractReady(order);

  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (stage.status !== "pending") throw new AuthError(409, "该阶段已支付");

  const at = nowIso();
  stage.status = "frozen";
  stage.paidAt = at;
  stage.acceptanceDeadlineAt = addDays(at, ACCEPTANCE_DAYS);
  unlockStageCadDeliverables(stage);

  const hadNoPaidStage = order.stages.every(
    (s) => s.id === stageId || s.status === "pending",
  );
  if (
    hadNoPaidStage &&
    (order.status === "pending_contract" || order.status === "pending_schedule")
  ) {
    order.status = "in_progress";
  }

  const reviewJustOpened = openClientReviewWindow(order, at);

  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `委托人已支付「${stage.name}」${formatCurrency(stage.amount)}，资金已进入平台托管。`,
    createdAt: at,
  });

  await saveOrder(order);

  const clientTx: WalletTransaction = {
    id: `${stageId}_c`,
    orderId: order.id,
    orderCode: order.code,
    orderTitle: order.title,
    stageId,
    type: "income",
    amount: -stage.amount,
    status: "available",
    occurredAt: at,
    note: `${stage.name}支付（资金已托管）`,
  };
  await createWalletTransaction(order.clientId, "client", clientTx);

  const designerTx: WalletTransaction = {
    id: `${stageId}_d`,
    orderId: order.id,
    orderCode: order.code,
    orderTitle: order.title,
    type: "income",
    amount: stage.amount,
    status: "frozen",
    occurredAt: at,
    note: `${stage.name}到账（冻结期，验收后解冻）`,
  };
  await createWalletTransaction(order.designerId, "designer", designerTx);

  await notifyStagePaid(order, stage.name, stage.amount);
  if (reviewJustOpened) await notifyClientReviewOpened(order);

  return order;
}

/** 设计师上传阶段成果：预览免费、CAD 付款后解锁 */
export async function submitStageDeliverables(
  orderId: string,
  stageId: string,
  designerId: string,
  files?: DeliverableFile[],
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (!orderInvolvesDesigner(order, designerId)) {
    throw new AuthError(403, "无权操作该订单");
  }
  if (!["in_progress", "in_revision", "pending_review"].includes(order.status)) {
    throw new AuthError(409, "当前订单状态不可上传成果");
  }

  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (isPrepaymentStage(order, stage)) {
    throw new AuthError(409, "预付款阶段无需上传成果");
  }
  const revising = order.status === "in_revision";
  if (stage.status !== "pending" && !revising) {
    throw new AuthError(409, "该阶段已付款，不可重复上传");
  }
  if (!files?.length) {
    throw new AuthError(400, "请上传成果或确认单（图片或 PDF）");
  }

  const at = nowIso();
  const incoming = files.map((f) => ({
    ...f,
    designerId: f.designerId ?? designerId,
    uploadedAt: f.uploadedAt || at,
    locked: false,
  }));
  const appending =
    revising ||
    (order.status === "pending_review" &&
      (stage.deliverables?.length ?? 0) > 0);
  stage.deliverables = appending
    ? [...(stage.deliverables ?? []), ...incoming]
    : incoming;
  stage.deliverablesConfirmedAt = undefined;

  for (const assignment of order.trackAssignments ?? []) {
    if (assignment.designerId !== designerId) continue;
    const ids = new Set(assignment.deliverableIds ?? []);
    for (const file of incoming) ids.add(file.id);
    assignment.deliverableIds = [...ids];
  }

  const pendingRevision = order.revisions.find(
    (r) => r.stageId === stageId && r.status === "pending",
  );
  if (pendingRevision) {
    pendingRevision.status = "responded";
  }

  order.status = "pending_review";
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `设计师已上传「${stage.name}」成果，请委托人预览并付款解锁下载。`,
    createdAt: at,
  });
  await saveOrder(order);
  await notifyDeliverablesSubmitted(order, stage.name);
  return order;
}

/** 委托人提交返修需求 */
export async function requestStageRevision(
  orderId: string,
  stageId: string,
  clientId: string,
  description: string,
  attachments?: { name: string; url?: string; size?: number }[],
  fileId?: string,
  fileName?: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");

  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (isPrepaymentStage(order, stage)) {
    throw new AuthError(409, "预付款阶段无需确认或返修成果");
  }
  if (stage.status === "released") {
    throw new AuthError(409, "该阶段已结算，不可申请返修");
  }
  if (!(stage.deliverables?.length ?? 0)) {
    throw new AuthError(409, "该阶段暂无成果，不可申请返修");
  }
  if (!description.trim() && !(attachments?.length ?? 0)) {
    throw new AuthError(400, "请填写修改意见或上传意见文档");
  }

  const at = nowIso();
  const target =
    fileId ? stage.deliverables?.find((f) => f.id === fileId) : undefined;
  order.revisions.push({
    id: randomId("rev"),
    stageId,
    description: description.trim() || `请按意见优化「${target?.name ?? fileName ?? "本阶段成果"}」。`,
    attachments: attachments ?? [],
    createdAt: at,
    status: "pending",
    fileId,
    fileName: fileName ?? target?.name,
  });
  stage.deliverablesConfirmedAt = undefined;
  order.status = "in_revision";
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `委托人已提交「${stage.name}」返修需求，设计师将优先处理。`,
    createdAt: at,
  });
  await saveOrder(order);
  await notifyRevisionRequested(
    order,
    stage.name,
    description.trim() || "请按沟通记录优化本阶段成果。",
  );
  return order;
}

/** 委托人确认本阶段成果（可在付款前确认，各角色可见确认时间） */
export async function confirmStageDeliverables(
  orderId: string,
  stageId: string,
  clientId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");

  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (isPrepaymentStage(order, stage)) {
    throw new AuthError(409, "预付款阶段无需确认成果");
  }
  if (stage.status === "released") {
    throw new AuthError(409, "该阶段已结算");
  }
  if (!(stage.deliverables?.length ?? 0)) {
    throw new AuthError(409, "该阶段暂无成果，不可确认");
  }

  const at = nowIso();
  stage.deliverablesConfirmedAt = at;
  if (order.status === "pending_review" || order.status === "in_revision") {
    order.status = "in_progress";
  }
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `委托人已确认「${stage.name}」成果，等待付款。`,
    createdAt: at,
  });
  await saveOrder(order);
  await notifyDeliverablesConfirmed(order, stage.name);
  return order;
}

function hasPendingRevisionForStage(order: Order, stageId: string) {
  return order.revisions.some(
    (r) => r.stageId === stageId && r.status === "pending",
  );
}

/** 在内存订单上执行阶段验收解冻（不含鉴权） */
async function releaseStageOnOrder(
  order: Order,
  stageId: string,
  at: string,
  systemMessage?: string,
  options?: { auto?: boolean },
): Promise<void> {
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage || stage.status !== "frozen") return;

  stage.status = "released";
  stage.releasedAt = at;
  const stageAmount = stage.amount;
  const stageName = stage.name;
  const auto = Boolean(options?.auto);

  const allReleased = allStagesReleased(order);
  if (allReleased) {
    order.pendingSettlement = true;
    if (!order.pendingSettlementAt) order.pendingSettlementAt = at;
    if (order.status !== "completed") {
      order.status = "in_progress";
    }
    order.messages.push({
      id: randomId("msg"),
      authorId: "system",
      authorRole: "system",
      content:
        systemMessage ??
        "全部阶段成果已验收。设计师可申请结算，委托人请确认「最终服务完成」后项目结案。",
      createdAt: at,
    });
  } else if (order.status === "pending_review") {
    order.status = "in_progress";
  }

  if (systemMessage && !allReleased) {
    order.messages.push({
      id: randomId("msg"),
      authorId: "system",
      authorRole: "system",
      content: systemMessage,
      createdAt: at,
    });
  }

  await saveOrder(order);

  const designerTx: WalletTransaction = {
    id: `${stageId}_d`,
    orderId: order.id,
    orderCode: order.code,
    orderTitle: order.title,
    type: "income",
    amount: stage.amount,
    status: "available",
    occurredAt: stage.paidAt ?? at,
    releasedAt: at,
    note: `${stage.name}解冻可提现`,
  };
  await updateWalletTransaction(designerTx);

  const fee = Math.round(stage.amount * (order.feeRate ?? 0.08));
  if (fee > 0) {
    await createWalletTransaction(order.designerId, "designer", {
      id: `${stageId}_fee`,
      orderId: order.id,
      orderCode: order.code,
      orderTitle: order.title,
      type: "fee",
      amount: -fee,
      status: "available",
      occurredAt: at,
      note: `平台手续费 ${Math.round((order.feeRate ?? 0.08) * 100)}%`,
    });
  }

  await notifyStageReleased(order, stageName, stageAmount, auto);
}

/** 委托人确认验收某阶段：解冻设计师款项并扣除平台手续费 */
export async function releaseStage(
  orderId: string,
  stageId: string,
  clientId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (stage.status !== "frozen") throw new AuthError(409, "该阶段不可验收");

  await releaseStageOnOrder(order, stageId, nowIso());
  return order;
}

/** 设计师申请项目结算 */
export async function requestProjectSettlement(
  orderId: string,
  designerId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.designerId !== designerId) throw new AuthError(403, "无权操作该订单");
  if (!allStagesReleased(order)) {
    throw new AuthError(409, "尚有阶段未验收，暂不可申请结算");
  }

  const at = nowIso();
  order.pendingSettlement = true;
  if (!order.pendingSettlementAt) order.pendingSettlementAt = at;
  order.settlementRequestedAt = at;
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "设计师已申请项目结算，请委托人确认最终服务完成。",
    createdAt: at,
  });
  await saveOrder(order);
  await notifySettlementRequested(order);
  return order;
}

/** 委托人确认最终服务完成：进入已完成（评价窗口在最后一笔支付时已开启） */
export async function confirmFinalSettlement(
  orderId: string,
  clientId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");
  if (!order.pendingSettlement && !allStagesReleased(order)) {
    throw new AuthError(409, "项目尚未达到可结案状态");
  }

  const at = nowIso();
  order.pendingSettlement = false;
  order.status = "completed";
  order.settlementConfirmedAt = at;
  openClientReviewWindow(order, at);
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "委托人已确认最终服务完成，项目结案。",
    createdAt: at,
  });
  await saveOrder(order);
  await notifyFinalSettlementConfirmed(order);
  await maybeRequestPromotion(order);
  return order;
}

export interface SubmitOrderReviewInput {
  overall: number;
  breakdown: RatingBreakdown;
  content: string;
  impressionTags?: string[];
  clientDisplayName?: string;
  anonymous?: boolean;
}

/** 委托人提交项目评价 */
export async function submitOrderReview(
  orderId: string,
  clientId: string,
  input: SubmitOrderReviewInput,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");
  if (order.status === "cancelled") {
    throw new AuthError(409, "订单已取消，不可评价");
  }
  if (!allOrderStagesPaid(order)) {
    throw new AuthError(409, "项目费用尚未全部支付，暂不可评价");
  }
  if (order.clientReviewed) {
    throw new AuthError(409, "已完成评价");
  }
  const deadline = resolveReviewDeadlineAt(order);
  if (
    order.reviewExpired ||
    (deadline && new Date(deadline).getTime() < Date.now())
  ) {
    throw new AuthError(409, "评价期已结束，评论已关闭");
  }
  const comment = input.content.trim();
  if (!comment) {
    throw new AuthError(400, "请填写评论");
  }

  const at = nowIso();
  const client = await getClient(order.clientId);
  const review: DesignerProjectReview = {
    id: randomId("drev"),
    designerId: order.designerId,
    orderCode: order.code,
    projectTitle: order.title,
    projectType: order.projectType,
    clientDisplayName: client?.name ?? input.clientDisplayName ?? "委托人",
    completedAt: order.settlementConfirmedAt ?? at,
    overall: input.overall,
    breakdown: input.breakdown,
    content: comment,
    impressionTags: input.impressionTags,
    anonymous: Boolean(input.anonymous),
  };
  await createDesignerReview(review);

  order.clientReviewed = true;
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "委托人已完成项目评价，感谢你的反馈。",
    createdAt: at,
  });
  await saveOrder(order);
  await notifyDesignerReviewSubmitted(order, order.status === "completed");
  return order;
}

/** 见习设计师完成订单后，生成等待管理员确认的晋升中级工单 */
async function maybeRequestPromotion(order: Order) {
  const designer = await getDesigner(order.designerId);
  if (!designer || (designer.level ?? "intern") !== "intern") return;
  if (await hasPendingPromotion(designer.id)) return;

  const completedCount = (await listOrders({ designerId: designer.id })).filter(
    (o) => o.status === "completed",
  ).length;

  const item: ReviewItem = {
    id: `promo_${designer.id}_${Date.now().toString(36)}`,
    type: "designer_promotion",
    name: designer.name,
    submittedAt: nowIso(),
    status: "pending",
    refId: designer.id,
    payload: {
      当前等级: "见习",
      申请晋升: "中级v1",
      触发订单: order.code,
      累计完成订单: String(completedCount),
    },
  };
  await createReviewItem(item);
}

function isPastDeadline(deadline?: string): boolean {
  if (!deadline) return false;
  return new Date(deadline).getTime() <= Date.now();
}

/** 在内存订单上执行最终结案（不含鉴权） */
async function confirmSettlementOnOrder(order: Order, at: string, systemMessage: string) {
  order.pendingSettlement = false;
  order.status = "completed";
  order.settlementConfirmedAt = at;
  openClientReviewWindow(order, at);
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: systemMessage,
    createdAt: at,
  });
  await saveOrder(order);
  await notifyFinalSettlementConfirmed(order);
  await maybeRequestPromotion(order);
}

/**
 * 处理单订单超时：10 天成果自动验收、30 天自动结案、评价期（30 天）结束标记。
 * 有变更时写库并返回更新后的订单。
 */
export async function applyOrderTimeouts(order: Order): Promise<Order> {
  let changed = false;
  const at = nowIso();

  for (const stage of order.stages) {
    if (stage.status !== "frozen") continue;
    if (!isPastDeadline(stage.acceptanceDeadlineAt)) continue;
    if (hasPendingRevisionForStage(order, stage.id)) continue;
    await releaseStageOnOrder(
      order,
      stage.id,
      at,
      `「${stage.name}」验收期已满 ${ACCEPTANCE_DAYS} 天且无异议，系统已自动确认成果。`,
      { auto: true },
    );
    changed = true;
  }

  if (
    order.pendingSettlement &&
    order.status !== "completed" &&
    order.pendingSettlementAt &&
    isPastDeadline(addDays(order.pendingSettlementAt, SETTLEMENT_DAYS))
  ) {
    await confirmSettlementOnOrder(
      order,
      at,
      `待结案已满 ${SETTLEMENT_DAYS} 天，系统已自动确认最终服务完成，项目结案。`,
    );
    changed = true;
  }

  if (
    !order.clientReviewed &&
    !order.reviewExpired &&
    allOrderStagesPaid(order)
  ) {
    const deadline = resolveReviewDeadlineAt(order);
    let reviewChanged = false;
    if (deadline && !order.reviewDeadlineAt) {
      order.reviewDeadlineAt = deadline;
      reviewChanged = true;
    }
    if (deadline && isPastDeadline(deadline)) {
      order.reviewExpired = true;
      order.reviewDeadlineAt = deadline;
      order.messages.push({
        id: randomId("msg"),
        authorId: "system",
        authorRole: "system",
        content: `评价期（${CLIENT_REVIEW_DAYS} 天）已结束，本项目评论已关闭。`,
        createdAt: at,
      });
      await saveOrder(order);
      changed = true;
    } else if (reviewChanged) {
      await saveOrder(order);
      changed = true;
    }
  }

  return changed ? (await getOrder(order.id)) ?? order : order;
}

/** 批量处理全平台订单超时（供定时任务调用） */
export async function processAllOrderTimeouts(): Promise<{
  scanned: number;
  updated: number;
}> {
  const orders = await listOrders();
  let updated = 0;
  for (const order of orders) {
    const before = JSON.stringify(order);
    await applyOrderTimeouts(order);
    const after = await getOrder(order.id);
    if (after && JSON.stringify(after) !== before) updated += 1;
  }
  return { scanned: orders.length, updated };
}

/** 平台纠纷裁决：解冻设计师托管款项 */
export async function platformReleaseStage(
  orderId: string,
  stageId: string,
  note: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (stage.status !== "frozen") {
    throw new AuthError(409, "该阶段无冻结款项可解冻");
  }
  await releaseStageOnOrder(order, stageId, nowIso(), note);
  return (await getOrder(orderId)) ?? order;
}

/** 平台纠纷裁决：向委托人退还托管款项 */
export async function platformRefundFrozenStage(
  orderId: string,
  stageId: string,
  disputeId: string,
  refundAmount: number,
  note: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (stage.status !== "frozen") {
    throw new AuthError(409, "该阶段无冻结款项可退还");
  }
  if (refundAmount <= 0 || refundAmount > stage.amount) {
    throw new AuthError(400, "退款金额无效");
  }

  const at = nowIso();
  stage.status = "pending";
  stage.paidAt = undefined;
  stage.acceptanceDeadlineAt = undefined;
  stage.deliverables = stage.deliverables?.map((f) => ({ ...f, locked: true }));

  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: note,
    createdAt: at,
  });
  await saveOrder(order);

  await createWalletTransaction(order.clientId, "client", {
    id: `${disputeId}_refund_c`,
    orderId: order.id,
    orderCode: order.code,
    orderTitle: order.title,
    stageId,
    type: "refund",
    amount: refundAmount,
    status: "available",
    occurredAt: at,
    note: "平台纠纷裁决退款",
  });

  const designerTx = await getWalletTransactionForOwner(
    `${stageId}_d`,
    order.designerId,
    "designer",
  );
  if (designerTx) {
    await updateWalletTransaction({
      ...designerTx,
      type: "refund",
      amount: -refundAmount,
      status: "available",
      note: "平台纠纷裁决取消冻结款项",
    });
  }

  return (await getOrder(orderId)) ?? order;
}

/** 平台纠纷裁决：部分退款、部分解冻 */
export async function platformSplitFrozenStage(
  orderId: string,
  stageId: string,
  disputeId: string,
  clientSharePercent: number,
  note: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (stage.status !== "frozen") {
    throw new AuthError(409, "该阶段无冻结款项可裁决");
  }
  const pct = Math.min(100, Math.max(0, clientSharePercent));
  const clientPart = Math.round((stage.amount * pct) / 100);
  const designerPart = stage.amount - clientPart;
  const at = nowIso();

  stage.status = "released";
  stage.releasedAt = at;

  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: note,
    createdAt: at,
  });
  await saveOrder(order);

  if (clientPart > 0) {
    await createWalletTransaction(order.clientId, "client", {
      id: `${disputeId}_split_c`,
      orderId: order.id,
      orderCode: order.code,
      orderTitle: order.title,
      stageId,
      type: "refund",
      amount: clientPart,
      status: "available",
      occurredAt: at,
      note: `平台部分裁决退款（${pct}%）`,
    });
  }

  if (designerPart > 0) {
    const designerTx = await getWalletTransactionForOwner(
      `${stageId}_d`,
      order.designerId,
      "designer",
    );
    if (designerTx) {
      await updateWalletTransaction({
        ...designerTx,
        amount: designerPart,
        status: "available",
        releasedAt: at,
        note: `平台部分裁决解冻（${100 - pct}%）`,
      });
    }
    const fee = Math.round(designerPart * (order.feeRate ?? 0.08));
    if (fee > 0) {
      await createWalletTransaction(order.designerId, "designer", {
        id: `${stageId}_fee_split`,
        orderId: order.id,
        orderCode: order.code,
        orderTitle: order.title,
        type: "fee",
        amount: -fee,
        status: "available",
        occurredAt: at,
        note: `平台手续费 ${Math.round((order.feeRate ?? 0.08) * 100)}%`,
      });
    }
  } else {
    const designerTx = await getWalletTransactionForOwner(
      `${stageId}_d`,
      order.designerId,
      "designer",
    );
    if (designerTx) {
      await updateWalletTransaction({
        ...designerTx,
        type: "refund",
        amount: -stage.amount,
        status: "available",
        note: "平台部分裁决取消设计师冻结款项",
      });
    }
  }

  return (await getOrder(orderId)) ?? order;
}
