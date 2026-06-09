import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { acceptDispute } from "@/lib/server/dispute-service";

export const dynamic = "force-dynamic";

/** 管理员受理纠纷 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireRole("admin", "super_admin");
    const dispute = await acceptDispute(params.id, session.identityId);
    return ok(dispute);
  });
}
