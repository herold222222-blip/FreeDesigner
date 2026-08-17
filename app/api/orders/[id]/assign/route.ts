import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { assignDesignerToOrder } from "@/lib/server/order-service";
import type { Specialty } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 管理员为常规委托委派设计师（支持按专业分别委派） */
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
      assignments?: Array<{
        l1?: Specialty;
        l2: string;
        l3: string;
        designerId: string;
      }>;
    };
    if (!body.designerId && !(body.assignments && body.assignments.length)) {
      return fail(400, "请指定设计师");
    }
    const order = await assignDesignerToOrder(params.id, {
      designerId: body.designerId,
      totalAmount: body.totalAmount,
      assignments: body.assignments,
    });
    return ok(order);
  });
}
