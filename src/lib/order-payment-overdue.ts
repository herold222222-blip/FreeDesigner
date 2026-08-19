import { isContractFullySigned, isOrderCancelled } from "@/lib/order-lifecycle";
import { isPrepaymentStage } from "@/lib/order-payment-stages";
import { isAwaitingClientPaymentOrder } from "@/lib/order-supervision";
import { monthlyPaymentDueAtIso, monthlyFirstPrepayDueDate, resolveMonthlyServicePeriod } from "@/lib/monthly-billing";
import { getDailySettlementDueAt } from "@/lib/time-billing";
import type { Order, PaymentStage } from "@/lib/types";

/** 合同：预付款，双方签署后 2 个工作日内 */
const PREPAY_WORKING_DAYS = 2;

/** 合同：成果确认后 5 个工作日内 */
const CONFIRM_WORKING_DAYS = 5;

/** 合同：工时尾款，服务期结束或确认后 3 日内 */
const DAILY_TAIL_CALENDAR_DAYS = 3;

const PAYMENT_CUTOFF_HOUR = 17;

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
  overdueLabel: string;
  ruleLabel: string;
}

export interface StagePaymentDeadline {
  stage: PaymentStage;
  stageIndex: number;
  dueAt: string;
  ruleLabel: string;
  overdue: boolean;
  overdueDays: number;
  overdueLabel: string;
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function withCutoff(date: Date): string {
  const d = new Date(date);
  d.setHours(PAYMENT_CUTOFF_HOUR, 0, 0, 0);
  return d.toISOString();
}

/** 起始当日不计入，顺延 N 个工作日，截止当日 17:00 */
export function addWorkingDays(iso: string, workingDays: number): string {
  const d = new Date(iso);
  let left = workingDays;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) left -= 1;
  }
  return withCutoff(d);
}

export function addCalendarDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return withCutoff(d);
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

export function formatOverdueDuration(dueAt: string, now = new Date()): string {
  const ms = now.getTime() - new Date(dueAt).getTime();
  if (ms <= 0) return "";
  const totalMinutes = Math.max(1, Math.floor(ms / 60000));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days >= 1) {
    return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
  }
  if (totalHours >= 1) return `${totalHours} 小时`;
  return `${totalMinutes} 分钟`;
}

function laterIso(a: string | null | undefined, b: string | null | undefined) {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function isPriorStageSettled(stage: PaymentStage) {
  return stage.status === "released" || stage.status === "frozen";
}

/** 当前应付但未付的阶段（委托人应付款项） */
export function getPayablePendingStage(order: Order): {
  stage: PaymentStage;
  index: number;
} | null {
  if (isOrderCancelled(order) || order.status === "terminated") return null;

  for (let i = 0; i < order.stages.length; i++) {
    const stage = order.stages[i];
    if (stage.status !== "pending") continue;

    const priorOk = order.stages.slice(0, i).every(isPriorStageSettled);
    if (!priorOk) continue;

    const isPrepay = i === 0;
    const contractActive = !CONTRACT_PENDING_STATUSES.has(order.status);
    const hasDeliverables = (stage.deliverables?.length ?? 0) > 0;
    const confirmed = Boolean(stage.deliverablesConfirmedAt);
    const prevReleased =
      i > 0 && order.stages[i - 1].status === "released";

    if (
      stage.dueAt ||
      hasDeliverables ||
      confirmed ||
      prevReleased ||
      (isPrepay && contractActive)
    ) {
      return { stage, index: i };
    }
  }
  return null;
}

function isSettledOrHeld(stage: PaymentStage) {
  return (
    stage.status === "released" ||
    stage.status === "frozen" ||
    stage.status === "paid"
  );
}

/** 当前应关注的付款阶段（高亮 / 主操作） */
export function getActivePaymentStageId(
  order: Pick<
    Order,
    | "status"
    | "stages"
    | "revisions"
    | "clientSignedContract"
    | "designerSignedContract"
    | "billingMode"
  >,
  stages: PaymentStage[] = order.stages,
): string | null {
  if (
    isOrderCancelled(order) ||
    order.status === "completed" ||
    order.status === "terminated" ||
    !isContractFullySigned(order)
  ) {
    return null;
  }

  if (order.status === "in_revision") {
    const pendingRev = (order.revisions ?? []).find((r) => r.status === "pending");
    if (pendingRev) {
      const hit = stages.find((s) => s.id === pendingRev.stageId);
      if (hit) return hit.id;
    }
    const frozen = stages.find(
      (s) => s.status === "frozen" && !isPrepaymentStage(order, s),
    );
    if (frozen) return frozen.id;
  }

  const isTimeBilled =
    order.billingMode === "daily" || order.billingMode === "monthly";

  if (!isTimeBilled) {
    const awaitingConfirm = stages.find(
      (s) =>
        s.status === "frozen" &&
        (s.deliverables?.length ?? 0) > 0 &&
        !isPrepaymentStage(order, s),
    );
    if (awaitingConfirm) return awaitingConfirm.id;

    const held = stages.find(
      (s) =>
        (s.status === "frozen" || s.status === "paid") &&
        !isPrepaymentStage(order, s),
    );
    if (held) return held.id;
  }

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (stage.status !== "pending") continue;
    const priorOk = stages.slice(0, i).every(isSettledOrHeld);
    if (!priorOk) continue;
    return stage.id;
  }

  const allHeld = stages.length > 0 && stages.every(isSettledOrHeld);
  const reviewStages = stages.filter((s) => !isPrepaymentStage(order, s));
  const lastReview = reviewStages.at(-1);
  if (allHeld && (!lastReview || lastReview.deliverablesConfirmedAt)) {
    return null;
  }

  const lastOpenReview = [...reviewStages]
    .reverse()
    .find((s) => s.status !== "released");
  if (lastOpenReview) return lastOpenReview.id;

  return stages.find((s) => s.status !== "released")?.id ?? null;
}

