import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/repo";
import { ensureOrderReviewShare } from "@/lib/server/order-service";
import { buildOrderReviewShareUrl } from "@/lib/review-share";

export const dynamic = "force-dynamic";

/** 委托人生成 / 读取本单转发评价码 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    const order = await getOrder(params.id);
    if (!order) return fail(404, "订单不存在");
    const isOwner =
      session.role === "client" && session.identityId === order.clientId;
    const isStaff = session.role === "admin" || session.role === "super_admin";
    if (!isOwner && !isStaff) return fail(403, "仅委托人可转发评价");
    const share = await ensureOrderReviewShare(params.id, order.clientId);
    return ok({
      ...share,
      url: buildOrderReviewShareUrl(share.shareId, req.nextUrl.origin),
    });
  });
}
