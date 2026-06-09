import type { WorkCalendarEvent, WorkContentItem } from "@/lib/types";

export const WORK_CONTENT_EDIT_MS = 24 * 60 * 60 * 1000;

export function canEditWorkContents(
  event: WorkCalendarEvent,
  now = Date.now(),
): boolean {
  if (!event.workContentsSavedAt) return true;
  const savedAt = new Date(event.workContentsSavedAt).getTime();
  return now - savedAt < WORK_CONTENT_EDIT_MS;
}

export function workContentEditRemainingMs(
  event: WorkCalendarEvent,
  now = Date.now(),
): number {
  if (!event.workContentsSavedAt) return WORK_CONTENT_EDIT_MS;
  const savedAt = new Date(event.workContentsSavedAt).getTime();
  return Math.max(0, WORK_CONTENT_EDIT_MS - (now - savedAt));
}

export function formatEditRemaining(ms: number): string {
  if (ms <= 0) return "已锁定";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.ceil((ms % 3_600_000) / 60_000);
  if (hours > 0) return `剩余 ${hours} 小时 ${minutes} 分钟可修改`;
  return `剩余 ${minutes} 分钟可修改`;
}

export function normalizeWorkContentInputs(lines: string[]): WorkContentItem[] {
  return lines
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, i) => ({
      id: `wc_${Date.now().toString(36)}_${i}`,
      text,
    }));
}

export function workContentsToInputs(
  items?: WorkContentItem[],
): string[] {
  if (!items?.length) return [""];
  return items.map((i) => i.text);
}

export function getOrderWorkCalendarEvents(
  events: WorkCalendarEvent[],
  orderCode: string,
) {
  return events
    .filter((e) => e.orderCode === orderCode)
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return a.period === "am" ? -1 : 1;
    });
}
