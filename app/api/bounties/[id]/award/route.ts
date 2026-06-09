import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { awardBountyToDesigner } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 委托人确认悬赏中标设计师并生成平台订单 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") return fail(403, "仅委托人可确认中标");
    const body = (await req.json()) as { designerId?: string };
    if (!body.designerId) return fail(400, "请指定中标设计师");
    const order = await awardBountyToDesigner(
      params.id,
      body.designerId,
      session.identityId,
    );
    return ok(order, { status: 201 });
  });
}
