import { handle, ok } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { listDesignersForAdmin } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** 设计师列表（含手机号，仅管理员 / 超级管理员） */
export async function GET() {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const designers = await listDesignersForAdmin();
    return ok(designers);
  });
}
