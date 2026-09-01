import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { signContract } from "@/lib/server/order-service";
import { parseContractSignature } from "@/lib/contract-signature";

export const dynamic = "force-dynamic";

/** 委托人签署电子合同（签约与预付分离，预付后启动项目） */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const session = await requireSession();
    const body = (await req.json().catch(() => null)) as
      | { signature?: unknown }
      | null;
    const signature = parseContractSignature(body?.signature);
    if (!signature.ok) return fail(400, signature.error);
    const order = await signContract(
      params.id,
      session.identityId,
      signature.value,
    );
    return ok(order);
  });
}
