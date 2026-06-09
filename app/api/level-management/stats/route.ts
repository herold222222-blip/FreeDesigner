import { handle, ok } from "@/lib/server/api";
import { getLevelManagementStats } from "@/lib/server/repo";
import { requireRole } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireRole("super_admin");
    return ok(await getLevelManagementStats());
  });
}
