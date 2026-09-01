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
import { designerHasL3, normalizeBountyTrack } from "@/lib/bounty-tracks";
import { resolveBountyPaymentStages } from "@/lib/bounty-payment-stages";
import {
  bountyDesignerDeductionRate,
  bountyTaxCoefficient,
  resolveBountyInvoiceType,
} from "@/lib/bounty-invoice";
import {
  extractOrderAssignTracks,
  formatAssignTrackLabel,
  orderInvolvesDesigner,
  resolveL2ForL3,
} from "@/lib/order-assign-tracks";
import { resolveTrackLabels } from "@/lib/constants";
import { resolveOrderPlatformFeeRate, platformFeeAmountFromOrder } from "@/lib/directed-platform-fee";
import {
  resolveDeliverableConfirmDeadlineAt,
  resolveStageEscrowEndsAt,
} from "@/lib/platform-commerce";
import { formatCurrency } from "@/lib/utils";
import { maskDesignerPublicName } from "@/lib/designer-contact-privacy";
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
  allowsPostPaymentDeliverables,
  buildDefaultPaymentStages,
  buildStagesFromRatios,
  isLastDeliverablesConfirmed,
  stageRequiresDeliverables,
} from "@/lib/order-payment-stages";
import { getStageParticipantGroups } from "@/lib/stage-track-groups";
import { isAllowedDeliverableFile } from "@/lib/deliverable-files";
import {
  canClientConfirmPhase,
  clientConfirmLabel,
  resolveDeliverablePhase,
  uploadKindForPhase,
} from "@/lib/deliverable-phase";
import {
  CLIENT_REVIEW_DAYS,
  allOrderStagesPaid,
  formatClientReviewWindow,
  isClientReviewClosed,
  needsClientReview,
  resolveReviewDeadlineAt,
} from "@/lib/client-review";
import { assignContractIdIfMissing } from "@/lib/order-lifecycle";
import {
  SELF_ORDER_PENDING_CLIENT_ID,
  isSelfOrderPendingClaim,
} from "@/lib/self-order-share";
import {
  describeScanQuoteDiff,
  isScanAwaitingClientQuoteConfirm,
  isScanAwaitingDesignerQuote,
  normalizeScanQuoteTerms,
  scanQuoteTermsEqual,
  scanQuoteTermsFromOrder,
} from "@/lib/scan-order";
import { needsCsQuoteConfirm } from "@/lib/order-supervision";
import { describeEntrustUpdates } from "@/lib/entrust-update-diff";
import { CLIENT_QUOTE_LEVELS, buildRegularAreaQuotesByLevel, buildRegularTimeQuotesByLevel, extractAreaQuoteInputFromOrder, extractTimeQuoteLineInputsFromOrder, rebuildTimeQuoteFromAssignments, type RegularAreaQuoteTrackInput, type RegularTimeQuoteLineInput } from "@/lib/regular-entrust-quote";
import {
  STRUCTURE_L3,
  STRUCTURE_L3_LABEL,
  applyStructureLineToQuotes,
  getStructureSheetsFromOrder,
  parsePositiveIntSheets,
  structureFeeFromSheets,
} from "@/lib/structure-sheets";
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
  getPlatformPricing,
  findOrderByDeliverablesConfirmShareId,
  findOrderByReviewShareId,
  findOrderBySelfOrderShareId,
} from "./repo";
import { buildOrder, type CreateOrderInput } from "./order-builder";
import {
  designerCanAcceptOrders,
  designerCoversProjectType,
  projectTypeMismatchMessage,
} from "@/lib/designer-portfolio-readiness";
import {
  notifyAdminsMatchingOrder,
  notifyAdminsClientSelectedDesigner,
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
  notifyDesignerScanOrderSubmitted,
  notifyDesignerScanQuoteConfirmed,
  notifyClientScanQuoteConfirmed,
  notifyDirectedScanQuoteChanged,
  notifyFinalSettlementConfirmed,
  notifyOrderCancelledByAdmin,
  notifyRevisionRequested,
  notifySettlementRequested,
  notifyStagePaid,
  notifyStageReleased,
  notifyClientReviewOpened,
  designerIdForSameAccountAsClient,
  isSameAccountClientAndDesigner,
} from "@/lib/server/inbox";

/** 管理员可取消的早期订单状态（尚未进入履约） */
export const ADMIN_CANCELLABLE_ORDER_STATUSES: OrderStatus[] = [
  "pending_quote",
  "matching",
];

async function rebuildDefaultStages(order: Order) {
  const pricing = await getPlatformPricing();
  order.stages = buildDefaultPaymentStages({
    orderId: order.id,
    totalAmount: order.totalAmount,
    billingMode: order.billingMode,
    selectedMonths: order.selectedMonths,
    expectedDeliveryAt: order.expectedDeliveryAt,
    onsiteSchedule: order.onsiteSchedule,
    quote: order.quote,
    levelQuotes: order.levelQuotes,
    commerce: pricing.commerce,
  });
}
import { AuthError } from "./auth";

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

const SAME_ACCOUNT_COUNTERPARTY_MESSAGE =
  "同一账号的委托人和设计师不能互为订单双方";

async function matchExcludeIds(order: Order, extra?: Iterable<string>) {
  const excluded = new Set([
    ...(order.clientMatch?.excludedDesignerIds ?? []),
    ...(extra ?? []),
  ]);
  const selfDesignerId = await designerIdForSameAccountAsClient(order.clientId);
  if (selfDesignerId) excluded.add(selfDesignerId);
  return excluded;
}

async function assertNotSameAccountCounterparty(
  clientId: string,
  designerId: string,
) {
  if (await isSameAccountClientAndDesigner(clientId, designerId)) {
    throw new AuthError(403, SAME_ACCOUNT_COUNTERPARTY_MESSAGE);
  }
}

