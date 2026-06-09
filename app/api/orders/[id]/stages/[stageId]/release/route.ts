import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { releaseStage } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 委托人确认验收：解冻该阶段款项并扣除平台手续费 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    const order = await releaseStage(
      params.id,
      params.stageId,
      session.identityId
    );
    return ok(order);
  });
}
