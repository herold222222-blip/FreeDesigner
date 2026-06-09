import type { Order, PaymentStage } from "@/lib/types";

/** 阶段付款宽限期（5 个工作日，按 7 个自然日估算） */
const PAYMENT_GRACE_DAYS = 7;

/** 预付款签约后付款期限（2 个工作日，按 3 个自然日估算） */
const PREPAY_GRACE_DAYS = 3;

const CONTRACT_PENDING_STATUSES = new Set([
  "matching",
  "pending_schedule",
  "pending_contract",
]);

export interface OrderPaymentOverdueInfo {
  stage: PaymentStage;
  stageIndex: number;
  dueAt: string;
  overdueDays: number;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function startOfDayMs(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function diffOverdueDays(dueAt: string, now = new Date()): number {
  const diff = startOfDayMs(now.toISOString()) - startOfDayMs(dueAt);
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function isPriorStageSettled(stage: PaymentStage) {
  return stage.status === "released" || stage.status === "frozen";
}

/** 当前应付但未付的阶段（委托人应付款项） */
export function getPayablePendingStage(order: Order): {
  stage: PaymentStage;
  index: number;
} | null {
  for (let i = 0; i < order.stages.length; i++) {
    const stage = order.stages[i];
    if (stage.status !== "pending") continue;

    const priorOk = order.stages.slice(0, i).every(isPriorStageSettled);
    if (!priorOk) continue;

    const isPrepay = i === 0;
    const contractActive = !CONTRACT_PENDING_STATUSES.has(order.status);
    const hasDeliverables = (stage.deliverables?.length ?? 0) > 0;
    const prevReleased =
      i > 0 && order.stages[i - 1].status === "released";

    if (
      stage.dueAt ||
      hasDeliverables ||
      prevReleased ||
      (isPrepay && contractActive)
    ) {
      return { stage, index: i };
    }
  }
  return null;
}

function resolveStageDueAt(
  order: Order,
  stage: PaymentStage,
  index: number,
): string | null {
  if (stage.dueAt) return stage.dueAt;

  if (index === 0) {
    if (CONTRACT_PENDING_STATUSES.has(order.status)) return null;
    return addDays(order.createdAt, PREPAY_GRACE_DAYS);
  }

  const prev = order.stages[index - 1];
  if (prev.status === "released" && prev.releasedAt) {
    return addDays(prev.releasedAt, PAYMENT_GRACE_DAYS);
  }

  const uploads = stage.deliverables?.map((d) => d.uploadedAt) ?? [];
  if (uploads.length > 0) {
    const latest = uploads.sort().at(-1)!;
    return addDays(latest, PAYMENT_GRACE_DAYS);
  }

  return null;
}

export function getOrderPaymentOverdueInfo(
  order: Order,
  now = new Date(),
): OrderPaymentOverdueInfo | null {
  const payable = getPayablePendingStage(order);
  if (!payable) return null;

  const dueAt = resolveStageDueAt(order, payable.stage, payable.index);
  if (!dueAt) return null;

  const overdueDays = diffOverdueDays(dueAt, now);
  if (overdueDays <= 0) return null;

  return {
    stage: payable.stage,
    stageIndex: payable.index,
    dueAt,
    overdueDays,
  };
}

export function isOrderPaymentOverdue(order: Order, now = new Date()) {
  return getOrderPaymentOverdueInfo(order, now) !== null;
}

export function countPaymentOverdueOrders(orders: Order[], now = new Date()) {
  return orders.filter((o) => isOrderPaymentOverdue(o, now)).length;
}
