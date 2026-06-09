"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import { InvoiceRequestDialog } from "@/components/domain/invoice-request-dialog";
import { useClient, useOrders, useWallet } from "@/lib/use-data";
import { isInvoiceEligibleTransaction } from "@/lib/invoice";
import { isProjectId } from "@/lib/project-id";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Order, WalletTransaction } from "@/lib/types";
import { useRoleStore } from "@/store/role-store";
import {
  CircleDollarSign,
  PiggyBank,
  ShieldCheck,
  Wallet,
  Receipt,
  ChevronRight,
  FileText,
} from "lucide-react";

export default function ClientWalletPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const { data: wallet, refresh: refreshWallet } = useWallet();
  const { data: orders } = useOrders();
  const { data: client } = useClient(identityId);
  const clientWallet = wallet.summary;
  const clientTransactions = wallet.transactions;

  const [invoiceTx, setInvoiceTx] = useState<WalletTransaction | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const orderByCode = useMemo(() => {
    const map = new Map<string, Order>();
    for (const order of orders) {
      map.set(order.code, order);
    }
    return map;
  }, [orders]);

  const openInvoice = (tx: WalletTransaction) => {
    setInvoiceTx(tx);
    setInvoiceOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          钱包 · 支付记录
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          管理预存余额，查看历史付款与平台托管资金；已完成支付可申请开具电子发票。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="账户余额"
          value={formatCurrency(clientWallet.topUpBalance)}
          tone="brand"
          action={<Button variant="brand" size="sm">充值</Button>}
        />
        <StatCard
          icon={CircleDollarSign}
          label="累计支付"
          value={formatCurrency(clientWallet.totalSpent)}
          tone="ink"
        />
        <StatCard
          icon={PiggyBank}
          label="待付阶段款"
          value={formatCurrency(clientWallet.pendingPayments)}
          tone="amber"
        />
        <StatCard
          icon={ShieldCheck}
          label="平台托管中"
          value={formatCurrency(clientWallet.refundableEscrow)}
          tone="emerald"
        />
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            支付记录
          </h3>
          <span className="text-xs text-ink-40">
            共 {clientTransactions.length} 笔记录
          </span>
        </div>
        <div className="space-y-2.5">
          {clientTransactions.map((t) => (
            <PaymentRecordRow
              key={t.id}
              transaction={t}
              orderByCode={orderByCode}
              onInvoice={() => openInvoice(t)}
            />
          ))}
        </div>
      </Card>

      <InvoiceRequestDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        transaction={invoiceTx}
        client={client}
        onIssued={() => refreshWallet()}
      />
    </div>
  );
}

function resolveOrderInfo(
  transaction: WalletTransaction,
  orderByCode: Map<string, Order>,
) {
  const matched = transaction.orderCode
    ? orderByCode.get(transaction.orderCode)
    : undefined;
  const orderId = transaction.orderId ?? matched?.id;
  const orderTitle = transaction.orderTitle ?? matched?.title;
  const orderCode = transaction.orderCode ?? matched?.code;
  const href = orderId ? `/client/orders/${orderId}` : undefined;
  return { orderId, orderTitle, orderCode, href };
}

function PaymentRecordRow({
  transaction,
  orderByCode,
  onInvoice,
}: {
  transaction: WalletTransaction;
  orderByCode: Map<string, Order>;
  onInvoice: () => void;
}) {
  const { orderTitle, orderCode, href } = resolveOrderInfo(
    transaction,
    orderByCode,
  );
  const canInvoice = isInvoiceEligibleTransaction(transaction);
  const hasInvoice = !!transaction.invoiceId || !!transaction.invoiceNo;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-20 p-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-20/40">
          <Receipt className="h-4 w-4 text-ink-60" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium text-ink">{transaction.note}</div>
          {href && (orderTitle || orderCode) ? (
            <Link
              href={href}
              className="group block min-w-0 rounded-md transition-colors hover:bg-ink-20/30"
            >
              {orderTitle ? (
                <div className="truncate text-sm font-medium text-ink group-hover:text-brand">
                  {orderTitle}
                </div>
              ) : null}
              {orderCode ? (
                <div className="flex items-center gap-1 group-hover:text-brand">
                  {isProjectId(orderCode) ? (
                    <ProjectIdCopy code={orderCode} compact />
                  ) : (
                    <span className="text-xs text-ink-60">订单编号 {orderCode}</span>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-60 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              ) : null}
            </Link>
          ) : orderCode ? (
            <div className="text-xs text-ink-60">订单编号 {orderCode}</div>
          ) : null}
          <div className="text-xs text-ink-60">
            {formatDateTime(transaction.occurredAt)}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 pl-2 text-right">
        <div className="text-base font-semibold text-ink">
          {formatCurrency(transaction.amount)}
        </div>
        <div className="text-xs text-ink-60">
          {transaction.amount < 0 ? "资金已托管" : transaction.status}
        </div>
        {canInvoice || hasInvoice ? (
          <Button
            type="button"
            variant={hasInvoice ? "outline" : "brand"}
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={onInvoice}
          >
            <FileText className="h-3.5 w-3.5" />
            {hasInvoice ? "查看发票" : "开发票"}
          </Button>
        ) : null}
        {hasInvoice && transaction.invoiceNo ? (
          <div className="text-[10px] tabular-nums text-brand">
            {transaction.invoiceNo}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "brand" | "ink" | "amber" | "emerald";
  action?: React.ReactNode;
}) {
  const toneMap = {
    brand: "bg-brand/10 text-brand",
    ink: "bg-ink-20/40 text-ink",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-ink-40">
          {label}
        </span>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${toneMap[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}
