import { slotsToDateRange } from "@/lib/designer-schedule";
import { MONTHLY_PREPAY_DAY } from "@/lib/monthly-billing";
import type { Order, PaymentStage, WorkCalendarEvent } from "@/lib/types";
import { getOrderWorkCalendarEvents } from "@/lib/work-calendar-content";
import { formatDate, formatDateTime } from "@/lib/utils";

/** 业务截止时刻：前一天 / 当月 25 号等 */
export const BILLING_CUTOFF_HOUR = 17;
export const WORK_DAYS_PER_MONTH = 21;
export const DAILY_SETTLEMENT_GRACE_DAYS = 3;

export const DAILY_BILLING_RULE =
  "签约预付后，原合同服务期结束之日起 3 日内付清尾款。延长服务须在结束日前一日 17:00 前申请（半天为计费单元），服务完成后补付延长费用。";

export const MONTHLY_BILLING_RULE_FULL =
  "首月签约预付，此后每月 25 日 17:00 前支付下一个月服务费。委托人可在当天 17:00 前终止并结算；不足整月按工作日计，日费 = 月费 ÷ 21。";

export const DAILY_EXTENSION_RULE =
  "在订单结束日期的前一日 17:00 之前方可申请延长，填写延长半天数（半天为计费单元）；如需再次延长，须在延长服务结束日的前一日 17:00 之前再次申请。延长费用于服务完成后补付。";

export const MONTHLY_EXTENSION_RULE =
  "在服务到期的当月 25 日 17:00 之前方可申请延长，填写延长月数（月为计费单元）；如需再次延长，须在延长服务结束当月的 25 日 17:00 之前再次申请。延长费用按预付规则支付。";

export const DAILY_TERMINATION_RULE =
  "委托人可在服务日前一日 17:00 前终止服务并发起结算。";

export const MONTHLY_TERMINATION_RULE =
  "委托人可在当天 17:00 之前终止服务并发起结算。";

/** @deprecated 使用 DAILY_TERMINATION_RULE / MONTHLY_TERMINATION_RULE */
export const TERMINATION_RULE = DAILY_TERMINATION_RULE;

export interface ServiceExtensionRecord {
  id: string;
  units: number;
  unitType: "halfDay" | "month";
  amount: number;
  requestedAt: string;
  extendedEndAt: string;
}

export function dailyRateFromMonthly(monthlyFee: number): number {
  return Math.round(monthlyFee / WORK_DAYS_PER_MONTH);
}

