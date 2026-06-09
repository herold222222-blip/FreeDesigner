import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { getPlatformPricing, savePlatformPricing } from "@/lib/server/repo";
import { requireRole } from "@/lib/server/auth";
import type { PlatformPricingConfig } from "@/lib/platform-pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    return ok(await getPlatformPricing());
  });
}

export async function PUT(req: NextRequest) {
  return handle(async () => {
    await requireRole("super_admin");
    const body = (await req.json()) as PlatformPricingConfig;
    const saved = await savePlatformPricing(body);
    return ok(saved);
  });
}
