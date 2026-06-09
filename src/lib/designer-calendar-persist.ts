import { updateDesignerProfileRequest } from "@/lib/api-client";
import { useDesignerCalendarStore } from "@/store/designer-calendar-store";

/** 将内存中的档期/工作日历写回设计师资料（Prisma JSON） */
export async function persistDesignerCalendar(designerId: string) {
  const store = useDesignerCalendarStore.getState();
  await updateDesignerProfileRequest(designerId, {
    calendar: store.getBaseCalendar(designerId),
    workCalendarEvents: store.getEvents(designerId),
    calendarBatchSettings: store.getSettings(designerId),
  });
}
