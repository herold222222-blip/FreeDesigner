import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { designerSignContract } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 设计师签署电子合同 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") return fail(403, "仅设计师可签署合同");
    const order = await designerSignContract(params.id, session.identityId);
    return ok(order);
  });
}
