import { NextRequest } from "next/server";
import { handle, ok } from "@/lib/server/api";
import { listInvoicesByClient, listWalletTransactions } from "@/lib/server/repo";
import { requireSession } from "@/lib/server/auth";
import type { WalletTransaction } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 根据流水汇总钱包概览（金额取自托管账本，随支付流程动态变化） */
function summarize(transactions: WalletTransaction[]) {
  const sum = (predicate: (t: WalletTransaction) => boolean) =>
    transactions.filter(predicate).reduce((acc, t) => acc + t.amount, 0);

  const totalIncome = sum((t) => t.type === "income" && t.amount > 0);
  const pendingFrozen = sum((t) => t.status === "frozen");
  const available = sum((t) => t.status === "available" && t.amount > 0);
  const withdrawn = Math.abs(sum((t) => t.type === "withdraw"));
  const feeAccumulated = Math.abs(sum((t) => t.type === "fee"));
  const totalSpent = Math.abs(sum((t) => t.type === "income" && t.amount < 0));

  // 近 6 个月入账 / 提现趋势
  const now = new Date();
  const months: { month: string; income: number; withdraw: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ month: key, income: 0, withdraw: 0 });
  }
  for (const t of transactions) {
    const key = t.occurredAt.slice(0, 7);
    const bucket = months.find((m) => m.month === key);
    if (!bucket) continue;
    if (t.type === "income" && t.amount > 0) bucket.income += t.amount;
    if (t.type === "withdraw") bucket.withdraw += Math.abs(t.amount);
  }

  return {
    totalIncome,
    pendingFrozen,
    available,
    withdrawn,
    feeAccumulated,
    topUpBalance: available,
    totalSpent,
    pendingPayments: pendingFrozen,
    refundableEscrow: pendingFrozen,
    monthlyTrend: months,
  };
}

export async function GET(_req: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const ownerType = session.role === "designer" ? "designer" : "client";
    let transactions = await listWalletTransactions(
      session.identityId,
      ownerType,
    );
    if (ownerType === "client") {
      const invoices = await listInvoicesByClient(session.identityId);
      const byTx = new Map(invoices.map((inv) => [inv.walletTransactionId, inv]));
      transactions = transactions.map((t) => {
        const inv = byTx.get(t.id);
        if (!inv) return t;
        return {
          ...t,
          invoiceId: inv.id,
          invoiceNo: inv.invoiceNo,
        };
      });
    }
    return ok({ transactions, summary: summarize(transactions) });
  });
}
