import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { requireRole } from "@/lib/server/auth";
import { issueInvoiceForPayment } from "@/lib/server/invoice-service";
import { listInvoicesByClient } from "@/lib/server/repo";
import type { CreateInvoiceInput } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireRole("client");
    const invoices = await listInvoicesByClient(session.identityId);
    return ok(invoices);
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireRole("client");
    const body = (await req.json()) as CreateInvoiceInput;
    const invoice = await issueInvoiceForPayment(session.identityId, body);
    return ok(invoice);
  });
}
