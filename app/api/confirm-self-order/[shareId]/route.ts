import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { getSessionUser } from "@/lib/server/auth";
import {
  confirmSelfOrderByShare,
  getSelfOrderShareView,
} from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 公开：查看设计师自己下单的确认页 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { shareId: string } },
) {
  return handle(async () => {
    const view = await getSelfOrderShareView(params.shareId);
    return ok(view);
  });
}

/** 委托人登录后输入验证码确认订单 */
export async function POST(
  req: NextRequest,
  { params }: { params: { shareId: string } },
) {
  return handle(async () => {
    const session = await getSessionUser();
    if (!session || session.role !== "client") {
      return fail(401, "请先登录委托人账号后再确认");
    }
    const body = (await req.json().catch(() => ({}))) as { code?: string };
    const code = (body.code ?? "").trim();
    if (!/^\d{4}$/.test(code)) return fail(400, "请输入 4 位验证码");
    const view = await confirmSelfOrderByShare(
      params.shareId,
      code,
      session.identityId,
    );
    return ok(view);
  });
}
