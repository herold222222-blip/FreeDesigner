import { handle, ok } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { listClientsForAdmin } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** 委托人列表（含手机号与统计，仅管理员 / 超级管理员） */
export async function GET() {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const clients = await listClientsForAdmin();
    return ok(clients);
  });
}