export function formatCutoffTime(hour = BILLING_CUTOFF_HOUR): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** 原合同服务结束日 */
export function getContractServiceEnd(order: Order): string | null {
  if (order.onsiteSchedule?.to) return order.onsiteSchedule.to;
  if (order.selectedSlots?.length) {
    return slotsToDateRange(order.selectedSlots)?.to ?? null;
  }
  if (order.selectedMonths?.length) {
    const last = [...order.selectedMonths].sort().at(-1)!;
    const [y, m] = last.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  return order.expectedDeliveryAt || null;
}

export function getDailySettlementDueAt(order: Order): string | null {
  const end = getContractServiceEnd(order);
  if (!end) return null;
  const d = new Date(`${end}T00:00:00+08:00`);
  d.setDate(d.getDate() + DAILY_SETTLEMENT_GRACE_DAYS);
  d.setHours(BILLING_CUTOFF_HOUR, 0, 0, 0);
  return d.toISOString();
}

export function monthlyPrepayDueAtFull(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const day = String(MONTHLY_PREPAY_DAY).padStart(2, "0");
  const month = String(prevMonth).padStart(2, "0");
  return `${prevYear}-${month}-${day}T${String(BILLING_CUTOFF_HOUR).padStart(2, "0")}:00:00+08:00`;
}

export function getMonthlyUnitFee(order: Order): number {
  if (order.selectedMonths?.length) {
    return Math.round(order.totalAmount / order.selectedMonths.length);
  }
  const monthlyStage = order.stages.find((s) => s.name.includes("服务费"));
  if (monthlyStage) return monthlyStage.amount;
  return order.stages[0]?.amount ?? order.totalAmount;
}

export interface TimeBillingPaymentItem {
  id: string;
  label: string;
  amount: number;
  status: PaymentStage["status"] | "due" | "settled";
  dueAt?: string;
  hint?: string;
  stageId?: string;
}

export function buildDailyPaymentItems(order: Order): TimeBillingPaymentItem[] {
  const prepay = order.stages[0];
  const settled = prepay?.status === "released";
  const tailStages = order.stages.slice(1);
  const remaining = tailStages.reduce((sum, s) => sum + s.amount, 0);
  const settlementDue = getDailySettlementDueAt(order);
  const tailPending = tailStages.find((s) => s.status === "pending");
  const tailAllSettled =
    tailStages.length > 0 &&
    tailStages.every((s) => s.status === "released");

  return [
    {
      id: "prepay",
      label: "预付款",
      amount: prepay?.amount ?? Math.round(order.totalAmount * 0.3),
      status: settled ? "settled" : (prepay?.status ?? "pending"),
      stageId: prepay?.id,
      hint: "签约后预付，用于锁定档期并启动服务",
    },
    {
      id: "final",
      label: "合同尾款",
      amount: remaining || order.totalAmount - (prepay?.amount ?? 0),
      status:
        tailAllSettled || order.status === "completed" ? "settled"
        : settlementDue && new Date() > new Date(settlementDue) && tailPending
          ? "due"
        : tailPending ? "pending"
        : "pending",
      dueAt: settlementDue ?? undefined,
      stageId: tailPending?.id,
      hint: settlementDue
        ? `原合同服务期结束后 ${DAILY_SETTLEMENT_GRACE_DAYS} 日内付清（截止 ${formatDateTime(settlementDue)}）`
        : undefined,
    },
  ];
}

export function buildMonthlyPaymentItems(order: Order): TimeBillingPaymentItem[] {
  return order.stages.map((stage, i) => {
    const isFirst = i === 0;
    const dueAt =
      !isFirst && order.selectedMonths?.[i]
        ? monthlyPrepayDueAtFull(order.selectedMonths[i])
        : stage.dueAt;

    let hint: string | undefined;
    if (isFirst) {
      hint = "签约时预付首月服务费";
    } else if (dueAt) {
      hint = `请于 ${formatDateTime(dueAt)} 前支付（提前支付下月费用）`;
    }

    return {
      id: stage.id,
      label: stage.name,
      amount: stage.amount,
      status:
        stage.status === "released" ? "settled"
        : stage.status === "pending" ? "pending"
        : stage.status,
      dueAt: dueAt ?? undefined,
      hint,
      stageId: stage.id,
    };
  });
}

export function getOrderScheduleEvents(
  allEvents: WorkCalendarEvent[],
  order: Order,
): WorkCalendarEvent[] {
  const fromStore = getOrderWorkCalendarEvents(allEvents, order.code);
  if (fromStore.length > 0) return fromStore;

  if (order.selectedSlots?.length) {
    return order.selectedSlots.map((slot, i) => ({
      id: `${order.id}_slot_${i}`,
      date: slot.date,
      period: slot.period,
      title: order.title,
      source: "order" as const,
      orderCode: order.code,
    }));
  }

  return [];
}

export function initialCalendarMonth(events: WorkCalendarEvent[]): {
  year: number;
  month: number;
} {
  if (events.length > 0) {
    const [y, m] = events[0].date.split("-").map(Number);
    return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function isTimeBilledOrder(order: Order): boolean {
  return order.billingMode === "daily" || order.billingMode === "monthly";
}

export function formatPartialMonthSettlementHint(monthlyFee: number): string {
  const daily = dailyRateFromMonthly(monthlyFee);
  return `不足整月按工作日结算，日费 ${daily} 元/天（月费 ÷ ${WORK_DAYS_PER_MONTH}）`;
}

function parseDateShanghai(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`);
}

function cutoffOnDate(dateStr: string, hour = BILLING_CUTOFF_HOUR): Date {
  return new Date(
    `${dateStr}T${String(hour).padStart(2, "0")}:00:00+08:00`,
  );
}

export function getEffectiveServiceEnd(
  order: Order,
  extensions: ServiceExtensionRecord[] = [],
): string | null {
  if (extensions.length > 0) {
    return extensions[extensions.length - 1].extendedEndAt;
  }
  return getContractServiceEnd(order);
}

/** 按天：服务结束日前一日 17:00 */
export function getDailyExtensionDeadline(serviceEnd: string): Date {
  const end = parseDateShanghai(serviceEnd);
  const prev = new Date(end);
  prev.setDate(prev.getDate() - 1);
  const y = prev.getFullYear();
  const m = String(prev.getMonth() + 1).padStart(2, "0");
  const d = String(prev.getDate()).padStart(2, "0");
  return cutoffOnDate(`${y}-${m}-${d}`);
}

/** 按月：服务结束所在月 25 日 17:00 */
export function getMonthlyExtensionDeadline(serviceEnd: string): Date {
  const end = parseDateShanghai(serviceEnd);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const day = String(MONTHLY_PREPAY_DAY).padStart(2, "0");
  return cutoffOnDate(`${y}-${m}-${day}`);
}

export function getServiceExtensionDeadline(
  order: Order,
  extensions: ServiceExtensionRecord[] = [],
): Date | null {
  const end = getEffectiveServiceEnd(order, extensions);
  if (!end) return null;
  return order.billingMode === "monthly"
    ? getMonthlyExtensionDeadline(end)
    : getDailyExtensionDeadline(end);
}

export function canRequestServiceExtension(
  order: Order,
  extensions: ServiceExtensionRecord[] = [],
  now = new Date(),
): boolean {
  const deadline = getServiceExtensionDeadline(order, extensions);
  if (!deadline) return false;
  return now.getTime() < deadline.getTime();
}

export function formatServiceExtensionDeadline(
  order: Order,
  extensions: ServiceExtensionRecord[] = [],
): string | null {
  const deadline = getServiceExtensionDeadline(order, extensions);
  return deadline ? formatDateTime(deadline.toISOString()) : null;
}

export function getDailyHalfDayRate(order: Order): number {
  const slotCount = order.selectedSlots?.length ?? 0;
  if (slotCount > 0) {
    return Math.round(order.totalAmount / slotCount);
  }
  const end = getContractServiceEnd(order);
  const start = order.onsiteSchedule?.from;
  if (start && end) {
    const from = parseDateShanghai(start);
    const to = parseDateShanghai(end);
    const days =
      Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
    return Math.round(order.totalAmount / (days * 2));
  }
  return Math.round(order.totalAmount / 10);
}

export function computeExtensionAmount(
  order: Order,
  units: number,
  unitType: "halfDay" | "month",
): number {
  if (unitType === "month") {
    return getMonthlyUnitFee(order) * units;
  }
  return getDailyHalfDayRate(order) * units;
}

export function computeExtendedEndDaily(
  serviceEnd: string,
  halfDays: number,
): string {
  const end = parseDateShanghai(serviceEnd);
  const extraCalendarDays = Math.ceil(halfDays / 2);
  end.setDate(end.getDate() + extraCalendarDays);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const d = String(end.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computeExtendedEndMonthly(
  serviceEnd: string,
  months: number,
): string {
  const end = parseDateShanghai(serviceEnd);
  end.setMonth(end.getMonth() + months);
  const y = end.getFullYear();
  const m = end.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function canTerminateService(
  order: Order,
  now = new Date(),
): boolean {
  if (order.billingMode === "monthly") {
    const today = now.toISOString().slice(0, 10);
    return now.getTime() < cutoffOnDate(today).getTime();
  }
  const end = getContractServiceEnd(order);
  if (!end) return true;
  return now.getTime() < getDailyExtensionDeadline(end).getTime();
}

export function getTerminationRule(order: Order): string {
  return order.billingMode === "monthly"
    ? MONTHLY_TERMINATION_RULE
    : DAILY_TERMINATION_RULE;
}

export function getExtensionRule(order: Order): string {
  return order.billingMode === "monthly"
    ? MONTHLY_EXTENSION_RULE
    : DAILY_EXTENSION_RULE;
}
