import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { skipPreliminaryDeliverables } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 设计师跳过初步成果，进入最终成果 / 确认单 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; stageId: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") return fail(403, "仅设计师可跳过初步成果");
    const order = await skipPreliminaryDeliverables(
      params.id,
      params.stageId,
      session.identityId,
    );
    return ok(order);
  });
}
