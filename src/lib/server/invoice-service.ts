import "server-only";
import { validateCreateInvoiceInput, generateInvoiceNo } from "@/lib/invoice";
import type { CreateInvoiceInput, InvoiceRequest } from "@/lib/types";
import { AuthError } from "./auth";
import {
  countInvoicesIssuedToday,
  createInvoiceRequest,
  getInvoiceByWalletTransactionId,
  getWalletTransactionForOwner,
  updateWalletTransaction,
} from "./repo";

function nowIso() {
  return new Date().toISOString();
}

export async function issueInvoiceForPayment(
  clientId: string,
  input: CreateInvoiceInput,
): Promise<InvoiceRequest> {
  const validationError = validateCreateInvoiceInput(input);
  if (validationError) throw new AuthError(400, validationError);

  const existing = await getInvoiceByWalletTransactionId(input.walletTransactionId);
  if (existing) throw new AuthError(409, "该笔付款已开具发票");

  const tx = await getWalletTransactionForOwner(
    input.walletTransactionId,
    clientId,
    "client",
  );
  if (!tx) throw new AuthError(404, "付款记录不存在");
  if (!(tx.type === "income" && tx.amount < 0)) {
    throw new AuthError(400, "仅已完成的支付记录可开发票");
  }

  const seq = (await countInvoicesIssuedToday()) + 1;
  const invoice: InvoiceRequest = {
    id: `inv_${input.walletTransactionId}`,
    invoiceNo: generateInvoiceNo(seq),
    clientId,
    walletTransactionId: tx.id,
    orderId: tx.orderId,
    orderCode: tx.orderCode,
    orderTitle: tx.orderTitle,
    amount: Math.abs(tx.amount),
    title: input.title.trim(),
    taxId: input.taxId.trim(),
    invoiceType: input.invoiceType,
    email: input.email.trim(),
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    bankName: input.bankName?.trim() || undefined,
    bankAccount: input.bankAccount?.trim() || undefined,
    remark: input.remark?.trim() || undefined,
    paymentNote: tx.note,
    status: "issued",
    issuedAt: nowIso(),
  };

  await createInvoiceRequest(invoice);

  await updateWalletTransaction({
    ...tx,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
  });

  return invoice;
}
