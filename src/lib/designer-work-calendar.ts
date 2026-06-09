import { slotKey } from "@/lib/designer-schedule";
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
  const weekend = isWeekend(date);
  const close =
    (settings.closeWeekend && weekend) || (settings.closeHoliday && weekend);
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
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 || day === 6;
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
    const weekend = isWeekend(day.date);
    const close = (opts.closeWeekend && weekend) || (opts.closeHoliday && weekend);
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
