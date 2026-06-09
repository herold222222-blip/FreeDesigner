import { handle, ok } from "@/lib/server/api";
import { listClients, listClientsForAdmin } from "@/lib/server/repo";
import { getSessionUser, requireRole } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** 委托人列表（仅管理员可见全量；其余角色仅用于名称解析的最小信息） */
export async function GET() {
  return handle(async () => {
    await requireRole("admin", "super_admin", "designer", "client");
    const session = await getSessionUser();
    const clients =
      session?.role === "admin" || session?.role === "super_admin"
        ? await listClientsForAdmin()
        : await listClients();
    return ok(clients);
  });
}
