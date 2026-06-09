import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { rejectSchedule } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 设计师拒绝档期申请 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") return fail(403, "仅设计师可拒绝档期");
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const order = await rejectSchedule(
      params.id,
      session.identityId,
      body.reason,
    );
    return ok(order);
  });
}
