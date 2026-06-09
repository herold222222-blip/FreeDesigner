import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import {
  getReviewItem,
  updateReviewItemStatus,
  updateDesignerLevel,
} from "@/lib/server/repo";
import { parsePromotionTargetLevel } from "@/lib/review-promotion";

export const dynamic = "force-dynamic";

/** 管理员 / 超级管理员处理审核工单（入驻审核、见习晋升等） */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action;
    if (action !== "approve" && action !== "reject") {
      return fail(400, "无效的操作");
    }

    const item = await getReviewItem(params.id);
    if (!item) return fail(404, "审核工单不存在");

    const status = action === "approve" ? "approved" : "rejected";
    await updateReviewItemStatus(item.id, status);

    if (action === "approve" && item.refId) {
      if (item.type === "designer_promotion") {
        await updateDesignerLevel(item.refId, "mid_v1");
      } else if (item.type === "designer_level_promotion") {
        const target = parsePromotionTargetLevel(item.payload["申请晋升"]);
        if (!target) return fail(400, "无法识别申请晋升等级");
        await updateDesignerLevel(item.refId, target);
      }
    }

    return ok({ id: item.id, status });
  });
}
