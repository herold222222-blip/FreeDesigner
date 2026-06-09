import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { getPlatformStats } from "@/lib/server/platform-stats";
import type { PlatformStatsPeriod } from "@/lib/platform-stats";

export const dynamic = "force-dynamic";

const VALID: PlatformStatsPeriod[] = ["day", "month", "year"];

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "admin" && session.role !== "super_admin") {
      return fail(403, "无权查看平台统计");
    }

    const period = (req.nextUrl.searchParams.get("period") ??
      "month") as PlatformStatsPeriod;
    if (!VALID.includes(period)) return fail(400, "无效的 period 参数");

    const payload = await getPlatformStats(period);
    return ok(payload);
  });
}