function resolveContractDue(
  order: Order,
  stage: PaymentStage,
  index: number,
): { dueAt: string; ruleLabel: string } | null {
  const isMonthly = order.billingMode === "monthly";
  const isDaily = order.billingMode === "daily";
  const isPrepay = index === 0 || isPrepaymentStage(order, stage);

  if (isMonthly && index > 0 && stage.dueAt) {
    return {
      dueAt: monthlyPaymentDueAtIso(stage.dueAt, PAYMENT_CUTOFF_HOUR),
      ruleLabel:
        "合同约定：每月 25 日 17:00 前支付下一月服务费；遇周末或法定节假日提前至前一个工作日",
    };
  }

  if (isPrepay) {
    if (
      CONTRACT_PENDING_STATUSES.has(order.status) ||
      !isContractFullySigned(order)
    ) {
      return null;
    }
    if (isMonthly) {
      const period = resolveMonthlyServicePeriod(order);
      if (period?.from) {
        return {
          dueAt: monthlyPaymentDueAtIso(
            monthlyFirstPrepayDueDate(period.from),
            PAYMENT_CUTOFF_HOUR,
          ),
          ruleLabel:
            "合同约定：首月预付款须在开始服务日前 3 天 17:00 前支付；遇周末或法定节假日提前至前一个工作日",
        };
      }
    }
    const signedAt = order.contractSignedAt || order.createdAt;
    return {
      dueAt: addWorkingDays(signedAt, PREPAY_WORKING_DAYS),
      ruleLabel: "合同约定：双方签署后 2 个工作日内支付",
    };
  }

  if (isDaily) {
    const fromService = getDailySettlementDueAt(order);
    const fromConfirm = stage.deliverablesConfirmedAt
      ? addCalendarDays(stage.deliverablesConfirmedAt, DAILY_TAIL_CALENDAR_DAYS)
      : null;
    const dueAt = laterIso(fromService, fromConfirm);
    if (!dueAt) return null;
    return {
      dueAt,
      ruleLabel: "合同约定：服务期结束或成果确认后 3 日内付清尾款",
    };
  }

  const confirmedAt = stage.deliverablesConfirmedAt;
  if (confirmedAt) {
    return {
      dueAt: addWorkingDays(confirmedAt, CONFIRM_WORKING_DAYS),
      ruleLabel: "合同约定：成果确认后 5 个工作日内支付",
    };
  }

  const prev = order.stages[index - 1];
  if (prev?.status === "released" && prev.releasedAt) {
    return {
      dueAt: addWorkingDays(prev.releasedAt, CONFIRM_WORKING_DAYS),
      ruleLabel: "合同约定：上一阶段验收后 5 个工作日内支付",
    };
  }

  if (stage.dueAt) {
    return {
      dueAt: stage.dueAt,
      ruleLabel: "合同约定支付时限",
    };
  }

  return null;
}

function toDeadline(
  order: Order,
  stage: PaymentStage,
  index: number,
  now = new Date(),
): StagePaymentDeadline | null {
  const resolved = resolveContractDue(order, stage, index);
  if (!resolved) return null;
  const overdueMs = now.getTime() - new Date(resolved.dueAt).getTime();
  const overdue = overdueMs > 0;
  const overdueDays = overdue ? Math.max(1, diffOverdueDays(resolved.dueAt, now)) : 0;
  return {
    stage,
    stageIndex: index,
    dueAt: resolved.dueAt,
    ruleLabel: resolved.ruleLabel,
    overdue,
    overdueDays: overdue ? overdueDays : 0,
    overdueLabel: overdue ? formatOverdueDuration(resolved.dueAt, now) : "",
  };
}

/** 指定阶段的合同支付时限（仅当前待支付阶段） */
export function getStagePaymentDeadline(
  order: Order,
  stage: PaymentStage,
  now = new Date(),
): StagePaymentDeadline | null {
  if (stage.status !== "pending") return null;
  if (!isAwaitingClientPaymentOrder(order)) return null;
  const payable = getPayablePendingStage(order);
  if (!payable || payable.stage.id !== stage.id) return null;
  return toDeadline(order, payable.stage, payable.index, now);
}

/** 当前待支付阶段的合同支付时限 */
export function getPayableStageDeadline(
  order: Order,
  now = new Date(),
): StagePaymentDeadline | null {
  if (!isAwaitingClientPaymentOrder(order)) return null;
  const payable = getPayablePendingStage(order);
  if (!payable) return null;
  return toDeadline(order, payable.stage, payable.index, now);
}

export function getOrderPaymentOverdueInfo(
  order: Order,
  now = new Date(),
): OrderPaymentOverdueInfo | null {
  const deadline = getPayableStageDeadline(order, now);
  if (!deadline?.overdue) return null;
  return {
    stage: deadline.stage,
    stageIndex: deadline.stageIndex,
    dueAt: deadline.dueAt,
    overdueDays: deadline.overdueDays,
    overdueLabel: deadline.overdueLabel,
    ruleLabel: deadline.ruleLabel,
  };
}

export function isOrderPaymentOverdue(order: Order, now = new Date()) {
  return getOrderPaymentOverdueInfo(order, now) !== null;
}

export function countPaymentOverdueOrders(orders: Order[], now = new Date()) {
  return orders.filter((o) => isOrderPaymentOverdue(o, now)).length;
}