function markContractReady(order: Order): boolean {
  assignContractIdIfMissing(order);
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

/** 费用付清且最终成果已确认后开启 30 天评价窗口。返回是否新开窗（需通知委托人）。 */
function openClientReviewWindow(order: Order, at: string): boolean {
  if (order.status === "cancelled" || order.clientReviewed) return false;
  if (!allOrderStagesPaid(order)) return false;
  if (!isLastDeliverablesConfirmed(order)) return false;
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
      `最终成果已确认。欢迎对设计师进行评分和评论，评价将于 ${CLIENT_REVIEW_DAYS} 天后关闭。`,
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
    await assertNotSameAccountCounterparty(input.clientId, input.designerId);
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

  const pricing = await getPlatformPricing();
  const order = buildOrder({ ...input, commerce: input.commerce ?? pricing.commerce });
  if (order.orderSource === "scan") {
    order.scanQuoteLastActor = "client";
  }
  await createOrder(order);

  if (order.status === "pending_schedule" && order.designerId) {
    if (order.orderSource === "scan") {
      await notifyDesignerScanOrderSubmitted(order);
    } else {
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
  }

  if (
    order.status === "pending_quote" &&
    (order.levelQuotes?.length || order.quote)
  ) {
    await notifyAdminsPendingCsQuote(order);
  }

  return order;
}

/** 设计师自己下单：先填项目与费用，再把确认链接发给委托人 */
export async function placeDesignerSelfOrder(
  designerId: string,
  input: Omit<CreateOrderInput, "clientId" | "designerId">,
): Promise<{ order: Order; share: { code: string; shareId: string } }> {
  const designer = await getDesigner(designerId);
  if (!designer) throw new AuthError(404, "设计师不存在");
  if (!designerCanAcceptOrders(designer)) {
    throw new AuthError(403, "请先上传作品案例后再发起自己下单");
  }
  if (
    input.projectType?.trim() &&
    !designerCoversProjectType(designer, input.projectType)
  ) {
    throw new AuthError(403, projectTypeMismatchMessage(input.projectType.trim()));
  }
  const total = Math.round(Number(input.totalAmount) || 0);
  if (!Number.isFinite(total) || total <= 0) {
    throw new AuthError(400, "请填写有效的订单金额");
  }
  const stages = (input.customStageRatios ?? []).filter(
    (s) => s.name.trim() && s.ratio > 0,
  );
  if (stages.length < 1) {
    throw new AuthError(400, "请至少设置一个付款阶段");
  }
  const ratioSum = stages.reduce(
    (sum, s) => sum + (s.ratio > 1 ? s.ratio / 100 : s.ratio),
    0,
  );
  if (Math.abs(ratioSum - 1) > 0.02) {
    throw new AuthError(400, "付款阶段比例合计须为 100%");
  }

  const pricing = await getPlatformPricing();
  const order = buildOrder({
    ...input,
    designerId,
    clientId: SELF_ORDER_PENDING_CLIENT_ID,
    totalAmount: total,
    customStageRatios: stages,
    commerce: input.commerce ?? pricing.commerce,
  });
  const at = nowIso();
  order.selfOrderPendingClaim = true;
  order.selfOrderShareCode = fourDigitCode();
  order.selfOrderShareId = randomId("slf");
  if (order.orderSource === "scan") {
    order.scanQuoteProposedAt = at;
    order.scanQuoteLastActor = "designer";
  }
  order.messages[0] = {
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "设计师已填写订单，等待委托人通过分享链接确认后双方签约。",
    createdAt: at,
  };
  await createOrder(order);
  return {
    order,
    share: {
      code: order.selfOrderShareCode,
      shareId: order.selfOrderShareId,
    },
  };
}

export async function getSelfOrderShareView(shareId: string) {
  const order = await findOrderBySelfOrderShareId(shareId);
  if (!order || !order.selfOrderShareId) {
    throw new AuthError(404, "确认链接不存在或已失效");
  }
  const designer = order.designerId
    ? await getDesigner(order.designerId)
    : undefined;
  const pending = isSelfOrderPendingClaim(order);
  return {
    shareId: order.selfOrderShareId,
    confirmed: !pending && order.status !== "pending_schedule",
    canConfirm: pending && order.status === "pending_schedule",
    order: {
      id: order.id,
      code: order.code,
      title: order.title,
      projectType: order.projectType,
      billingMode: order.billingMode,
      serviceMode: order.serviceMode,
      expectedDeliveryAt: order.expectedDeliveryAt,
      specialty: order.specialty,
      description: order.description,
      totalAmount: order.totalAmount,
      projectAreaSqm: order.projectAreaSqm,
    },
    designer: {
      id: designer?.id ?? order.designerId ?? "",
      name: designer ? maskDesignerPublicName(designer.name) : "设计师",
      avatar: designer?.avatar ?? null,
    },
    stages: order.stages.map((s) => ({
      name: s.name,
      ratio: s.ratio,
      amount: s.amount,
      note: s.note,
    })),
  };
}

/** 委托人通过分享链接确认设计师自己下单 → 绑定委托人并进入签约 */
export async function confirmSelfOrderByShare(
  shareId: string,
  code: string,
  clientId: string,
) {
  const order = await findOrderBySelfOrderShareId(shareId);
  if (!order) throw new AuthError(404, "确认链接不存在或已失效");
  if (!order.selfOrderShareCode || !codesEqual(code, order.selfOrderShareCode)) {
    throw new AuthError(403, "验证码不正确");
  }
  if (!isSelfOrderPendingClaim(order) || order.status !== "pending_schedule") {
    throw new AuthError(409, "该订单已确认或已进入后续流程");
  }
  await assertNotSameAccountCounterparty(clientId, order.designerId);
  const client = await getClient(clientId);
  if (!client) throw new AuthError(404, "委托人不存在");

  const at = nowIso();
  order.clientId = clientId;
  order.selfOrderPendingClaim = false;
  order.status = "pending_contract";
  assignContractIdIfMissing(order);
  if (order.orderSource === "scan" && !order.scanQuoteProposedAt) {
    order.scanQuoteProposedAt = at;
  }
  order.messages.push({
    id: randomId("msg"),
    authorId: clientId,
    authorRole: "client",
    content: "委托人已确认订单、费用与付款阶段，请双方签署电子合同。",
    createdAt: at,
  });
  await saveOrder(order);
  await notifyDesignerScanQuoteConfirmed(order);
  return getSelfOrderShareView(shareId);
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
  areaQuote?: {
    area: number;
    projectType: string;
    buildType: "new" | "renovation";
    tracks: RegularAreaQuoteTrackInput[];
    taxCoefficient?: number;
    structure?: {
      mode: "pending" | "estimate";
      sheets?: number;
    };
  };
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
  await rebuildDefaultStages(order);
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
  const excluded = await matchExcludeIds(order);
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
  await rebuildDefaultStages(order);
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
  await assertNotSameAccountCounterparty(order.clientId, designerId);
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
    await rebuildDefaultStages(order);
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
  await notifyAdminsClientSelectedDesigner(order, [designer.name]);
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
    await assertNotSameAccountCounterparty(order.clientId, id);
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
    await rebuildDefaultStages(order);
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
  await notifyAdminsClientSelectedDesigner(
    order,
    designers.map((d) => d.name),
  );
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
  const excluded = await matchExcludeIds(order, [rejectedDesignerId]);

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
        await rebuildDefaultStages(order);
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
  const excluded = await matchExcludeIds(order, [rejectedDesignerId]);
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
      baseQuote?.lines.find((l) => l.unit === "month" || l.unit === "day")
        ?.unit === "month"
        ? "month"
        : "day";
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
      await rebuildDefaultStages(order);
      regeneratedQuotes = true;
    } catch (e) {
      throw new AuthError(
        400,
        e instanceof Error ? e.message : "无法按最新信息重新生成报价",
      );
    }
  } else if (order.billingMode === "area") {
    const extracted = extractAreaQuoteInputFromOrder(order);
    const areaInput = patch.areaQuote
      ? {
          area: patch.areaQuote.area,
          projectType: patch.areaQuote.projectType || order.projectType,
          buildType: patch.areaQuote.buildType,
          tracks: patch.areaQuote.tracks,
          structure: patch.areaQuote.structure ?? extracted?.structure,
          taxCoefficient: patch.areaQuote.taxCoefficient,
          designerRegion: extracted?.designerRegion,
          clientLevel: extracted?.clientLevel,
        }
      : extracted
        ? {
            ...extracted,
            area: patch.projectAreaSqm ?? extracted.area,
            projectType: order.projectType || extracted.projectType,
            taxCoefficient:
              patch.taxCoefficient && patch.taxCoefficient > 0
                ? patch.taxCoefficient
                : extracted.taxCoefficient,
          }
        : null;
    if (
      areaInput &&
      (areaInput.tracks.length > 0 || areaInput.structure) &&
      (areaInput.tracks.length === 0 || areaInput.area > 0)
    ) {
      try {
        const client = await getClient(order.clientId);
        const levelQuotes = buildRegularAreaQuotesByLevel({
          ...areaInput,
          withAudit: Boolean(order.withAuditService),
          withPM: Boolean(order.withProjectManagement),
          clientLevel: client?.level ?? DEFAULT_CLIENT_LEVEL,
        });
        order.levelQuotes = levelQuotes;
        const mid =
          levelQuotes.find((q) => q.assumptions.designerLevel === "mid_v1") ??
          levelQuotes[0]!;
        order.quote = { ...mid, status: "pending" };
        order.totalAmount = mid.total;
        await rebuildDefaultStages(order);
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
        await rebuildDefaultStages(order);
      }
    }
  } else if (patch.totalAmount !== undefined) {
    if (!(patch.totalAmount > 0)) {
      throw new AuthError(400, "订单预算须大于 0");
    }
    const next = Math.round(patch.totalAmount);
    if (next !== order.totalAmount) {
      order.totalAmount = next;
      await rebuildDefaultStages(order);
    }
  }

  if (
    order.billingMode === "monthly" &&
    order.stages.every((s) => !s.status || s.status === "pending")
  ) {
    await rebuildDefaultStages(order);
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

function canRebuildStructureIntoQuotes(order: Order) {
  if (isContractFullySigned(order)) return false;
  if (order.stages.some((s) => s.status && s.status !== "pending")) return false;
  return (
    order.status === "pending_quote" ||
    order.status === "matching" ||
    order.status === "pending_designer_accept" ||
    order.status === "pending_contract"
  );
}

function addStructureFeeToUnpaidStage(order: Order, delta: number) {
  if (!(delta > 0)) return;
  const amount = Math.round(delta);
  const unpaid = [...order.stages]
    .reverse()
    .find((s) => !s.status || s.status === "pending");
  if (unpaid) {
    unpaid.amount = Math.round((unpaid.amount ?? 0) + amount);
  } else {
    order.stages.push({
      id: randomId("stg"),
      name: "结构增补",
      amount,
      ratio: 0,
      status: "pending",
    });
  }
  const total =
    order.totalAmount > 0
      ? order.totalAmount
      : order.stages.reduce((sum, s) => sum + (s.amount ?? 0), 0);
  for (const stage of order.stages) {
    stage.ratio = total > 0 ? (stage.amount ?? 0) / total : 0;
  }
}

/** 管理员 / 超级管理员在任意环节设定或增加景观结构张数（450 元/张） */
export async function updateOrderStructureSheets(
  orderId: string,
  input: { sheets?: number; addSheets?: number },
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  assertOrderNotCancelled(order);

  const current = getStructureSheetsFromOrder(order);
  const addSheets = parsePositiveIntSheets(input.addSheets);
  const setSheets = parsePositiveIntSheets(input.sheets);
  let next: number;
  if (addSheets != null) {
    next = current + addSheets;
  } else if (setSheets != null) {
    if (setSheets < current && current > 0 && !canRebuildStructureIntoQuotes(order)) {
      throw new AuthError(409, "履约中仅可增加结构设计张数");
    }
    next = setSheets;
  } else {
    throw new AuthError(400, "请填写大于零的整数张数");
  }
  if (next === current) return order;

  const beforeSheets = current;
  const rebuilt = canRebuildStructureIntoQuotes(order);
  const isTimeBilling =
    order.billingMode === "daily" || order.billingMode === "monthly";

  if (rebuilt && order.billingMode === "area") {
    const extracted = extractAreaQuoteInputFromOrder(order);
    if (extracted) {
      const client = await getClient(order.clientId);
      const levelQuotes = buildRegularAreaQuotesByLevel({
        ...extracted,
        structure: { mode: "estimate", sheets: next },
        withAudit: Boolean(order.withAuditService),
        withPM: Boolean(order.withProjectManagement),
        clientLevel: client?.level ?? DEFAULT_CLIENT_LEVEL,
      });
      order.levelQuotes = levelQuotes;
      const mid =
        levelQuotes.find((q) => q.assumptions.designerLevel === "mid_v1") ??
        levelQuotes[0]!;
      order.quote = {
        ...mid,
        status: order.quote?.status ?? "pending",
        confirmedAt: order.quote?.confirmedAt,
      };
      order.totalAmount = mid.total;
      await rebuildDefaultStages(order);
    } else {
      applyStructureSheetsInPlace(order, next, { retax: true });
      await rebuildDefaultStages(order);
    }
  } else if (rebuilt && isTimeBilling) {
    const lineInputs = extractTimeQuoteLineInputsFromOrder(order);
    const without = lineInputs.filter((l) => l.l3 !== STRUCTURE_L3);
    without.push({
      l3: STRUCTURE_L3,
      l3Label: STRUCTURE_L3_LABEL,
      quantity: next,
      quantityPending: false,
    });
    if (without.length > 0) {
      const baseQuote =
        order.levelQuotes?.find((q) => q.lines?.length) ?? order.quote;
      const unit =
        baseQuote?.lines.find((l) => l.unit === "month" || l.unit === "day")
          ?.unit === "month"
          ? "month"
          : "day";
      const client = await getClient(order.clientId);
      const levelQuotes = buildRegularTimeQuotesByLevel({
        unit,
        serviceMode: order.serviceMode === "onsite" ? "onsite" : "remote",
        withDrawing: Boolean(baseQuote?.assumptions.withDrawing),
        withAudit: Boolean(order.withAuditService),
        withPM: Boolean(order.withProjectManagement),
        lines: without,
        designerRegion: baseQuote?.assumptions.designerRegion,
        clientLevel: client?.level ?? DEFAULT_CLIENT_LEVEL,
        taxCoefficient: baseQuote?.taxCoefficient,
      });
      order.levelQuotes = levelQuotes;
      const mid =
        levelQuotes.find((q) => q.assumptions.designerLevel === "mid_v1") ??
        levelQuotes[0]!;
      order.quote = {
        ...mid,
        status: order.quote?.status ?? "pending",
        confirmedAt: order.quote?.confirmedAt,
      };
      order.totalAmount = mid.total;
      await rebuildDefaultStages(order);
    } else {
      applyStructureSheetsInPlace(order, next, { retax: true });
      await rebuildDefaultStages(order);
    }
  } else {
    const delta = structureFeeFromSheets(next) - structureFeeFromSheets(current);
    applyStructureSheetsInPlace(order, next, { retax: false });
    order.totalAmount = Math.max(0, Math.round((order.totalAmount ?? 0) + delta));
    addStructureFeeToUnpaidStage(order, delta);
  }

  if (
    rebuilt &&
    (order.status === "pending_quote" || order.status === "matching")
  ) {
    order.csQuoteConfirmedAt = undefined;
    order.csQuoteConfirmedBy = undefined;
    if (order.status === "matching") {
      order.status = "pending_quote";
    }
    if (order.quote) {
      order.quote = {
        ...order.quote,
        status: "pending",
        confirmedAt: undefined,
      };
    }
  }

  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content:
      beforeSheets > 0
        ? `管理员已将景观结构专业调整为 ${next} 张（原 ${beforeSheets} 张），结构费用按 450 元/张计入订单。`
        : `管理员已确认景观结构专业 ${next} 张，结构费用按 450 元/张计入订单。`,
    createdAt: nowIso(),
  });
  await saveOrder(order);
  try {
    await notifyClientEntrustUpdatedByAdmin(order, [
      beforeSheets > 0
        ? `· 景观结构专业：${beforeSheets} 张 → ${next} 张`
        : `· 景观结构专业：已确认为 ${next} 张`,
    ]);
  } catch (err) {
    console.error("[order] 通知委托人结构张数已更新失败", order.id, err);
  }
  if (
    rebuilt &&
    order.status === "pending_quote" &&
    (order.levelQuotes?.length || order.quote)
  ) {
    await notifyAdminsPendingCsQuote(order);
  }
  return order;
}

