import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireStaff } from "@/lib/server/auth";
import { confirmCsQuote } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 管理员 / 超级管理员二次确认委托需求，开放委托人选卡匹配 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireStaff();
    const order = await confirmCsQuote(params.id, session.userId);
    return ok(order);
  });
}
