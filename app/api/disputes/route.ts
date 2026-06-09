import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { listDisputes } from "@/lib/server/repo";
import { fileDispute } from "@/lib/server/dispute-service";
import type { DisputeStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set<DisputeStatus>(["open", "in_review", "resolved"]);

/** 查询纠纷列表 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const status = req.nextUrl.searchParams.get("status") as DisputeStatus | null;
    if (status && !VALID_STATUS.has(status)) {
      return fail(400, "无效的 status 参数");
    }

    if (session.role === "admin" || session.role === "super_admin") {
      return ok(await listDisputes(status ? { status } : undefined));
    }

    if (session.role === "client") {
      return ok(
        await listDisputes({
          clientId: session.identityId,
          ...(status ? { status } : {}),
        }),
      );
    }

    if (session.role === "designer") {
      return ok(
        await listDisputes({
          designerId: session.identityId,
          ...(status ? { status } : {}),
        }),
      );
    }

    return fail(403, "无权查看纠纷");
  });
}

/** 发起纠纷 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const body = (await req.json()) as {
      orderId?: string;
      type?: string;
      description?: string;
      evidence?: { name: string }[];
      stageId?: string;
    };

    if (!body.orderId) return fail(400, "缺少 orderId");

    const dispute = await fileDispute(session, {
      orderId: body.orderId,
      type: body.type ?? "",
      description: body.description ?? "",
      evidence: body.evidence,
      stageId: body.stageId,
    });
    return ok(dispute);
  });
}