function applyStructureSheetsInPlace(
  order: Order,
  sheets: number,
  options?: { retax?: boolean },
) {
  if (order.quote || order.levelQuotes?.length) {
    const next = applyStructureLineToQuotes(
      { quote: order.quote, levelQuotes: order.levelQuotes },
      { sheets, pending: false },
      options,
    );
    order.quote = next.quote;
    order.levelQuotes = next.levelQuotes;
    if (options?.retax && order.quote) {
      order.totalAmount = order.quote.total;
    }
    return;
  }
  const fee = structureFeeFromSheets(sheets);
  order.quote = {
    status: "confirmed",
    generatedAt: nowIso(),
    basicFee: fee,
    platformFee: 0,
    auditFee: 0,
    projectManagementFee: 0,
    subtotal: fee,
    taxCoefficient: 1,
    total: fee,
    lines: [
      {
        track: "structure",
        trackLabel: "结构",
        l3: STRUCTURE_L3,
        l3Label: STRUCTURE_L3_LABEL,
        quantity: sheets,
        unit: "sheet",
        difficulty: 1,
        difficultyLabel: "按张计价",
        basicFee: fee,
        platformFee: 0,
        subtotal: fee,
      },
    ],
    assumptions: {
      designerLevel: "mid_v1",
      designerRegion: "tier3",
      clientLevel: DEFAULT_CLIENT_LEVEL,
      serviceMode: order.serviceMode === "onsite" ? "onsite" : "remote",
      withDrawing: false,
      note: "景观结构专业按 450 元/张计入。",
    },
  };
  if (options?.retax) order.totalAmount = fee;
}
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
    await assertNotSameAccountCounterparty(order.clientId, id);
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
    await rebuildDefaultStages(order);
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
  assignContractIdIfMissing(order);
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
  await assertNotSameAccountCounterparty(clientId, designerId);

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

  const bountyStages = resolveBountyPaymentStages(bounty);
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
    customStageRatios: bountyStages.map((stage) => ({
      name: stage.name,
      ratio: stage.ratio,
      note: stage.note,
    })),
    taxCoefficient: bountyTaxCoefficient(resolveBountyInvoiceType(bounty)),
  });
  const invoiceType = resolveBountyInvoiceType(bounty);
  order.taxCoefficient = bountyTaxCoefficient(invoiceType);
  order.feeRate = bountyDesignerDeductionRate(invoiceType);
  order.status = "pending_contract";
  assignContractIdIfMissing(order);
  order.bountyId = bountyId;
  if (bounty.primaryTrack) {
    order.primaryTrack = normalizeBountyTrack(bounty.primaryTrack);
  }
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

  await notifyAdminsClientSelectedDesigner(order, [designer.name], {
    source: "bounty",
    bountyCode: bounty.code,
  });

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
  if (order.orderSource === "scan") {
    throw new AuthError(
      409,
      "扫码订单请先提交费用与付款阶段，由委托人确认后再进入签约",
    );
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
  assignContractIdIfMissing(order);
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

type DirectedScanQuoteInput = {
  totalAmount: number;
  stages: { name: string; ratio: number; note?: string }[];
};

async function assertInternCanTakeScanOrder(designerId: string, orderId: string) {
  const designer = await getDesigner(designerId);
  if ((designer?.level ?? "intern") !== "intern") return;
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

function parseDirectedScanQuoteInput(input: DirectedScanQuoteInput): DirectedScanQuoteInput {
  const total = Math.round(Number(input.totalAmount));
  if (!Number.isFinite(total) || total <= 0) {
    throw new AuthError(400, "请填写有效的项目费用");
  }
  const stages = (input.stages ?? []).filter((s) => s.name.trim() && s.ratio > 0);
  if (stages.length < 1) {
    throw new AuthError(400, "请至少设置一个付款阶段");
  }
  const ratioSum = stages.reduce(
    (sum, s) => sum + (s.ratio > 1 ? s.ratio / 100 : s.ratio),
    0,
  );
  if (Math.abs(ratioSum - 1) > 0.02) {
    throw new AuthError(400, "付款阶段比例合计须为 100%");
  }
  return { totalAmount: total, stages };
}

/** 定向委托：接收方未改条款则确认进入签约；有改动则发回对方确认 */
async function respondDirectedScanQuote(
  orderId: string,
  actor: "designer" | "client",
  identityId: string,
  input: DirectedScanQuoteInput,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.orderSource !== "scan") {
    throw new AuthError(409, "仅扫码订单可确认费用方案");
  }
  if (isSelfOrderPendingClaim(order)) {
    throw new AuthError(409, "请先通过分享链接确认订单");
  }
  if (order.status !== "pending_schedule") {
    throw new AuthError(409, "订单当前状态不可确认费用方案");
  }
  if (actor === "designer") {
    if (order.designerId !== identityId) throw new AuthError(403, "无权操作该订单");
    if (!isScanAwaitingDesignerQuote(order)) {
      throw new AuthError(409, "当前由委托人确认费用方案");
    }
    await assertInternCanTakeScanOrder(identityId, orderId);
  } else {
    if (order.clientId !== identityId) throw new AuthError(403, "无权操作该订单");
    if (!isScanAwaitingClientQuoteConfirm(order)) {
      throw new AuthError(409, "当前由设计师确认费用方案");
    }
  }

  const parsed = parseDirectedScanQuoteInput(input);
  const prevTerms = scanQuoteTermsFromOrder(order);
  const nextTerms = normalizeScanQuoteTerms(parsed.totalAmount, parsed.stages);
  const unchanged = scanQuoteTermsEqual(prevTerms, nextTerms);
  const at = nowIso();
  const actorLabel = actor === "designer" ? "设计师" : "委托人";
  const otherLabel = actor === "designer" ? "委托人" : "设计师";

  if (unchanged) {
    if (parsed.totalAmount <= 0 && order.totalAmount <= 0) {
      throw new AuthError(409, "费用尚未确定");
    }
    if (order.totalAmount <= 0 || order.stages.every((s) => s.amount <= 0)) {
      order.totalAmount = parsed.totalAmount;
      order.stages = buildStagesFromRatios(
        order.id,
        parsed.totalAmount,
        parsed.stages,
      );
      order.feeRate = resolveOrderPlatformFeeRate(order);
    }
    order.status = "pending_contract";
    assignContractIdIfMissing(order);
    order.scanQuoteProposedAt = order.scanQuoteProposedAt ?? at;
    order.scanQuoteLastActor = actor;
    order.messages.push({
      id: randomId("msg"),
      authorId: identityId,
      authorRole: actor,
      content: `${actorLabel}已确认费用与付款阶段，请双方签署电子合同。`,
      createdAt: at,
    });
    await saveOrder(order);
    if (actor === "designer") {
      await notifyClientScanQuoteConfirmed(order);
    } else {
      await notifyDesignerScanQuoteConfirmed(order);
    }
    return order;
  }

  const changes = describeScanQuoteDiff(prevTerms, nextTerms);
  order.totalAmount = parsed.totalAmount;
  order.stages = buildStagesFromRatios(order.id, parsed.totalAmount, parsed.stages);
  order.feeRate = resolveOrderPlatformFeeRate(order);
  order.scanQuoteProposedAt = at;
  order.scanQuoteLastActor = actor;
  order.messages.push({
    id: randomId("msg"),
    authorId: identityId,
    authorRole: actor,
    content: `${actorLabel}已修改费用条款：${changes.join("；")}。请${otherLabel}确认。`,
    createdAt: at,
  });
  await saveOrder(order);
  await notifyDirectedScanQuoteChanged(order, actor, changes);
  return order;
}

/** 扫码下单：设计师提交或确认费用与付款阶段 */
export async function proposeScanQuote(
  orderId: string,
  designerId: string,
  input: DirectedScanQuoteInput,
): Promise<Order> {
  return respondDirectedScanQuote(orderId, "designer", designerId, input);
}

/** 扫码下单待报价：设计师可修正项目信息 */
export async function updateScanOrderByDesigner(
  orderId: string,
  designerId: string,
  patch: Pick<
    MatchingOrderUpdateInput,
    "title" | "description" | "expectedDeliveryAt" | "projectType"
  >,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.orderSource !== "scan") {
    throw new AuthError(409, "仅扫码订单可修改");
  }
  if (order.designerId !== designerId) throw new AuthError(403, "无权操作该订单");
  if (!isScanAwaitingDesignerQuote(order)) {
    throw new AuthError(409, "当前状态不可修改项目信息");
  }
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
  await saveOrder(order);
  return order;
}

