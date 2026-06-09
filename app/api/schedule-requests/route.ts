import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { listScheduleRequests } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** 当前身份的档期申请列表 */
export async function GET(_req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role === "designer") {
      return ok(await listScheduleRequests({ designerId: session.identityId }));
    }
    if (session.role === "client") {
      return ok(await listScheduleRequests({ clientId: session.identityId }));
    }
    return ok(await listScheduleRequests());
  });
}
