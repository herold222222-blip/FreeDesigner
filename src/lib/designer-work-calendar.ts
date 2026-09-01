import { slotKey } from "@/lib/designer-schedule";
import {
  isCnHolidayRestDay,
  isCnMakeupWorkday,
  isWeekendDate,
} from "@/lib/cn-workdays";
import type {
  CalendarSlot,
  DayPeriod,
  HalfDaySlot,
  WorkCalendarEvent,
} from "@/lib/types";

export interface CalendarBatchSettings {
  closeWeekend: boolean;
  closeHoliday: boolean;
  allDay: boolean;
}

const DEFAULT_BATCH: CalendarBatchSettings = {
  closeWeekend: true,
  closeHoliday: true,
  allDay: false,
};

/** 未录入日历的未来日期默认开放，仅周末批量规则关闭 */
export function resolvePeriodAvailability(
  calendar: CalendarSlot[],
  date: string,
  period: DayPeriod,
  settings: CalendarBatchSettings = DEFAULT_BATCH,
): boolean {
  const day = calendar.find((s) => s.date === date);
  if (day) {
    return period === "am" ? day.amAvailable : day.pmAvailable;
  }
  if (settings.allDay) return true;
  const weekend = isWeekendDate(date) && !isCnMakeupWorkday(date);
  const holiday = isCnHolidayRestDay(date);
  const close =
    (settings.closeWeekend && weekend) || (settings.closeHoliday && holiday);
  return !close;
}

export type WorkPeriodStatus = "closed" | "free" | "occupied";

export const WORK_PERIOD_META: Record<
  WorkPeriodStatus,
  { label: string; cellClass: string; dotClass: string }
> = {
  closed: {
    label: "不接单",
    cellClass: "bg-ink-20/50 text-ink-40 line-through",
    dotClass: "bg-ink-20",
  },
  free: {
    label: "空闲",
    cellClass: "bg-emerald-50/90 text-emerald-800 hover:bg-emerald-100",
    dotClass: "bg-emerald-500",
  },
  occupied: {
    label: "已安排工作",
    cellClass: "bg-rose-50 text-rose-800 hover:bg-rose-100",
    dotClass: "bg-rose-500",
  },
};

export function getWorkPeriodStatus(
  calendar: CalendarSlot[],
  date: string,
  period: DayPeriod,
  occupiedKeys: Set<string>,
  settings: CalendarBatchSettings = DEFAULT_BATCH,
): WorkPeriodStatus {
  const open = resolvePeriodAvailability(calendar, date, period, settings);
  if (!open) return "closed";
  if (occupiedKeys.has(slotKey({ date, period }))) return "occupied";
  return "free";
}

export function isPeriodMarkable(
  calendar: CalendarSlot[],
  date: string,
  period: DayPeriod,
  occupiedKeys: Set<string>,
  settings: CalendarBatchSettings = DEFAULT_BATCH,
) {
  return (
    getWorkPeriodStatus(calendar, date, period, occupiedKeys, settings) ===
    "free"
  );
}

export function collectOccupiedKeys(events: WorkCalendarEvent[]): Set<string> {
  return new Set(events.map((e) => slotKey({ date: e.date, period: e.period })));
}

export function eventsForPeriod(
  events: WorkCalendarEvent[],
  date: string,
  period: DayPeriod,
): WorkCalendarEvent[] {
  return events.filter((e) => e.date === date && e.period === period);
}

/** 将日程占用同步到档期（占用时段不可预约） */
export function applyEventsToCalendar(
  calendar: CalendarSlot[],
  events: WorkCalendarEvent[],
): CalendarSlot[] {
  const occupied = collectOccupiedKeys(events);
  return calendar.map((day) => {
    const amBlocked =
      occupied.has(slotKey({ date: day.date, period: "am" })) && day.amAvailable;
    const pmBlocked =
      occupied.has(slotKey({ date: day.date, period: "pm" })) && day.pmAvailable;
    if (!amBlocked && !pmBlocked) return day;
    return {
      ...day,
      amAvailable: amBlocked ? false : day.amAvailable,
      pmAvailable: pmBlocked ? false : day.pmAvailable,
      available:
        (amBlocked ? false : day.amAvailable) ||
        (pmBlocked ? false : day.pmAvailable),
    };
  });
}