/** 扫码下单：委托人确认费用，或修改后发回设计师 */
export async function confirmScanQuote(
  orderId: string,
  clientId: string,
  input?: DirectedScanQuoteInput,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  const stages =
    input?.stages ??
    (order.stages ?? []).map((s) => ({
      name: s.name,
      ratio: s.ratio,
      note: s.note,
    }));
  const totalAmount = input?.totalAmount ?? order.totalAmount;
  return respondDirectedScanQuote(orderId, "client", clientId, {
    totalAmount,
    stages,
  });
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
  signature?: string,
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
  if (signature) order.clientContractSignature = signature;
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
  signature?: string,
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
  if (signature) order.designerContractSignature = signature;
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
  const pricing = await getPlatformPricing();
  const afterSalesDays = pricing.commerce.afterSalesDays;
  stage.status = "frozen";
  stage.paidAt = at;
  if (stage.deliverablesConfirmedAt) {
    stage.acceptanceDeadlineAt = addDays(at, afterSalesDays);
  } else if (!stageRequiresDeliverables(order, stage)) {
    stage.acceptanceDeadlineAt = addDays(at, afterSalesDays);
  } else {
    stage.acceptanceDeadlineAt = undefined;
  }
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

function assertDeliverableStageWritable(
  order: Order,
  stage: NonNullable<Order["stages"][number]>,
  revising: boolean,
  action: "upload" | "skip" | "delete",
) {
  if (!stageRequiresDeliverables(order, stage)) {
    throw new AuthError(409, "预付款阶段无需上传成果");
  }
  if (stage.status === "released") {
    throw new AuthError(409, "该阶段已结算，不可再处理成果");
  }
  const postPay = allowsPostPaymentDeliverables(order, stage);
  if (stage.status !== "pending" && !revising && !postPay) {
    throw new AuthError(
      409,
      action === "delete" ? "该阶段已付款，不可删除成果" : "该阶段已付款，不可重复上传",
    );
  }
  if (postPay && stage.deliverablesConfirmedAt && !revising) {
    throw new AuthError(409, "最终成果已确认，不可再更改");
  }
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
  const revising = order.status === "in_revision";
  assertDeliverableStageWritable(order, stage, revising, "upload");
  if (!files?.length) {
    throw new AuthError(400, "请上传成果或确认单（图片、PDF、CAD 或压缩包）");
  }
  const invalid = files.find((f) => !isAllowedDeliverableFile(f));
  if (invalid) {
    throw new AuthError(
      400,
      `「${invalid.name}」类型不支持，请上传图片、PDF、CAD 或压缩包`,
    );
  }

  const at = nowIso();
  const incoming = files.map((f) => ({
    ...f,
    designerId: f.designerId ?? designerId,
    uploadedAt: f.uploadedAt || at,
    locked: false,
    kind: f.kind ?? uploadKindForPhase(stage, order.status),
  }));
  stage.deliverables = [...(stage.deliverables ?? []), ...incoming];
  const kind = incoming[0]?.kind ?? "preliminary";
  if (kind === "final" || kind === "revision") {
    stage.deliverablesConfirmedAt = undefined;
    stage.acceptanceDeadlineAt = undefined;
  }

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
  const phaseLabel =
    kind === "preliminary"
      ? "初步成果"
      : kind === "revision"
        ? "返修成果"
        : "最终成果 / 确认单";
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `设计师已上传「${stage.name}」${phaseLabel}，请委托人预览确认。`,
    createdAt: at,
  });
  await saveOrder(order);
  await notifyDeliverablesSubmitted(order, stage.name, kind);
  return order;
}

