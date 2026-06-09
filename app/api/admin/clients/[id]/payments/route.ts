import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { getClient, listClientPaymentsForAdmin } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

/** 委托人付款流水（仅管理员 / 超级管理员） */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const client = await getClient(params.id);
    if (!client) return fail(404, "委托人不存在");
    const payload = await listClientPaymentsForAdmin(params.id);
    return ok({ client, ...payload });
  });
}
