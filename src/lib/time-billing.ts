import { slotsToDateRange } from "@/lib/designer-schedule";
import {
  formatDailyBillingRule,
  formatMonthlyBillingRuleFull,
  normalizeCommerceSettings,
  type PlatformCommerceSettings,
} from "@/lib/platform-commerce";
import { MONTHLY_PREPAY_DAY, getMonthlyHireMonthCount, monthlyFirstPrepayDueDate, monthlyPaymentDueAtIso, monthlyPrepayDate, resolveMonthlyServicePeriod } from "@/lib/monthly-billing";
import { adjustToPreviousCnWorkday } from "@/lib/cn-workdays";
import type { Order, PaymentStage, WorkCalendarEvent } from "@/lib/types";
import { resolveStagePaymentCondition } from "@/lib/order-payment-stages";
import { getOrderWorkCalendarEvents } from "@/lib/work-calendar-content";
import { formatDate, formatDateTime } from "@/lib/utils";

/** 业务截止时刻：前一天 / 当月 25 号等 */
export const BILLING_CUTOFF_HOUR = 17;
export const WORK_DAYS_PER_MONTH = 21;
export const DAILY_SETTLEMENT_GRACE_DAYS = 3;

export const DAILY_BILLING_RULE = formatDailyBillingRule();

export const MONTHLY_BILLING_RULE_FULL = formatMonthlyBillingRuleFull();

export const DAILY_EXTENSION_RULE =
  "在订单结束日期的前一日 17:00 之前方可申请延长，填写延长半天数（半天为计费单元）；如需再次延长，须在延长服务结束日的前一日 17:00 之前再次申请。延长费用于服务完成后补付。";

export const MONTHLY_EXTENSION_RULE =
  "在服务到期当月 25 日 17:00 之前方可申请延长；若 25 日遇周末或法定节假日，提前至前一个工作日 17:00。填写延长月数（月为计费单元）；如需再次延长，须在延长服务结束当月的同一规则截止前再次申请。延长费用按预付规则支付。";

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

export function getDailySettlementDueAt(
  order: Order,
  commerce?: Partial<PlatformCommerceSettings> | null,
  confirmedAt?: string | null,
): string | null {
  const start =
    confirmedAt ??
    order.stages
      .slice(1)
      .map((s) => s.deliverablesConfirmedAt)
      .find((at) => Boolean(at));
  if (!start) return null;
  const s = normalizeCommerceSettings(commerce);
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + s.dailySettlementGraceDays);
  d.setHours(s.billingCutoffHour, 0, 0, 0);
  return d.toISOString();
}

export function monthlyPrepayDueAtFull(monthKey: string): string {
  return monthlyPaymentDueAtIso(monthlyPrepayDate(monthKey), BILLING_CUTOFF_HOUR);
}

export function getMonthlyUnitFee(order: Order): number {
  const months =
    getMonthlyHireMonthCount(order) ||
    resolveMonthlyServicePeriod(order)?.months.length ||
    order.stages.length;
  if (months > 0) return Math.round(order.totalAmount / months);
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

function paymentItemStatusFromStage(
  stage: PaymentStage | undefined,
): TimeBillingPaymentItem["status"] {
  if (!stage) return "pending";
  if (stage.status === "released") return "settled";
  return stage.status;
}

export function buildDailyPaymentItems(
  order: Order,
  commerce?: Partial<PlatformCommerceSettings> | null,
): TimeBillingPaymentItem[] {
  const prepay = order.stages[0];
  const tailStages = order.stages.slice(1);
  const remaining = tailStages.reduce((sum, s) => sum + s.amount, 0);
  const tailPending = tailStages.find((s) => s.status === "pending");
  const tailFocus =
    tailPending ??
    tailStages.find((s) => s.status === "frozen" || s.status === "paid") ??
    tailStages.at(-1);
  const confirmedAt = tailFocus?.deliverablesConfirmedAt;
  const settlementDue = getDailySettlementDueAt(order, commerce, confirmedAt);
  const tailAllReleased =
    tailStages.length > 0 &&
    tailStages.every((s) => s.status === "released");

  let tailStatus: TimeBillingPaymentItem["status"];
  if (tailAllReleased || order.status === "completed") {
    tailStatus = "settled";
  } else if (tailPending) {
    tailStatus =
      settlementDue && new Date() > new Date(settlementDue) ? "due" : "pending";
  } else {
    tailStatus = paymentItemStatusFromStage(tailFocus);
  }

  return [
    {
      id: "prepay",
      label: "预付款",
      amount: prepay?.amount ?? Math.round(order.totalAmount * 0.3),
      status: paymentItemStatusFromStage(prepay),
      stageId: prepay?.id,
      hint: resolveStagePaymentCondition(
        order,
        prepay ?? { id: "", name: "预付款" },
        0,
        commerce,
      ),
    },
    {
      id: "final",
      label: "合同尾款",
      amount: remaining || order.totalAmount - (prepay?.amount ?? 0),
      status: tailStatus,
      dueAt: settlementDue ?? undefined,
      stageId: tailFocus?.id,
      hint: resolveStagePaymentCondition(
        order,
        tailFocus ?? { id: "", name: "合同尾款" },
        Math.max(1, order.stages.findIndex((s) => s.id === tailFocus?.id)),
        commerce,
      ),
    },
  ];
}

export function buildMonthlyPaymentItems(
  order: Order,
  commerce?: Partial<PlatformCommerceSettings> | null,
): TimeBillingPaymentItem[] {
  const period = resolveMonthlyServicePeriod(order);
  return order.stages.map((stage, i) => {
    const isFirst = i === 0;
    const firstPrepayDue =
      isFirst && period?.from
        ? monthlyPaymentDueAtIso(
            monthlyFirstPrepayDueDate(period.from),
            BILLING_CUTOFF_HOUR,
          )
        : undefined;
    const monthKey = period?.months[i] ?? order.selectedMonths?.[i];
    const dueAt = isFirst
      ? firstPrepayDue
      : monthKey
        ? monthlyPrepayDueAtFull(monthKey)
        : stage.dueAt
          ? monthlyPaymentDueAtIso(stage.dueAt, BILLING_CUTOFF_HOUR)
          : undefined;

    return {
      id: stage.id,
      label: stage.name,
      amount: stage.amount,
      status:
        stage.status === "released" ? "settled"
        : stage.status === "pending" ? "pending"
        : stage.status,
      dueAt: dueAt ?? undefined,
      hint: resolveStagePaymentCondition(order, stage, i, commerce),
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

/** 按月：服务结束所在月 25 日 17:00；遇休息日提前至前一工作日 */
export function getMonthlyExtensionDeadline(serviceEnd: string): Date {
  const end = parseDateShanghai(serviceEnd);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const day = String(MONTHLY_PREPAY_DAY).padStart(2, "0");
  const adjusted = adjustToPreviousCnWorkday(`${y}-${m}-${day}`);
  return cutoffOnDate(adjusted);
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
