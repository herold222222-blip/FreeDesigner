import "server-only";
import type {
  DeliverableFile,
  DesignerProjectReview,
  Order,
  OrderStatus,
  RatingBreakdown,
  ReviewItem,
  WalletTransaction,
} from "@/lib/types";
import {
  createOrder,
  getOrder,
  saveOrder,
  createScheduleRequest,
  getScheduleRequest,
  saveScheduleRequest,
  createWalletTransaction,
  updateWalletTransaction,
  getWalletTransactionForOwner,
  getDesigner,
  listOrders,
  createReviewItem,
  hasPendingPromotion,
  createDesignerReview,
  getBounty,
  saveBounty,
} from "./repo";
import { buildOrder, type CreateOrderInput } from "./order-builder";

function rebuildDefaultStages(order: Order) {
  const id = order.id;
  const total = order.totalAmount;
  const prepay = Math.round(total * 0.3);
  const mid = Math.round(total * 0.4);
  const final = total - prepay - mid;
  order.stages = [
    {
      id: `${id}_s1`,
      name: "预付款",
      amount: prepay,
      ratio: 0.3,
      status: "pending",
    },
    {
      id: `${id}_s2`,
      name: "中期成果",
      amount: mid,
      ratio: 0.4,
      status: "pending",
    },
    {
      id: `${id}_s3`,
      name: "尾款验收",
      amount: final,
      ratio: 0.3,
      status: "pending",
    },
  ];
}
import { AuthError } from "./auth";

const ACCEPTANCE_DAYS = 10;
const SETTLEMENT_DAYS = 30;
const REVIEW_MONTHS = 3;

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

function addMonths(from: string, months: number): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function isContractFullySigned(order: Order): boolean {
  return (
    order.clientSignedContract === true && order.designerSignedContract === true
  );
}

function ensureContractReady(order: Order) {
  if (!isContractFullySigned(order)) {
    throw new AuthError(409, "请先完成双方电子签约");
  }
}

function markContractReady(order: Order) {
  if (!order.contractId) {
    order.contractId = `CT-${Date.now().toString(36).toUpperCase()}`;
  }
  if (isContractFullySigned(order) && !order.contractSignedAt) {
    order.contractSignedAt = nowIso();
    order.messages.push({
      id: randomId("msg"),
      authorId: "system",
      authorRole: "system",
      content: "双方已完成电子签约，请委托人支付预付款启动项目。",
      createdAt: nowIso(),
    });
  }
}

function unlockStageCadDeliverables(stage: Order["stages"][number]) {
  if (!stage.deliverables?.length) return;
  for (const file of stage.deliverables) {
    if (file.locked) file.locked = false;
  }
}

function defaultStageDeliverables(
  order: Order,
  stage: Order["stages"][number],
  designerId: string,
  at: string,
): DeliverableFile[] {
  const base = `${order.code}_${stage.name}`;
  return [
    {
      id: randomId("file"),
      name: `${base}_预览.pdf`,
      size: "2.4 MB",
      type: "application/pdf",
      uploadedAt: at,
      locked: false,
      designerId,
    },
    {
      id: randomId("file"),
      name: `${base}_施工图.dwg`,
      size: "18.6 MB",
      type: "application/acad",
      uploadedAt: at,
      locked: true,
      designerId,
    },
  ];
}

function allStagesReleased(order: Order): boolean {
  return order.stages.every((s) => s.status === "released");
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

  return order;
}

/** 管理员/平台为常规委托委派设计师：matching → pending_contract */
export async function assignDesignerToOrder(
  orderId: string,
  designerId: string,
  totalAmount?: number,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.status !== "matching") {
    throw new AuthError(409, "订单当前状态不可委派设计师");
  }
  order.designerId = designerId;
  order.status = "pending_contract";
  if (totalAmount != null && totalAmount > 0) {
    order.totalAmount = totalAmount;
    rebuildDefaultStages(order);
  }
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "平台已匹配设计师并确认费用，请双方签署电子合同。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
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
  markContractReady(order);
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "委托人已签署电子合同。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
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
  markContractReady(order);
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "设计师已签署电子合同。",
    createdAt: nowIso(),
  });
  await saveOrder(order);
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
  if (order.designerId !== designerId) throw new AuthError(403, "无权操作该订单");
  if (!["in_progress", "in_revision"].includes(order.status)) {
    throw new AuthError(409, "当前订单状态不可上传成果");
  }

  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (stage.status !== "pending") {
    throw new AuthError(409, "该阶段已付款，不可重复上传");
  }

  const at = nowIso();
  stage.deliverables =
    files?.length ?
      files.map((f) => ({ ...f, designerId: f.designerId ?? designerId }))
    : defaultStageDeliverables(order, stage, designerId, at);

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
  return order;
}

