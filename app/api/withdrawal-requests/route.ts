import { handle, ok } from "@/lib/server/api";
import { listWithdrawalRequests } from "@/lib/server/repo";
import { requireRole } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    return ok(await listWithdrawalRequests());
  });
}
