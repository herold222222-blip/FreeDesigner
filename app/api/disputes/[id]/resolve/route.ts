import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { resolveDispute } from "@/lib/server/dispute-service";
import type { DisputeResolution } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 管理员裁决纠纷 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireRole("admin", "super_admin");
    const body = (await req.json()) as {
      resolution?: DisputeResolution;
      clientSharePercent?: number;
      note?: string;
    };

    if (
      body.resolution !== "client" &&
      body.resolution !== "designer" &&
      body.resolution !== "split"
    ) {
      return fail(400, "请指定 resolution: client | designer | split");
    }

    const dispute = await resolveDispute(params.id, session.identityId, {
      resolution: body.resolution,
      clientSharePercent: body.clientSharePercent,
      note: body.note,
    });
    return ok(dispute);
  });
}
