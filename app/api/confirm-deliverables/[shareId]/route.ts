import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import {
  confirmStageDeliverablesByShare,
  getDeliverablesConfirmShareView,
} from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 公开：查看转发的待确认成果 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { shareId: string } },
) {
  return handle(async () => {
    const view = await getDeliverablesConfirmShareView(params.shareId);
    return ok(view);
  });
}

/** 公开：输入验证码确认成果 */
export async function POST(
  req: NextRequest,
  { params }: { params: { shareId: string } },
) {
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as { code?: string };
    const code = (body.code ?? "").trim();
    if (!/^\d{4}$/.test(code)) return fail(400, "请输入 4 位验证码");
    const view = await confirmStageDeliverablesByShare(params.shareId, code);
    return ok(view);
  });
}
