import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { assignDesignerToOrder } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 管理员为常规委托委派设计师 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "admin" && session.role !== "super_admin") {
      return fail(403, "仅管理员可委派设计师");
    }
    const body = (await req.json()) as {
      designerId?: string;
      totalAmount?: number;
    };
    if (!body.designerId) return fail(400, "请指定设计师");
    const order = await assignDesignerToOrder(
      params.id,
      body.designerId,
      body.totalAmount,
    );
    return ok(order);
  });
}
