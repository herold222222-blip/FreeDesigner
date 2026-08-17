import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { matchDesignersFromQuoteCards } from "@/lib/server/order-service";
import type { DesignerLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 委托人勾选等级报价卡后，系统自动匹配每卡 3 名备选设计师 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") {
      return fail(403, "仅委托人可发起匹配");
    }
    const body = (await req.json()) as { levels?: DesignerLevel[] };
    if (!body.levels?.length) return fail(400, "请至少选择一档报价卡");
    const order = await matchDesignersFromQuoteCards(
      params.id,
      session.identityId,
      body.levels,
    );
    return ok(order);
  });
}