export function isWeekend(date: string) {
  return isWeekendDate(date);
}

/** 批量设置：周末 / 节假日关闭档期 */
export function applyCalendarBatchRules(
  calendar: CalendarSlot[],
  opts: { closeWeekend: boolean; closeHoliday: boolean; allDay: boolean },
): CalendarSlot[] {
  if (opts.allDay) {
    return calendar.map((day) => ({
      ...day,
      amAvailable: true,
      pmAvailable: true,
      available: true,
    }));
  }
  return calendar.map((day) => {
    const weekend = isWeekendDate(day.date) && !isCnMakeupWorkday(day.date);
    const holiday = isCnHolidayRestDay(day.date);
    const close =
      (opts.closeWeekend && weekend) || (opts.closeHoliday && holiday);
    if (!close) return day;
    return {
      ...day,
      amAvailable: false,
      pmAvailable: false,
      available: false,
    };
  });
}

export function toggleCalendarPeriod(
  calendar: CalendarSlot[],
  date: string,
  period: DayPeriod,
): CalendarSlot[] {
  return calendar.map((day) => {
    if (day.date !== date) return day;
    const next =
      period === "am" ?
        { ...day, amAvailable: !day.amAvailable }
      : { ...day, pmAvailable: !day.pmAvailable };
    return {
      ...next,
      available: next.amAvailable || next.pmAvailable,
    };
  });
}

export function slotsFromEvents(events: WorkCalendarEvent[]): HalfDaySlot[] {
  return events.map((e) => ({ date: e.date, period: e.period }));
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 把未录入的日期按批量规则补齐，便于委托人日历点选忙闲 */
export function expandCalendarDateRange(
  calendar: CalendarSlot[],
  settings: CalendarBatchSettings = DEFAULT_BATCH,
  fromIso: string,
  toIso: string,
): CalendarSlot[] {
  const byDate = new Map(calendar.map((s) => [s.date, s]));
  const result: CalendarSlot[] = [];
  const cur = new Date(`${fromIso}T00:00:00`);
  const end = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) {
    return [...calendar];
  }
  while (cur <= end) {
    const date = toIsoDate(cur);
    const existing = byDate.get(date);
    if (existing) {
      result.push(existing);
    } else {
      const amAvailable = resolvePeriodAvailability(
        calendar,
        date,
        "am",
        settings,
      );
      const pmAvailable = resolvePeriodAvailability(
        calendar,
        date,
        "pm",
        settings,
      );
      result.push({
        date,
        amAvailable,
        pmAvailable,
        available: amAvailable || pmAvailable,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

/** 委托人点选用：补齐日期 + 扣掉工作日历已占用时段 */
export function buildDesignerBookingCalendar(
  input: {
    calendar?: CalendarSlot[];
    workCalendarEvents?: WorkCalendarEvent[];
    calendarBatchSettings?: CalendarBatchSettings;
  },
  options?: { fromYear?: number; years?: number },
): {
  base: CalendarSlot[];
  booking: CalendarSlot[];
  events: WorkCalendarEvent[];
} {
  const now = new Date();
  const fromYear = options?.fromYear ?? now.getFullYear() - 1;
  const years = options?.years ?? 4;
  const toYear = fromYear + Math.max(years, 1) - 1;
  const settings = input.calendarBatchSettings ?? DEFAULT_BATCH;
  const events = input.workCalendarEvents ?? [];
  const base = expandCalendarDateRange(
    input.calendar ?? [],
    settings,
    `${fromYear}-01-01`,
    `${toYear}-12-31`,
  );
  return {
    base,
    booking: applyEventsToCalendar(base, events),
    events,
  };
}