/** 设计师跳过初步成果，直接进入最终成果 / 确认单 */
export async function skipPreliminaryDeliverables(
  orderId: string,
  stageId: string,
  designerId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (!orderInvolvesDesigner(order, designerId)) {
    throw new AuthError(403, "无权操作该订单");
  }
  if (!["in_progress", "pending_review"].includes(order.status)) {
    throw new AuthError(409, "当前订单状态不可跳过初步成果");
  }
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  assertDeliverableStageWritable(order, stage, false, "skip");
  if (resolveDeliverablePhase(stage, order.status) !== "preliminary") {
    throw new AuthError(409, "当前已进入最终成果步骤");
  }

  const at = nowIso();
  stage.preliminarySkippedAt = at;
  if (order.status === "pending_review") {
    order.status = "in_progress";
  }
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `设计师已跳过「${stage.name}」初步成果，将直接上传最终成果 / 确认单。`,
    createdAt: at,
  });
  await saveOrder(order);
  return order;
}

/** 设计师删除尚未付款阶段的本人成果 */
export async function deleteStageDeliverable(
  orderId: string,
  stageId: string,
  designerId: string,
  fileId: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (!orderInvolvesDesigner(order, designerId)) {
    throw new AuthError(403, "无权操作该订单");
  }
  if (!["in_progress", "in_revision", "pending_review"].includes(order.status)) {
    throw new AuthError(409, "当前订单状态不可删除成果");
  }

  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  const revising = order.status === "in_revision";
  assertDeliverableStageWritable(order, stage, revising, "delete");

  const file = stage.deliverables?.find((f) => f.id === fileId);
  if (!file) throw new AuthError(404, "成果文件不存在");
  if (file.locked) throw new AuthError(409, "该成果已锁定，不可删除");
  const ownFile =
    file.designerId === designerId ||
    (!file.designerId && order.designerId === designerId);
  if (!ownFile) throw new AuthError(403, "只能删除本人上传的成果");

  const at = nowIso();
  stage.deliverables = (stage.deliverables ?? []).filter((f) => f.id !== fileId);
  stage.deliverablesConfirmedAt = undefined;

  for (const assignment of order.trackAssignments ?? []) {
    if (!assignment.deliverableIds?.length) continue;
    assignment.deliverableIds = assignment.deliverableIds.filter(
      (id) => id !== fileId,
    );
  }

  if (
    !(stage.deliverables?.length ?? 0) &&
    order.status === "pending_review"
  ) {
    order.status = "in_progress";
  }

  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `设计师已删除「${stage.name}」成果「${file.name}」。`,
    createdAt: at,
  });
  await saveOrder(order);
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
  if (!stageRequiresDeliverables(order, stage)) {
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
  stage.acceptanceDeadlineAt = undefined;
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
  if (!stageRequiresDeliverables(order, stage)) {
    throw new AuthError(409, "预付款阶段无需确认成果");
  }
  if (stage.status === "released") {
    throw new AuthError(409, "该阶段已结算");
  }
  if (!canClientConfirmPhase(stage, order.status)) {
    throw new AuthError(409, "该步骤暂无待确认成果");
  }

  const at = nowIso();
  const phase = resolveDeliverablePhase(stage, order.status);
  if (phase === "preliminary") {
    stage.preliminaryConfirmedAt = at;
    if (order.status === "pending_review" || order.status === "in_revision") {
      order.status = "in_progress";
    }
    order.messages.push({
      id: randomId("msg"),
      authorId: "system",
      authorRole: "system",
      content: `委托人已确认「${stage.name}」初步成果，请设计师上传最终成果 / 确认单。`,
      createdAt: at,
    });
    await saveOrder(order);
    await notifyDeliverablesConfirmed(order, stage.name, "preliminary");
    return order;
  }

  stage.deliverablesConfirmedAt = at;
  if (stage.status === "frozen" || stage.status === "paid") {
    const pricing = await getPlatformPricing();
    stage.acceptanceDeadlineAt = addDays(
      at,
      pricing.commerce.afterSalesDays,
    );
  }
  if (order.status === "pending_review" || order.status === "in_revision") {
    order.status = "in_progress";
  }
  const fulfillmentDone =
    allOrderStagesPaid(order) && isLastDeliverablesConfirmed(order);
  const reviewJustOpened = fulfillmentDone
    ? openClientReviewWindow(order, at)
    : false;
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: fulfillmentDone
      ? `委托人已确认「${stage.name}」最终成果，项目履约完成，可进行评价。`
      : `委托人已确认「${stage.name}」最终成果，等待付款。`,
    createdAt: at,
  });
  await saveOrder(order);
  await notifyDeliverablesConfirmed(order, stage.name, "final");
  if (reviewJustOpened) await notifyClientReviewOpened(order);
  return order;
}

