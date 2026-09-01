import { NextRequest } from "next/server";
import { handle, ok, fail } from "@/lib/server/api";
import { requireSession } from "@/lib/server/auth";
import { designerSignContract } from "@/lib/server/order-service";
import { parseContractSignature } from "@/lib/contract-signature";

export const dynamic = "force-dynamic";

/** 设计师签署电子合同 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireSession();
    if (session.role !== "designer") return fail(403, "仅设计师可签署合同");
    const body = (await req.json().catch(() => null)) as
      | { signature?: unknown }
      | null;
    const signature = parseContractSignature(body?.signature);
    if (!signature.ok) return fail(400, signature.error);
    const order = await designerSignContract(
      params.id,
      session.identityId,
      signature.value,
    );
    return ok(order);
  });
}
