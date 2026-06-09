import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { getPlatformContent, savePlatformContent } from "@/lib/server/repo";
import { requireRole } from "@/lib/server/auth";
import type { PlatformContentConfig } from "@/lib/platform-content";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => ok(await getPlatformContent()));
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    await requireRole("admin", "super_admin");
    const body = (await req.json()) as PlatformContentConfig;
    return ok(await savePlatformContent(body));
  });
}
