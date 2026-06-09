import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { getPaymentStatus } from "@/lib/server/payment-service";

export const dynamic = "force-dynamic";

/** 查询支付单状态（前端轮询用） */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    return ok(await getPaymentStatus(params.id, session.identityId));
  });
}
