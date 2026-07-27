import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getOrder } from "@/lib/server/repo";
import { requireSession } from "@/lib/server/auth";
import {
  applyOrderTimeouts,
  updateMatchingOrder,
  type MatchingOrderUpdateInput,
} from "@/lib/server/order-service";

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

/** 委托人 / 管理员修改待匹配设计师订单的委托信息 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    const body = (await req.json()) as MatchingOrderUpdateInput;
    if (session.role === "client") {
      const order = await updateMatchingOrder(
        params.id,
        session.identityId,
        body,
      );
      return ok(order);
    }
    if (session.role === "admin" || session.role === "super_admin") {
      const order = await updateMatchingOrder(params.id, null, body, {
        asAdmin: true,
      });
      return ok(order);
    }
    return fail(403, "无权修改委托信息");
  });
}
