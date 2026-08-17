import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { confirmClientMatchedDesigner } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 委托人从备选设计师中确认人选（可按三级专业分别确认） */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "client") {
      return fail(403, "仅委托人可确认匹配设计师");
    }
    const body = (await req.json()) as {
      designerId?: string;
      selections?: Array<{ trackKey: string; designerId: string }>;
    };
    if (!body.designerId && !body.selections?.length) {
      return fail(400, "请为每个专业选择设计师");
    }
    const order = await confirmClientMatchedDesigner(
      params.id,
      session.identityId,
      body,
    );
    return ok(order);
  });
}
