import type { Order, OrderQuoteLine, PaymentStage } from "@/lib/types";
import { adjustToPreviousCnWorkday, eachDateInclusive, isCnWorkday, shiftIsoDate } from "@/lib/cn-workdays";
import {
  formatMonthKey,
  formatMonthLabel,
  parseMonthKey,
} from "@/lib/designer-schedule";
import {
  formatMonthlyBillingRule,
  normalizeCommerceSettings,
  type PlatformCommerceSettings,
} from "@/lib/platform-commerce";
import { formatDate } from "@/lib/utils";

/** 按月雇佣：每月几号前支付下月服务费 */
export const MONTHLY_PREPAY_DAY = 25;
/** 首月预付款：开始服务日前几天支付 */
export const MONTHLY_FIRST_PREPAY_LEAD_DAYS = 3;

export const MONTHLY_BILLING_RULE = formatMonthlyBillingRule();

export function formatMonthlyDueHint(
  stage: PaymentStage,
  commerce?: Partial<PlatformCommerceSettings> | null,
): string | null {
  if (!stage.dueAt) return null;
  const s = normalizeCommerceSettings(commerce);
  if (stage.name.includes("首月")) {
    return `请于 ${formatDate(stage.dueAt)} 前支付（开始服务日前 ${s.monthlyFirstPrepayLeadDays} 天预付首月）`;
  }
  return `请于 ${formatDate(stage.dueAt)} 前支付（每月 ${s.monthlyPrepayDay} 日前预付下月费用）`;
}

export function isMonthlyPrepayStage(stage: PaymentStage, index: number) {
  return index === 0 && stage.name.includes("首月");
}

