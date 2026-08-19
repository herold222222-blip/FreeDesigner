import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getOrder, saveOrder } from "@/lib/server/repo";
import { isStaffRole, requireSession } from "@/lib/server/auth";
import {
  applyOrderTimeouts,
  deleteOrderPermanently,
  updateMatchingOrder,
  updateScanOrderByDesigner,
  type MatchingOrderUpdateInput,
} from "@/lib/server/order-service";
import { designerIdForSameAccountAsClient } from "@/lib/server/inbox";
import { orderInvolvesDesigner } from "@/lib/order-assign-tracks";
import { normalizePaymentStages } from "@/lib/order-payment-stages";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    let order = await getOrder(params.id);
    if (!order) return fail(404, "订单不存在");
    order = await applyOrderTimeouts(order);
    if (normalizePaymentStages(order)) {
      await saveOrder(order);
    }

    if (session.role === "client" && order.clientId !== session.identityId) {
      return fail(403, "无权访问该订单");
    }
    if (
      session.role === "designer" &&
      !orderInvolvesDesigner(order, session.identityId)
    ) {
      return fail(403, "无权访问该订单");
    }

    const selfDesignerId = await designerIdForSameAccountAsClient(order.clientId);
    if (selfDesignerId && order.clientMatch) {
      if (order.clientMatch.trackPools?.length) {
        order.clientMatch = {
          ...order.clientMatch,
          trackPools: order.clientMatch.trackPools.map((p) => ({
            ...p,
            candidates: p.candidates.filter((c) => c.designerId !== selfDesignerId),
          })),
        };
      }
      if (order.clientMatch.pools?.length) {
        order.clientMatch = {
          ...order.clientMatch,
          pools: order.clientMatch.pools.map((p) => ({
            ...p,
            candidates: p.candidates.filter((c) => c.designerId !== selfDesignerId),
          })),
        };
      }
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
    if (isStaffRole(session.role)) {
      const order = await updateMatchingOrder(params.id, null, body, {
        asAdmin: true,
      });
      return ok(order);
    }
    if (session.role === "client") {
      const order = await updateMatchingOrder(
        params.id,
        session.identityId,
        body,
      );
      return ok(order);
    }
    if (session.role === "designer") {
      const order = await updateScanOrderByDesigner(
        params.id,
        session.identityId,
        body,
      );
      return ok(order);
    }
    return fail(403, "无权修改委托信息");
  });
}

/** 永久删除已取消 / 已完成订单（不可恢复） */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    await deleteOrderPermanently(params.id, {
      role: session.role,
      identityId: session.identityId,
    });
    return ok({ deleted: true });
  });
}
