import type { CreateInvoiceInput, InvoiceType, WalletTransaction } from "@/lib/types";

/** 委托人已完成支付、可申请开票的流水 */
export function isInvoiceEligibleTransaction(tx: WalletTransaction): boolean {
  return tx.type === "income" && tx.amount < 0 && !tx.invoiceId;
}

export function invoiceTypeLabel(type: InvoiceType) {
  return type === "ordinary" ? "电子普通发票" : "电子专用发票";
}

export function validateCreateInvoiceInput(input: CreateInvoiceInput): string | null {
  if (!input.walletTransactionId.trim()) return "缺少付款记录";
  if (!input.title.trim()) return "请填写发票抬头";
  if (!input.taxId.trim()) return "请填写纳税人识别号";
  if (!input.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "请填写有效的接收邮箱";
  }
  if (input.invoiceType === "special") {
    if (!input.address?.trim()) return "专票需填写注册地址";
    if (!input.bankName?.trim()) return "专票需填写开户银行";
    if (!input.bankAccount?.trim()) return "专票需填写银行账号";
  }
  return null;
}

export function generateInvoiceNo(seq: number, at = new Date()) {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  const suffix = String(seq).padStart(4, "0");
  return `LZF${y}${m}${d}${suffix}`;
}