function fourDigitCode() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

function codesEqual(a: string, b: string) {
  return a.trim() === b.trim();
}

/** 委托人 / 设计师 / 管理员：确保本阶段有转发成果码与链接 */
export async function ensureDeliverablesConfirmShare(
  orderId: string,
  stageId: string,
): Promise<{ code: string; shareId: string }> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (!stageRequiresDeliverables(order, stage)) {
    throw new AuthError(409, "预付款阶段无需转发成果");
  }

  let changed = false;
  if (!stage.deliverablesConfirmCode) {
    stage.deliverablesConfirmCode = fourDigitCode();
    changed = true;
  }
  if (!stage.deliverablesConfirmShareId) {
    stage.deliverablesConfirmShareId = randomId("dcf");
    changed = true;
  }
  if (changed) await saveOrder(order);
  return {
    code: stage.deliverablesConfirmCode,
    shareId: stage.deliverablesConfirmShareId,
  };
}

async function buildDeliverablesConfirmView(
  order: Order,
  stageId: string,
): Promise<import("@/lib/deliverables-confirm-share").DeliverablesConfirmView> {
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage || !stage.deliverablesConfirmShareId) {
    throw new AuthError(404, "确认链接不存在或已失效");
  }
  const groups = getStageParticipantGroups(order, stage);
  const { DEFAULT_SERVICE_PROVIDERS } = await import(
    "@/lib/service-provider-catalog"
  );
  const people = await Promise.all(
    groups.map(async (group) => {
      if (group.role === "designer") {
        const designer = await getDesigner(group.personId);
        return {
          id: group.personId,
          name: designer?.name ?? "设计师",
          avatar: designer?.avatar ?? null,
          roleLabel: "设计师",
          trackLabel: group.label,
        };
      }
      const provider = DEFAULT_SERVICE_PROVIDERS.find(
        (p) => p.id === group.personId,
      );
      return {
        id: group.personId,
        name: provider?.name ?? group.label,
        avatar: provider?.avatar ?? null,
        roleLabel: group.role === "auditor" ? "审图师" : "项目管理员",
        trackLabel: group.label,
      };
    }),
  );
  const files = (stage.deliverables ?? []).map((file) => {
    const designerName = people.find((p) => p.id === file.designerId)?.name;
    return { ...file, uploaderName: designerName };
  });
  const phase = resolveDeliverablePhase(stage, order.status);
  return {
    shareId: stage.deliverablesConfirmShareId,
    confirmed: phase === "done",
    confirmedAt: stage.deliverablesConfirmedAt,
    phase,
    confirmLabel: clientConfirmLabel(phase),
    canConfirm: canClientConfirmPhase(stage, order.status),
    preliminaryConfirmedAt: stage.preliminaryConfirmedAt,
    preliminarySkipped: Boolean(stage.preliminarySkippedAt),
    order: {
      id: order.id,
      code: order.code,
      title: order.title,
      projectType: order.projectType,
      billingMode: order.billingMode,
      serviceMode: order.serviceMode,
      expectedDeliveryAt: order.expectedDeliveryAt,
      specialty: order.specialty,
      description: order.description,
    },
    stage: {
      id: stage.id,
      name: stage.name,
      amount: stage.amount,
      ratio: stage.ratio,
    },
    people,
    files,
  };
}

