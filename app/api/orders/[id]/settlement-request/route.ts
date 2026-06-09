import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { requestProjectSettlement } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 设计师申请项目结算 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") return fail(403, "仅设计师可申请结算");
    const order = await requestProjectSettlement(
      params.id,
      session.identityId,
    );
    return ok(order);
  });
}
