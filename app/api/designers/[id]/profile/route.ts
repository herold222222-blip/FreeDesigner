import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { getDesigner, saveDesigner } from "@/lib/server/repo";
import {
  mergeDesignerProfile,
  type DesignerProfileDraft,
} from "@/lib/designer-profile-draft";
import type { Designer } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 设计师更新对外主页资料与自定义费率 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    const isSelf =
      session.role === "designer" && session.identityId === params.id;
    const isAdmin =
      session.role === "admin" || session.role === "super_admin";
    if (!isSelf && !isAdmin) return fail(403, "无权修改该设计师资料");

    const base = await getDesigner(params.id);
    if (!base) return fail(404, "设计师不存在");

    const body = (await req.json()) as {
      profile?: DesignerProfileDraft;
      ratePercents?: Record<string, number>;
      calendar?: Designer["calendar"];
      workCalendarEvents?: Designer["workCalendarEvents"];
      calendarBatchSettings?: Designer["calendarBatchSettings"];
    };

    let next: Designer = base;
    if (body.profile) {
      next = mergeDesignerProfile(next, body.profile);
    }
    if (body.ratePercents) {
      next = { ...next, ratePercents: body.ratePercents };
    }
    if (body.calendar) {
      next = { ...next, calendar: body.calendar };
    }
    if (body.workCalendarEvents) {
      next = { ...next, workCalendarEvents: body.workCalendarEvents };
    }
    if (body.calendarBatchSettings) {
      next = { ...next, calendarBatchSettings: body.calendarBatchSettings };
    }

    await saveDesigner(next);
    return ok(next);
  });
}