/** 公开页：按转发链接查看待确认成果 */
export async function getDeliverablesConfirmShareView(shareId: string) {
  const found = await findOrderByDeliverablesConfirmShareId(shareId);
  if (!found) throw new AuthError(404, "确认链接不存在或已失效");
  return buildDeliverablesConfirmView(found.order, found.stageId);
}

/** 公开页：输入验证码后确认成果 */
export async function confirmStageDeliverablesByShare(
  shareId: string,
  code: string,
) {
  const found = await findOrderByDeliverablesConfirmShareId(shareId);
  if (!found) throw new AuthError(404, "确认链接不存在或已失效");
  const { order } = found;
  const stage = order.stages.find((s) => s.id === found.stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (stage.deliverablesConfirmedAt && resolveDeliverablePhase(stage, order.status) === "done") {
    return buildDeliverablesConfirmView(order, stage.id);
  }
  if (!stage.deliverablesConfirmCode || !codesEqual(code, stage.deliverablesConfirmCode)) {
    throw new AuthError(400, "验证码不正确");
  }
  await confirmStageDeliverables(order.id, stage.id, order.clientId);
  const latest = (await getOrder(order.id)) ?? order;
  return buildDeliverablesConfirmView(latest, stage.id);
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

  if (stageRequiresDeliverables(order, stage) && !stage.deliverablesConfirmedAt) {
    stage.deliverablesConfirmedAt = at;
  }

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

  const reviewJustOpened = openClientReviewWindow(order, at);
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

  const feeRate = resolveOrderPlatformFeeRate(order);
  const fee = platformFeeAmountFromOrder(order, stage.amount);
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
      note: `平台手续费 ${Math.round(feeRate * 100)}%`,
    });
  }

  await notifyStageReleased(order, stageName, stageAmount, auto);
  if (reviewJustOpened) await notifyClientReviewOpened(order);
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
  if (!isLastDeliverablesConfirmed(order)) {
    throw new AuthError(409, "请先确认最终成果后再评价");
  }
  if (order.clientReviewed) {
    return order;
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

/** 委托人工作台：确保本单有转发评价码与链接 */
export async function ensureOrderReviewShare(
  orderId: string,
  clientId: string,
): Promise<{ code: string; shareId: string }> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");
  if (!needsClientReview(order)) {
    throw new AuthError(409, "当前订单不可转发评价");
  }

  let changed = false;
  if (!order.reviewShareCode) {
    order.reviewShareCode = fourDigitCode();
    changed = true;
  }
  if (!order.reviewShareId) {
    order.reviewShareId = randomId("revf");
    changed = true;
  }
  if (changed) await saveOrder(order);
  return {
    code: order.reviewShareCode,
    shareId: order.reviewShareId,
  };
}

