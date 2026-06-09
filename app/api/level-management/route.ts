import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { getLevelManagement, saveLevelManagement } from "@/lib/server/repo";
import { requireRole } from "@/lib/server/auth";
import type { LevelManagementConfig } from "@/lib/level-management";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireRole("super_admin");
    return ok(await getLevelManagement());
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    await requireRole("super_admin");
    const body = (await req.json()) as LevelManagementConfig;
    return ok(await saveLevelManagement(body));
  });
}
