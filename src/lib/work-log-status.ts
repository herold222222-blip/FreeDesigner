import type { DayPeriod, WorkCalendarEvent } from "@/lib/types";

export type WorkLogStatus = "filled" | "pending" | "overdue";

/** 半天工作日志应在此时间前填写（Asia/Shanghai） */
export function getWorkLogDeadline(date: string, period: DayPeriod): Date {
  const deadline =
    period === "am" ?
      `${date}T12:00:00+08:00`
    : `${date}T23:59:59+08:00`;
  return new Date(deadline);
}

export function getWorkLogStatus(
  event: WorkCalendarEvent,
  now = new Date(),
): WorkLogStatus {
  const hasLog = (event.workContents?.length ?? 0) > 0;
  if (hasLog) return "filled";
  if (now.getTime() > getWorkLogDeadline(event.date, event.period).getTime()) {
    return "overdue";
  }
  return "pending";
}

export const WORK_LOG_STATUS_META: Record<
  WorkLogStatus,
  { label: string; iconClass: string }
> = {
  filled: { label: "已填写工作日志", iconClass: "text-emerald-600" },
  pending: { label: "待填写", iconClass: "text-ink-40" },
  overdue: { label: "逾期未填", iconClass: "text-rose-600" },
};
