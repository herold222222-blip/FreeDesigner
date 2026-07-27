import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { cancelOrderByAdmin } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 管理员取消待确认报价 / 待匹配订单 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "admin" && session.role !== "super_admin") {
      return fail(403, "仅管理员可取消订单");
    }
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const order = await cancelOrderByAdmin(params.id, body.reason);
    return ok(order);
  });
}
