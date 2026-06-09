import { handle, ok } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { countActiveDisputes } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** 进行中纠纷数量（待受理 + 处理中） */
export async function GET() {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    return ok({ active: await countActiveDisputes() });
  });
}
