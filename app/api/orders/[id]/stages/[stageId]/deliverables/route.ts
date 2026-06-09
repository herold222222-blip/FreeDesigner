import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { submitStageDeliverables } from "@/lib/server/order-service";
import type { DeliverableFile } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 设计师上传阶段成果 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; stageId: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") return fail(403, "仅设计师可上传成果");
    const body = (await req.json().catch(() => ({}))) as {
      files?: DeliverableFile[];
    };
    const order = await submitStageDeliverables(
      params.id,
      params.stageId,
      session.identityId,
      body.files,
    );
    return ok(order);
  });
}
