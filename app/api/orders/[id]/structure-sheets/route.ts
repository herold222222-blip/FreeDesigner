import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { isStaffRole, requireSession } from "@/lib/server/auth";
import { updateOrderStructureSheets } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 管理员 / 超级管理员在任意环节设定或增加景观结构张数 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (!isStaffRole(session.role)) {
      return fail(403, "仅管理员可调整结构设计张数");
    }
    const body = (await req.json()) as {
      sheets?: number;
      addSheets?: number;
    };
    const order = await updateOrderStructureSheets(params.id, body);
    return ok(order);
  });
}
