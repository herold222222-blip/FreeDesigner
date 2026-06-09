import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { createPayIntent } from "@/lib/server/payment-service";

export const dynamic = "force-dynamic";

/** 委托人为某付款阶段发起支付，返回二维码/跳转链接（或沙箱自动成功） */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; stageId: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    const intent = await createPayIntent(
      params.id,
      params.stageId,
      session.identityId
    );
    return ok(intent);
  });
}