/** 委托人提交返修需求 */
export async function requestStageRevision(
  orderId: string,
  stageId: string,
  clientId: string,
  description: string,
): Promise<Order> {
  const order = await getOrder(orderId);
  if (!order) throw new AuthError(404, "订单不存在");
  if (order.clientId !== clientId) throw new AuthError(403, "无权操作该订单");

  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) throw new AuthError(404, "付款阶段不存在");
  if (stage.status !== "frozen" || !(stage.deliverables?.length ?? 0)) {
    throw new AuthError(409, "该阶段暂不可申请返修");
  }

  const at = nowIso();
  order.revisions.push({
    id: randomId("rev"),
    stageId,
    description: description.trim() || "请按沟通记录优化本阶段成果。",
    attachments: [],
    createdAt: at,
    status: "pending",
  });
  order.status = "in_revision";
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: `委托人已提交「${stage.name}」返修需求，设计师将优先处理。`,
    createdAt: at,
  });
  await saveOrder(order);
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
): Promise<void> {
  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage || stage.status !== "frozen") return;

  stage.status = "released";
  stage.releasedAt = at;

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
        "全部阶段成果已验收。设计师可申请结算，委托人请确认「最终服务完成」后进入评价。",
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
  return order;
}

/** 委托人确认最终服务完成：进入已完成，开启评价期 */
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
  order.reviewDeadlineAt = addMonths(at, REVIEW_MONTHS);
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: "委托人已确认最终服务完成，项目结案。欢迎对设计师进行评价（3 个月内有效）。",
    createdAt: at,
  });
  await saveOrder(order);
  await maybeRequestPromotion(order);
  return order;
}

export interface SubmitOrderReviewInput {
  overall: number;
  breakdown: RatingBreakdown;
  content: string;
  impressionTags?: string[];
  clientDisplayName?: string;
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
  if (order.status !== "completed") {
    throw new AuthError(409, "项目尚未结案，暂不可评价");
  }
  if (order.clientReviewed) {
    throw new AuthError(409, "已完成评价");
  }
  if (
    order.reviewDeadlineAt &&
    new Date(order.reviewDeadlineAt).getTime() < Date.now()
  ) {
    throw new AuthError(409, "评价期已结束");
  }

  const at = nowIso();
  const review: DesignerProjectReview = {
    id: randomId("drev"),
    designerId: order.designerId,
    orderCode: order.code,
    projectTitle: order.title,
    projectType: order.projectType,
    clientDisplayName: input.clientDisplayName ?? "委托人",
    completedAt: order.settlementConfirmedAt ?? at,
    overall: input.overall,
    breakdown: input.breakdown,
    content: input.content.trim(),
    impressionTags: input.impressionTags,
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
  order.reviewDeadlineAt = addMonths(at, REVIEW_MONTHS);
  order.messages.push({
    id: randomId("msg"),
    authorId: "system",
    authorRole: "system",
    content: systemMessage,
    createdAt: at,
  });
  await saveOrder(order);
  await maybeRequestPromotion(order);
}

/**
 * 处理单订单超时：10 天成果自动验收、30 天自动结案、评价期结束标记。
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
    order.status === "completed" &&
    !order.clientReviewed &&
    !order.reviewExpired &&
    isPastDeadline(order.reviewDeadlineAt)
  ) {
    order.reviewExpired = true;
    order.messages.push({
      id: randomId("msg"),
      authorId: "system",
      authorRole: "system",
      content: `评价期（${REVIEW_MONTHS} 个月）已结束，本项目不再接受评价。`,
      createdAt: at,
    });
    await saveOrder(order);
    changed = true;
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
