/** 中国大陆工作日：周末与法定节假日休息，调休上班日计为工作日。 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdUtc(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return ymdUtc(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function fillRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** 国务院办公厅公布的放假调休：休息日 */
const HOLIDAY_OFF = new Set<string>([
  // 2024 国办发明电〔2023〕7 号
  ...fillRange("2024-01-01", "2024-01-01"),
  ...fillRange("2024-02-10", "2024-02-17"),
  ...fillRange("2024-04-04", "2024-04-06"),
  ...fillRange("2024-05-01", "2024-05-05"),
  ...fillRange("2024-06-08", "2024-06-10"),
  ...fillRange("2024-09-15", "2024-09-17"),
  ...fillRange("2024-10-01", "2024-10-07"),
  // 2025 国办发明电〔2024〕12 号
  ...fillRange("2025-01-01", "2025-01-01"),
  ...fillRange("2025-01-28", "2025-02-04"),
  ...fillRange("2025-04-04", "2025-04-06"),
  ...fillRange("2025-05-01", "2025-05-05"),
  ...fillRange("2025-05-31", "2025-06-02"),
  ...fillRange("2025-10-01", "2025-10-08"),
  // 2026 国办发明电〔2025〕7 号
  ...fillRange("2026-01-01", "2026-01-03"),
  ...fillRange("2026-02-15", "2026-02-23"),
  ...fillRange("2026-04-04", "2026-04-06"),
  ...fillRange("2026-05-01", "2026-05-05"),
  ...fillRange("2026-06-19", "2026-06-21"),
  ...fillRange("2026-09-25", "2026-09-27"),
  ...fillRange("2026-10-01", "2026-10-07"),
]);

/** 调休上班日（周末上班） */
const MAKEUP_WORKDAYS = new Set<string>([
  "2024-02-04",
  "2024-02-18",
  "2024-04-28",
  "2024-05-11",
  "2024-09-14",
  "2024-09-29",
  "2024-10-12",
  "2025-01-26",
  "2025-02-08",
  "2025-04-27",
  "2025-09-28",
  "2025-10-11",
  "2026-01-04",
  "2026-02-14",
  "2026-02-28",
  "2026-05-09",
  "2026-09-20",
  "2026-10-10",
]);

/** 0 = 周日 … 6 = 周六，按北京时间 */
export function shanghaiWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 4, 0, 0)).getUTCDay();
}

export function isWeekendDate(date: string): boolean {
  const day = shanghaiWeekday(date);
  return day === 0 || day === 6;
}

export function isCnHolidayRestDay(date: string): boolean {
  return HOLIDAY_OFF.has(date);
}

export function isCnMakeupWorkday(date: string): boolean {
  return MAKEUP_WORKDAYS.has(date);
}

export type CnDayKind = "workday" | "weekend" | "holiday" | "makeup";

export function classifyCnDay(date: string): CnDayKind {
  if (MAKEUP_WORKDAYS.has(date)) return "makeup";
  if (HOLIDAY_OFF.has(date)) return "holiday";
  if (isWeekendDate(date)) return "weekend";
  return "workday";
}

/** 按月服务计入的工作日：不含周末与法定节假日，含调休上班日 */
export function isCnWorkday(date: string): boolean {
  const kind = classifyCnDay(date);
  return kind === "workday" || kind === "makeup";
}

export function isCnRestDay(date: string): boolean {
  return !isCnWorkday(date);
}

export function eachDateInclusive(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  return fillRange(from, to);
}

export function shiftIsoDate(iso: string, days: number): string {
  return addDays(iso.slice(0, 10), days);
}

export function previousCnWorkday(date: string): string {
  let cur = shiftIsoDate(date, -1);
  for (let i = 0; i < 21; i++) {
    if (isCnWorkday(cur)) return cur;
    cur = shiftIsoDate(cur, -1);
  }
  return cur;
}

/** 截止日落在休息日时，提前到前一个工作日；已是工作日则不变 */
export function adjustToPreviousCnWorkday(date: string): string {
  const ymd = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return isCnWorkday(ymd) ? ymd : previousCnWorkday(ymd);
}
