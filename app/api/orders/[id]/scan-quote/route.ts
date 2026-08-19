import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { proposeScanQuote } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 扫码下单：设计师提交费用与付款阶段 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") {
      return fail(403, "仅设计师可提交费用方案");
    }
    const body = (await req.json().catch(() => ({}))) as {
      totalAmount?: number;
      stages?: { name: string; ratio: number; note?: string }[];
    };
    const order = await proposeScanQuote(params.id, session.identityId, {
      totalAmount: Number(body.totalAmount),
      stages: Array.isArray(body.stages) ? body.stages : [],
    });
    return ok(order);
  });
}
