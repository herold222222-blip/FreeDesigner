import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getOrder } from "@/lib/server/repo";
import { requireSession } from "@/lib/server/auth";
import { applyOrderTimeouts } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    let order = await getOrder(params.id);
    if (!order) return fail(404, "订单不存在");
    order = await applyOrderTimeouts(order);

    // 访问控制：委托人/设计师仅能查看与自己相关的订单
    if (session.role === "client" && order.clientId !== session.identityId) {
      return fail(403, "无权访问该订单");
    }
    if (session.role === "designer" && order.designerId !== session.identityId) {
      return fail(403, "无权访问该订单");
    }
    return ok(order);
  });
}