async function buildOrderReviewShareView(
  order: Order,
): Promise<import("@/lib/review-share").OrderReviewShareView> {
  if (!order.reviewShareId) {
    throw new AuthError(404, "评价链接不存在或已失效");
  }
  const designer = order.designerId
    ? await getDesigner(order.designerId)
    : undefined;
  const canSubmit = needsClientReview(order);
  return {
    shareId: order.reviewShareId,
    submitted: Boolean(order.clientReviewed),
    closed: isClientReviewClosed(order),
    canSubmit,
    deadlineHint: formatClientReviewWindow(order),
    order: {
      id: order.id,
      code: order.code,
      title: order.title,
      projectType: order.projectType,
      billingMode: order.billingMode,
      specialty: order.specialty,
    },
    designer: {
      id: designer?.id ?? order.designerId ?? "",
      name: designer
        ? maskDesignerPublicName(designer.name)
        : "设计师",
      avatar: designer?.avatar ?? null,
    },
  };
}

/** 公开页：按转发链接查看待评价项目 */
export async function getOrderReviewShareView(shareId: string) {
  const order = await findOrderByReviewShareId(shareId);
  if (!order) throw new AuthError(404, "评价链接不存在或已失效");
  return buildOrderReviewShareView(order);
}

/** 公开页：输入验证码后提交评价 */
export async function submitOrderReviewByShare(
  shareId: string,
  code: string,
  input: SubmitOrderReviewInput,
) {
  const order = await findOrderByReviewShareId(shareId);
  if (!order) throw new AuthError(404, "评价链接不存在或已失效");
  if (order.clientReviewed) {
    return buildOrderReviewShareView(order);
  }
  if (!order.reviewShareCode || !codesEqual(code, order.reviewShareCode)) {
    throw new AuthError(400, "验证码不正确");
  }
  const latest = await submitOrderReview(order.id, order.clientId, input);
  return buildOrderReviewShareView(latest);
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

async function autoConfirmOverdueDeliverables(
  order: Order,
  stage: Order["stages"][number],
  at: string,
  confirmDays: number,
): Promise<boolean> {
  if (stage.deliverablesConfirmedAt) return false;
  if (!stageRequiresDeliverables(order, stage)) return false;
  if (hasPendingRevisionForStage(order, stage.id)) return false;
  if (resolveDeliverablePhase(stage, order.status) === "preliminary") {
    return false;
  }
  if (!canClientConfirmPhase(stage, order.status)) return false;
  const deadline = resolveDeliverableConfirmDeadlineAt(stage, {
    deliverableConfirmDays: confirmDays,
  });
  if (!deadline || !isPastDeadline(deadline)) return false;

  stage.deliverablesConfirmedAt = at;
  if (stage.status === "frozen" || stage.status === "paid") {
    const pricing = await getPlatformPricing();
    stage.acceptanceDeadlineAt = addDays(at, pricing.commerce.afterSalesDays);
  }
  if (order.status === "pending_review" || order.status === "in_revision") {
    order.status = "in_progress";
  }
  const fulfillmentDone =
    allOrderStagesPaid(order) && isLastDeliverablesConfirmed(order);
  const reviewJustOpened = fulfillmentDone
    ? openClientReviewWindow(order, at)
    : false;
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `设计师提交「${stage.name}」成果已满 ${confirmDays} 天，委托人未主动确认，系统已自动确认最终成果，验收期开始计时。`,
    createdAt: at,
  });
  await saveOrder(order);
  await notifyDeliverablesConfirmed(order, stage.name, "final");
  if (reviewJustOpened) await notifyClientReviewOpened(order);
  return true;
}

/**
 * 处理单订单超时：提交成果 20 天未确认则自动确认并开始验收期；
 * 验收期满自动解冻；待结案期满自动结案；评价期结束标记。
 */
export async function applyOrderTimeouts(order: Order): Promise<Order> {
  let changed = false;
  const at = nowIso();
  const pricing = await getPlatformPricing();
  const afterSalesDays = pricing.commerce.afterSalesDays;
  const confirmDays = pricing.commerce.deliverableConfirmDays;
  const escrowDays = pricing.commerce.escrowDays;

  for (const stage of order.stages) {
    if (
      stageRequiresDeliverables(order, stage) &&
      !stage.deliverablesConfirmedAt &&
      stage.acceptanceDeadlineAt
    ) {
      stage.acceptanceDeadlineAt = undefined;
      changed = true;
    }
  }
  if (changed) await saveOrder(order);

  for (const stage of order.stages) {
    if (await autoConfirmOverdueDeliverables(order, stage, at, confirmDays)) {
      changed = true;
    }
  }

  for (const stage of order.stages) {
    if (stage.status !== "frozen") continue;
    if (hasPendingRevisionForStage(order, stage.id)) continue;
    if (
      stageRequiresDeliverables(order, stage) &&
      !stage.deliverablesConfirmedAt
    ) {
      continue;
    }
    const endsAt = resolveStageEscrowEndsAt(stage, pricing.commerce, {
      requiresDeliverables: stageRequiresDeliverables(order, stage),
    });
    if (!isPastDeadline(endsAt ?? undefined)) continue;
    await releaseStageOnOrder(
      order,
      stage.id,
      at,
      `「${stage.name}」验收期已满 ${afterSalesDays} 天且无异议，系统已自动解冻结算。`,
      { auto: true },
    );
    changed = true;
  }

  if (
    order.pendingSettlement &&
    order.status !== "completed" &&
    order.pendingSettlementAt &&
    isPastDeadline(addDays(order.pendingSettlementAt, escrowDays))
  ) {
    await confirmSettlementOnOrder(
      order,
      at,
      `待结案已满 ${escrowDays} 天，系统已自动确认最终服务完成，项目结案。`,
    );
    changed = true;
  }

  if (
    !order.clientReviewed &&
    !order.reviewExpired &&
    allOrderStagesPaid(order) &&
    isLastDeliverablesConfirmed(order)
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
    const feeRate = resolveOrderPlatformFeeRate(order);
    const fee = platformFeeAmountFromOrder(order, designerPart);
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
        note: `平台手续费 ${Math.round(feeRate * 100)}%`,
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
