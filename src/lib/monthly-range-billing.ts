import { eachDateInclusive, isCnWorkday } from "@/lib/cn-workdays";
import { formatMonthKey, formatMonthLabel } from "@/lib/designer-schedule";
import { WORK_DAYS_PER_MONTH, dailyRateFromMonthly } from "@/lib/time-billing";

export interface MonthlyRangeSegment {
  monthKey: string;
  from: string;
  to: string;
  workdays: number;
  monthWorkdays: number;
  isFull: boolean;
  amount: number;
}

export interface MonthlyRangeQuote {
  from: string;
  to: string;
  monthlyRate: number;
  dailyRate: number;
  drawingFee: number;
  segments: MonthlyRangeSegment[];
}

function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

function monthBounds(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    start: `${key}-01`,
    end: `${key}-${String(last).padStart(2, "0")}`,
  };
}

function nextMonthKey(key: string): string {
  const { year, month } = {
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(5, 7)),
  };
  const d = new Date(year, month, 1);
  return formatMonthKey(d.getFullYear(), d.getMonth() + 1);
}

export function countWorkdaysInclusive(from: string, to: string): number {
  return eachDateInclusive(from, to).filter(isCnWorkday).length;
}

export function formatIsoDateLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

/** 起止日期按月拆段：整月按月费率，首尾不足整月按 月费÷21 × 工作日 */
export function buildMonthlyRangeQuote(
  from: string,
  to: string,
  monthlyRate: number,
): MonthlyRangeQuote | null {
  const start = from.slice(0, 10);
  const end = to.slice(0, 10);
  if (!start || !end || start > end || monthlyRate <= 0) return null;

  const dailyRate = dailyRateFromMonthly(monthlyRate);
  const segments: MonthlyRangeSegment[] = [];
  let key = monthKeyOf(start);
  const endKey = monthKeyOf(end);

  while (key <= endKey) {
    const bounds = monthBounds(key);
    const segFrom = key === monthKeyOf(start) ? start : bounds.start;
    const segTo = key === endKey ? end : bounds.end;
    const workdays = countWorkdaysInclusive(segFrom, segTo);
    const monthWorkdays = countWorkdaysInclusive(bounds.start, bounds.end);
    const isFull = monthWorkdays > 0 && workdays >= monthWorkdays;
    segments.push({
      monthKey: key,
      from: segFrom,
      to: segTo,
      workdays,
      monthWorkdays,
      isFull,
      amount: isFull
        ? Math.round(monthlyRate)
        : Math.round(dailyRate * workdays),
    });
    if (key === endKey) break;
    key = nextMonthKey(key);
  }

  return {
    from: start,
    to: end,
    monthlyRate,
    dailyRate,
    drawingFee: segments.reduce((sum, seg) => sum + seg.amount, 0),
    segments,
  };
}

export function formatMonthlyRangeSummary(quote: MonthlyRangeQuote): string {
  const parts = quote.segments.map((seg) =>
    seg.isFull
      ? `${formatMonthLabel(seg.monthKey)}整月`
      : `${formatMonthLabel(seg.monthKey)}折算 ${seg.workdays} 工作日`,
  );
  return `${formatIsoDateLabel(quote.from)} ～ ${formatIsoDateLabel(quote.to)} · ${parts.join(" + ")} · 日费 = 月费 ÷ ${WORK_DAYS_PER_MONTH}`;
}
