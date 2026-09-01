import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import {
  getOrderReviewShareView,
  submitOrderReviewByShare,
} from "@/lib/server/order-service";
import type { RatingBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 公开：查看转发的待评价项目 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { shareId: string } },
) {
  return handle(async () => {
    const view = await getOrderReviewShareView(params.shareId);
    return ok(view);
  });
}

/** 公开：输入验证码后提交评价 */
export async function POST(
  req: NextRequest,
  { params }: { params: { shareId: string } },
) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      overall?: number;
      breakdown?: RatingBreakdown;
      content?: string;
      anonymous?: boolean;
    };
    const code = (body.code ?? "").trim();
    if (!/^\d{4}$/.test(code)) return fail(400, "请输入 4 位验证码");
    if (!body.breakdown || !body.content?.trim()) {
      return fail(400, "请填写评分和评论");
    }
    const view = await submitOrderReviewByShare(params.shareId, code, {
      overall: body.overall ?? 0,
      breakdown: body.breakdown,
      content: body.content,
      anonymous: body.anonymous,
    });
    return ok(view);
  });
}
