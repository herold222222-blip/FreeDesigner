import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { payStage } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 委托人支付某付款阶段：资金进入平台托管 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    const order = await payStage(params.id, params.stageId, session.identityId);
    return ok(order);
  });
}
