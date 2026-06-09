import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { signContract } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** 委托人签署电子合同（签约与预付分离，预付后启动项目） */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    const order = await signContract(params.id, session.identityId);
    return ok(order);
  });
}
