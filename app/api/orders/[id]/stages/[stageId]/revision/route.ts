import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { requestStageRevision } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 委托人提交阶段返修需求 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; stageId: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as {
      description?: string;
    };
    const order = await requestStageRevision(
      params.id,
      params.stageId,
      session.identityId,
      body.description ?? "",
    );
    return ok(order);
  });
}
