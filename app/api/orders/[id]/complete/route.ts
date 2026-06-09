import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { confirmFinalSettlement } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 委托人确认最终服务完成 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    const order = await confirmFinalSettlement(params.id, session.identityId);
    return ok(order);
  });
}
