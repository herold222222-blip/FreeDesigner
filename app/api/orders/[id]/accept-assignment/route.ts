import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { acceptDesignerAssignment } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 设计师同意平台委派：pending_designer_accept → pending_contract */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") {
      return fail(403, "仅设计师可确认委派");
    }
    const order = await acceptDesignerAssignment(
      params.id,
      session.identityId,
    );
    return ok(order);
  });
}