function monthlyNominalPrepayDate(
  monthKey: string,
  commerce?: Partial<PlatformCommerceSettings> | null,
): string {
  const day = normalizeCommerceSettings(commerce).monthlyPrepayDay;
  const [y, m] = monthKey.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 首月预付截止日：开始服务日前 N 天，遇休息日再提前至前一工作日 */
export function monthlyFirstPrepayDueDate(
  serviceStart: string,
  commerce?: Partial<PlatformCommerceSettings> | null,
): string {
  const start = serviceStart.slice(0, 10);
  const lead = normalizeCommerceSettings(commerce).monthlyFirstPrepayLeadDays;
  const nominal = shiftIsoDate(start, -lead);
  return adjustToPreviousCnWorkday(nominal);
}

export function monthlyFirstPrepayNominalDate(
  serviceStart: string,
  commerce?: Partial<PlatformCommerceSettings> | null,
): string {
  const lead = normalizeCommerceSettings(commerce).monthlyFirstPrepayLeadDays;
  return shiftIsoDate(serviceStart.slice(0, 10), -lead);
}

/** 某雇佣月份对应的预付截止日（上月指定日；遇休息日提前至前一工作日） */
export function monthlyPrepayDueAt(
  monthKey: string,
  commerce?: Partial<PlatformCommerceSettings> | null,
): string {
  const date = adjustToPreviousCnWorkday(monthlyNominalPrepayDate(monthKey, commerce));
  return `${date}T00:00:00+08:00`;
}

export function monthlyFirstPrepayDueAt(
  serviceStart: string,
  commerce?: Partial<PlatformCommerceSettings> | null,
): string {
  return `${monthlyFirstPrepayDueDate(serviceStart, commerce)}T00:00:00+08:00`;
}

function allocateMonthlyAmounts(totalAmount: number, n: number): number[] {
  const base = Math.floor(totalAmount / n);
  const remainder = totalAmount - base * n;
  return Array.from({ length: n }, (_, i) => base + (i === n - 1 ? remainder : 0));
}

/** 按月雇佣：首月提前 3 天预付一个月，此后每月 25 日预付下月，直至服务结束 */
export function buildMonthlyStages(
  orderId: string,
  totalAmount: number,
  selectedMonths: string[],
  serviceStart?: string,
  commerce?: Partial<PlatformCommerceSettings> | null,
): PaymentStage[] {
  const n = selectedMonths.length;
  if (n === 0) return [];

  const amounts = allocateMonthlyAmounts(totalAmount, n);
  const start = serviceStart?.slice(0, 10) || `${selectedMonths[0]}-01`;

  return selectedMonths.map((monthKey, i) => {
    const isFirst = i === 0;
    return {
      id: `${orderId}_s${i + 1}`,
      name: isFirst
        ? `首月预付（${formatMonthLabel(monthKey)}）`
        : `${formatMonthLabel(monthKey)}服务费`,
      amount: amounts[i]!,
      ratio: 1 / n,
      status: "pending" as const,
      dueAt: isFirst
        ? monthlyFirstPrepayDueAt(start, commerce)
        : monthlyPrepayDueAt(monthKey, commerce),
    };
  });
}

export type MonthlyStageOrderInput = Pick<
  Order,
  | "id"
  | "totalAmount"
  | "billingMode"
  | "selectedMonths"
  | "expectedDeliveryAt"
  | "onsiteSchedule"
  | "quote"
  | "levelQuotes"
>;

function quoteLinesFromOrder(order: Pick<Order, "quote" | "levelQuotes">): OrderQuoteLine[] {
  if (order.quote?.lines?.length) return order.quote.lines;
  return order.levelQuotes?.find((q) => q.lines?.length)?.lines ?? [];
}

function parseYmd(value?: string | null): { y: number; m: number; d: number } | null {
  if (!value?.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function shiftMonthKey(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const date = new Date(year, month - 1 + delta, 1);
  return formatMonthKey(date.getFullYear(), date.getMonth() + 1);
}

function consecutiveMonthKeys(startKey: string, count: number): string[] {
  if (count < 1) return [];
  return Array.from({ length: count }, (_, i) => shiftMonthKey(startKey, i));
}

/** 雇佣月份 YYYY-MM 对应的预付截止日（上月 25 日，遇休息日提前） */
export function monthlyPrepayDate(monthKey: string): string {
  return monthlyPrepayDueAt(monthKey).slice(0, 10);
}

/** 任意按月支付截止日：休息日提前到前一个工作日 */
export function resolveMonthlyPaymentDueDate(value: string): string {
  return adjustToPreviousCnWorkday(value.slice(0, 10));
}

export function monthlyPaymentDueAtIso(value: string, hour = 17): string {
  const date = resolveMonthlyPaymentDueDate(value);
  return `${date}T${String(hour).padStart(2, "0")}:00:00+08:00`;
}

export function getMonthlyHireMonthCount(
  order: Pick<Order, "selectedMonths" | "quote" | "levelQuotes">,
): number {
  if (order.selectedMonths?.length) return order.selectedMonths.length;
  const quantities = quoteLinesFromOrder(order)
    .filter((line) => line.unit === "month" && line.quantity > 0)
    .map((line) => line.quantity);
  if (quantities.length) return Math.max(...quantities);
  return 0;
}

export interface MonthlyServicePeriod {
  from: string;
  to: string;
  months: string[];
}

/** 委托人预期服务期：已选雇佣月份，或开始服务日 + 报价月数 */
export function resolveMonthlyServicePeriod(
  order: Pick<
    Order,
    | "billingMode"
    | "selectedMonths"
    | "expectedDeliveryAt"
    | "onsiteSchedule"
    | "quote"
    | "levelQuotes"
  >,
): MonthlyServicePeriod | null {
  if (order.billingMode !== "monthly") return null;

  const selected = [...(order.selectedMonths ?? [])].filter(Boolean).sort();
  if (selected.length > 0) {
    const first = parseMonthKey(selected[0]!);
    const last = parseMonthKey(selected[selected.length - 1]!);
    const start =
      parseYmd(order.expectedDeliveryAt) ?? parseYmd(order.onsiteSchedule?.from);
    const from =
      start && selected.includes(formatMonthKey(start.y, start.m))
        ? ymd(start.y, start.m, start.d)
        : ymd(first.year, first.month, 1);
    const endHint = parseYmd(order.onsiteSchedule?.to);
    const lastKey = selected[selected.length - 1]!;
    const to =
      endHint && formatMonthKey(endHint.y, endHint.m) === lastKey
        ? ymd(endHint.y, endHint.m, endHint.d)
        : ymd(last.year, last.month, lastDayOfMonth(last.year, last.month));
    return {
      from,
      to,
      months: selected,
    };
  }

  const count = getMonthlyHireMonthCount(order);
  const start =
    parseYmd(order.expectedDeliveryAt) ??
    parseYmd(order.onsiteSchedule?.from);
  const endHint = parseYmd(order.onsiteSchedule?.to);

  if (start && count > 0) {
    const months = consecutiveMonthKeys(formatMonthKey(start.y, start.m), count);
    const last = parseMonthKey(months[months.length - 1]!);
    return {
      from: ymd(start.y, start.m, start.d),
      to: ymd(last.year, last.month, lastDayOfMonth(last.year, last.month)),
      months,
    };
  }

  if (start && endHint && ymd(endHint.y, endHint.m, endHint.d) >= ymd(start.y, start.m, start.d)) {
    const from = ymd(start.y, start.m, start.d);
    const to = ymd(endHint.y, endHint.m, endHint.d);
    const months: string[] = [];
    let key = formatMonthKey(start.y, start.m);
    const endKey = formatMonthKey(endHint.y, endHint.m);
    while (key <= endKey) {
      months.push(key);
      key = shiftMonthKey(key, 1);
    }
    return { from, to, months };
  }

  if (start && count === 0) {
    const key = formatMonthKey(start.y, start.m);
    return {
      from: ymd(start.y, start.m, start.d),
      to: ymd(start.y, start.m, lastDayOfMonth(start.y, start.m)),
      months: [key],
    };
  }

  return null;
}

function buildUnlabeledMonthlyStages(
  orderId: string,
  totalAmount: number,
  monthCount: number,
): PaymentStage[] {
  const n = Math.max(1, Math.round(monthCount) || 1);
  const amounts = allocateMonthlyAmounts(totalAmount, n);
  return amounts.map((amount, i) => ({
    id: `${orderId}_s${i + 1}`,
    name: i === 0 ? "首月预付" : `第${i + 1}个月服务费`,
    amount,
    ratio: 1 / n,
    status: "pending" as const,
  }));
}

/** 按订单服务期或报价月数生成按月预付阶段 */
export function buildMonthlyStagesForOrder(
  order: MonthlyStageOrderInput,
  commerce?: Partial<PlatformCommerceSettings> | null,
): PaymentStage[] {
  const period = resolveMonthlyServicePeriod(order);
  if (period?.months.length) {
    return buildMonthlyStages(
      order.id,
      order.totalAmount,
      period.months,
      period.from,
      commerce,
    );
  }
  return buildUnlabeledMonthlyStages(
    order.id,
    order.totalAmount,
    getMonthlyHireMonthCount(order),
  );
}

export function isDateInMonthlyHireSpan(
  date: string,
  period: MonthlyServicePeriod,
): boolean {
  if (date < period.from || date > period.to) return false;
  return period.months.some((month) => date.startsWith(month));
}

/** 预期服务日：雇佣期内的工作日（不含周末与法定节假日） */
export function isDateInMonthlyServicePeriod(
  date: string,
  period: MonthlyServicePeriod,
): boolean {
  return isDateInMonthlyHireSpan(date, period) && isCnWorkday(date);
}

export function countMonthlyServiceWorkdays(period: MonthlyServicePeriod): number {
  return eachDateInclusive(period.from, period.to).filter((date) =>
    isDateInMonthlyServicePeriod(date, period),
  ).length;
}

export interface MonthlyPaymentMark {
  date: string;
  /** 名义 25 日；与 date 不同时表示已提前到工作日 */
  nominalDate?: string;
  label: string;
  kind: "prepay" | "monthly";
  stageId?: string;
  paid: boolean;
  forMonth?: string;
}

function stagePaid(stage: PaymentStage | undefined): boolean {
  return Boolean(stage && stage.status !== "pending");
}

/** 日历上的支付节点：首月预付（开始日前 N 天）+ 此后每月指定日 */
export function resolveMonthlyPaymentMarks(
  order: Pick<
    Order,
    | "billingMode"
    | "selectedMonths"
    | "expectedDeliveryAt"
    | "onsiteSchedule"
    | "quote"
    | "levelQuotes"
    | "stages"
  >,
  commerce?: Partial<PlatformCommerceSettings> | null,
): MonthlyPaymentMark[] {
  if (order.billingMode !== "monthly") return [];

  const period = resolveMonthlyServicePeriod(order);
  const months = period?.months ?? [];
  const marks: MonthlyPaymentMark[] = [];
  const seen = new Set<string>();

  const pushMark = (mark: MonthlyPaymentMark) => {
    const key = `${mark.date}:${mark.kind}:${mark.forMonth ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    marks.push(mark);
  };

  if (months.length > 0) {
    const firstMonth = months[0]!;
    const serviceStart = period?.from ?? `${firstMonth}-01`;
    const prepayNominal = monthlyFirstPrepayNominalDate(serviceStart, commerce);
    const prepayDate = monthlyFirstPrepayDueDate(serviceStart, commerce);
    const prepayStage = order.stages[0];
    pushMark({
      date: prepayDate,
      nominalDate: prepayDate !== prepayNominal ? prepayNominal : undefined,
      label: "首月预付",
      kind: "prepay",
      stageId: prepayStage?.id,
      paid: stagePaid(prepayStage),
      forMonth: firstMonth,
    });

    months.slice(1).forEach((monthKey, offset) => {
      const stage = order.stages[offset + 1];
      const nominal = monthlyNominalPrepayDate(monthKey, commerce);
      const raw = stage?.dueAt?.slice(0, 10) || nominal;
      const dueDate = resolveMonthlyPaymentDueDate(raw);
      pushMark({
        date: dueDate,
        nominalDate: dueDate !== nominal ? nominal : undefined,
        label: `支付${formatMonthLabel(monthKey)}`,
        kind: "monthly",
        stageId: stage?.id,
        paid: stagePaid(stage),
        forMonth: monthKey,
      });
    });
  }

  order.stages.forEach((stage, index) => {
    if (!stage.dueAt) return;
    const date = resolveMonthlyPaymentDueDate(stage.dueAt);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const already = marks.some((m) => m.date === date || m.stageId === stage.id);
    if (already) return;
    const nominal = stage.dueAt.slice(0, 10);
    pushMark({
      date,
      nominalDate: date !== nominal ? nominal : undefined,
      label: stage.name,
      kind: index === 0 ? "prepay" : "monthly",
      stageId: stage.id,
      paid: stagePaid(stage),
    });
  });

  return marks.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}
