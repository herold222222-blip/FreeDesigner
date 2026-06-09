import type { CalendarSlot, DayPeriod, HalfDaySlot } from "./types";

export const PERIOD_LABELS: Record<DayPeriod, string> = {
  am: "上午",
  pm: "下午",
};

export const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/** 半天在全局时间轴上的序号，用于排序与区间计算 */
export function slotIndex(date: string, period: DayPeriod): number {
  const base = new Date(`${date}T00:00:00`).getTime();
  return base / 86_400_000 + (period === "pm" ? 0.5 : 0);
}

export function slotKey(slot: HalfDaySlot): string {
  return `${slot.date}:${slot.period}`;
}

export function parseSlotKey(key: string): HalfDaySlot {
  const [date, period] = key.split(":");
  return { date, period: period as DayPeriod };
}

export function compareSlots(a: HalfDaySlot, b: HalfDaySlot): number {
  return slotIndex(a.date, a.period) - slotIndex(b.date, b.period);
}

export function sortSlots(slots: HalfDaySlot[]): HalfDaySlot[] {
  return [...slots].sort(compareSlots);
}

export function isPeriodAvailable(
  calendar: CalendarSlot[],
  date: string,
  period: DayPeriod,
): boolean {
  const day = calendar.find((s) => s.date === date);
  if (!day) return false;
  return period === "am" ? day.amAvailable : day.pmAvailable;
}

export function getDaySlotStatus(
  calendar: CalendarSlot[],
  date: string,
): { am: "available" | "busy"; pm: "available" | "busy" } {
  const day = calendar.find((s) => s.date === date);
  if (!day) return { am: "busy", pm: "busy" };
  return {
    am: day.amAvailable ? "available" : "busy",
    pm: day.pmAvailable ? "available" : "busy",
  };
}

/** 枚举两个半天之间的全部半天（含首尾），按时间顺序 */
export function enumerateHalfDayRange(
  from: HalfDaySlot,
  to: HalfDaySlot,
  calendar: CalendarSlot[],
): HalfDaySlot[] | null {
  const start = compareSlots(from, to) <= 0 ? from : to;
  const end = compareSlots(from, to) <= 0 ? to : from;
  const result: HalfDaySlot[] = [];
  let cur = start.date;
  let curPeriod: DayPeriod = start.period;

  while (true) {
    if (!isPeriodAvailable(calendar, cur, curPeriod)) return null;
    result.push({ date: cur, period: curPeriod });
    if (cur === end.date && curPeriod === end.period) break;

    if (curPeriod === "am") {
      curPeriod = "pm";
    } else {
      const next = new Date(`${cur}T00:00:00`);
      next.setDate(next.getDate() + 1);
      cur = next.toISOString().slice(0, 10);
      curPeriod = "am";
    }
  }
  return result;
}

export function countHalfDays(slots: HalfDaySlot[]): number {
  return slots.length;
}

export function halfDaysToWorkDays(slots: HalfDaySlot[]): number {
  return slots.length * 0.5;
}

