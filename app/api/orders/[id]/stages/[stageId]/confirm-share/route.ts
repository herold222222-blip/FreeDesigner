import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/repo";
import { ensureDeliverablesConfirmShare } from "@/lib/server/order-service";
import { buildDeliverablesConfirmUrl } from "@/lib/deliverables-confirm-share";
import { orderInvolvesDesigner } from "@/lib/order-assign-tracks";

export const dynamic = "force-dynamic";

/** 委托人 / 设计师 / 管理员：生成或读取本阶段转发成果码 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; stageId: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    const order = await getOrder(params.id);
    if (!order) return fail(404, "订单不存在");
    const isOwner =
      session.role === "client" && session.identityId === order.clientId;
    const isStaff = session.role === "admin" || session.role === "super_admin";
    const isDesigner =
      session.role === "designer" &&
      orderInvolvesDesigner(order, session.identityId);
    if (!isOwner && !isStaff && !isDesigner) {
      return fail(403, "仅本单委托人、设计师或管理员可转发成果");
    }
    const share = await ensureDeliverablesConfirmShare(
      params.id,
      params.stageId,
    );
    return ok({
      ...share,
      url: buildDeliverablesConfirmUrl(share.shareId, req.nextUrl.origin),
    });
  });
}
