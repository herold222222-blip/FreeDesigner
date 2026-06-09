import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { AuthError, requireRole } from "@/lib/server/auth";
import { getInvoiceById } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return handle(async () => {
    const session = await requireRole("client");
    const invoice = await getInvoiceById(params.id);
    if (!invoice) throw new AuthError(404, "发票不存在");
    if (invoice.clientId !== session.identityId) {
      throw new AuthError(403, "无权查看该发票");
    }
    return ok(invoice);
  });
}