export function formatHalfDaySlot(slot: HalfDaySlot): string {
  const d = new Date(`${slot.date}T00:00:00`);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日 ${PERIOD_LABELS[slot.period]}`;
}

export function formatSelectedSlotsSummary(slots: HalfDaySlot[]): string {
  const sorted = sortSlots(slots);
  if (sorted.length === 0) return "未选择";
  const days = halfDaysToWorkDays(sorted);
  const parts = sorted.map(formatHalfDaySlot);
  if (parts.length <= 4) return `${parts.join("、")} · 共 ${days} 天`;
  return `${parts.slice(0, 2).join("、")} … 等 ${sorted.length} 个半天 · 共 ${days} 天`;
}

/** 切换单个半天选中状态（支持连续或跳跃多选） */
export function toggleHalfDaySlot(
  slots: HalfDaySlot[],
  slot: HalfDaySlot,
): HalfDaySlot[] {
  const exists = isSlotSelected(slots, slot.date, slot.period);
  if (exists) {
    return slots.filter((s) => !(s.date === slot.date && s.period === slot.period));
  }
  return sortSlots([...slots, slot]);
}

/** 获取某日所有可预约的半天 */
export function getAvailableDaySlots(
  calendar: CalendarSlot[],
  date: string,
): HalfDaySlot[] {
  const result: HalfDaySlot[] = [];
  if (isPeriodAvailable(calendar, date, "am")) result.push({ date, period: "am" });
  if (isPeriodAvailable(calendar, date, "pm")) result.push({ date, period: "pm" });
  return result;
}

/** 某日可预约时段是否已全部选中 */
export function isFullDaySelected(
  slots: HalfDaySlot[],
  calendar: CalendarSlot[],
  date: string,
): boolean {
  const available = getAvailableDaySlots(calendar, date);
  if (available.length === 0) return false;
  return available.every((s) => isSlotSelected(slots, s.date, s.period));
}

/** 切换整日选中：选中该日全部空闲时段，或全部取消 */
export function toggleFullDay(
  slots: HalfDaySlot[],
  calendar: CalendarSlot[],
  date: string,
): HalfDaySlot[] {
  const available = getAvailableDaySlots(calendar, date);
  if (available.length === 0) return slots;

  if (isFullDaySelected(slots, calendar, date)) {
    return slots.filter((s) => s.date !== date);
  }
  const withoutDay = slots.filter((s) => s.date !== date);
  return sortSlots([...withoutDay, ...available]);
}

/** 月份键，如 2026-05 */
export type MonthKey = string;

export function formatMonthKey(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const [y, m] = key.split("-");
  return { year: Number(y), month: Number(m) };
}

export function formatMonthLabel(key: MonthKey): string {
  const { year, month } = parseMonthKey(key);
  return `${year}年${month}月`;
}

/** 某月档期概况（基于半天日历聚合） */
export function getMonthAvailability(
  calendar: CalendarSlot[],
  year: number,
  month: number,
): { availableHalfDays: number; totalHalfDays: number } {
  const prefix = formatMonthKey(year, month);
  const days = calendar.filter((s) => s.date.startsWith(prefix));
  let availableHalfDays = 0;
  let totalHalfDays = 0;
  for (const d of days) {
    if (d.amAvailable) availableHalfDays += 1;
    if (d.pmAvailable) availableHalfDays += 1;
    totalHalfDays += 2;
  }
  return { availableHalfDays, totalHalfDays };
}

export function isMonthSelectable(
  calendar: CalendarSlot[],
  year: number,
  month: number,
): boolean {
  return getMonthAvailability(calendar, year, month).availableHalfDays > 0;
}

export function isMonthSelected(months: MonthKey[], key: MonthKey): boolean {
  return months.includes(key);
}

export function toggleMonth(months: MonthKey[], key: MonthKey): MonthKey[] {
  if (months.includes(key)) return months.filter((m) => m !== key);
  return [...months, key].sort();
}

export function formatSelectedMonthsSummary(months: MonthKey[]): string {
  if (months.length === 0) return "未选择";
  const sorted = [...months].sort();
  const labels = sorted.map(formatMonthLabel);
  if (labels.length <= 4) return `${labels.join("、")} · 共 ${months.length} 个月`;
  return `${labels.slice(0, 2).join("、")} … 共 ${months.length} 个月`;
}

export function slotsToDateRange(slots: HalfDaySlot[]): {
  from: string;
  to: string;
} | null {
  const sorted = sortSlots(slots);
  if (sorted.length === 0) return null;
  return { from: sorted[0].date, to: sorted[sorted.length - 1].date };
}

const MONTH_GRID_ROWS = 6;

/** 获取某月全部日期 ISO 字符串（含首尾空白占位，固定 6 行） */
export function getMonthGrid(year: number, month: number): {
  date: string;
  day: number;
  inMonth: boolean;
}[] {
  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const startPad = (first.getDay() + 6) % 7; // 周一为第一天
  const totalCells = MONTH_GRID_ROWS * 7;
  const cells: { date: string; day: number; inMonth: boolean }[] = [];

  for (let i = 0; i < startPad; i++) {
    cells.push({ date: "", day: 0, inMonth: false });
  }
  for (let d = 1; d <= lastDay; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: iso, day: d, inMonth: true });
  }
  while (cells.length < totalCells) {
    cells.push({ date: "", day: 0, inMonth: false });
  }
  return cells.slice(0, totalCells);
}

export function isSlotSelected(
  slots: HalfDaySlot[],
  date: string,
  period: DayPeriod,
): boolean {
  return slots.some((s) => s.date === date && s.period === period);
}
