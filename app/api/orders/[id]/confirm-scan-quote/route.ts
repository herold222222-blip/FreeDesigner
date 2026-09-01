import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { confirmScanQuote } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 扫码下单：委托人确认费用与付款阶段 → 进入签约 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") {
      return fail(403, "仅委托人可确认费用方案");
    }
    const body = (await req.json().catch(() => ({}))) as {
      totalAmount?: number;
      stages?: { name: string; ratio: number; note?: string }[];
    };
    const order = await confirmScanQuote(
      params.id,
      session.identityId,
      Number.isFinite(Number(body.totalAmount)) && Number(body.totalAmount) > 0
        ? {
            totalAmount: Number(body.totalAmount),
            stages: Array.isArray(body.stages) ? body.stages : [],
          }
        : undefined,
    );
    return ok(order);
  });
}
