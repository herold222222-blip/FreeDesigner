import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { sandboxConfirm } from "@/lib/server/payment-service";

export const dynamic = "force-dynamic";

/** 沙箱：模拟支付成功（仅 sandbox 渠道、仅本人） */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    await sandboxConfirm(params.id, session.identityId);
    return ok({ paymentId: params.id, status: "paid" });
  });
}
