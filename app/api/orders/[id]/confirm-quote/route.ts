import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { confirmOrderQuote } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 委托人确认按天/按月系统报价 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") {
      return fail(403, "仅委托人可确认报价");
    }
    const order = await confirmOrderQuote(params.id, session.identityId);
    return ok(order);
  });
}
