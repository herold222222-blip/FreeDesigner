"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import { AdminConsoleReturnBar } from "@/components/layout/admin-console-return-bar";
import { useConsoleBasePath } from "@/components/layout/console-base-path";
import { fetchAdminClientPayments } from "@/lib/api-client";
import { parseAdminUsersReturnTo, withReturnTo } from "@/lib/admin-return-to";
import { useOrders } from "@/lib/use-data";
import { isProjectId } from "@/lib/project-id";
import { clients as mockClients } from "@/mocks/clients";
import { clientWalletByOwnerId } from "@/mocks/wallet";
import type { Client, Order, WalletTransaction } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ChevronRight, Receipt } from "lucide-react";

function sumTotalPaid(transactions: WalletTransaction[]) {
  return Math.abs(
    transactions
      .filter((t) => t.type === "income" && t.amount < 0)
      .reduce((acc, t) => acc + t.amount, 0),
  );
}

function AdminClientPaymentsInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const base = useConsoleBasePath();
  const clientId = String(params.id);
  const usersReturnTo = parseAdminUsersReturnTo(searchParams.get("returnTo"));
  const { data: orders } = useOrders();

  const [client, setClient] = useState<Client | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminClientPayments(clientId)
      .then((payload) => {
        if (!active) return;
        setClient(payload.client);
        setTransactions(payload.transactions);
        setTotalPaid(payload.totalPaidAmount);
      })
      .catch(() => {
        if (!active) return;
        const mock = mockClients.find((c) => c.id === clientId);
        const txs = clientWalletByOwnerId[clientId] ?? [];
        setClient(mock ?? null);
        setTransactions(txs);
        setTotalPaid(sumTotalPaid(txs));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  const orderByCode = useMemo(() => {
    const map = new Map<string, Order>();
    for (const order of orders) {
      map.set(order.code, order);
    }
    return map;
  }, [orders]);

  if (loading) {
    return (
      <Card className="p-12 text-center text-sm text-ink-60">
        正在加载付款记录...
      </Card>
    );
  }

  if (!client) {
    return (
      <Card className="p-12 text-center text-sm text-ink-60">
        委托人不存在或无法访问。
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {usersReturnTo ? (
        <AdminConsoleReturnBar
          returnTo={usersReturnTo}
          label="返回委托人列表"
        />
      ) : null}

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          付款详情 · {client.name}
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          查看该委托人的历史付款流水与累计支付金额。
        </p>
      </div>

      <Card className="p-5">
        <div className="text-xs uppercase tracking-wider text-ink-40">
          累计支付金额
        </div>
        <div className="mt-2 text-2xl font-semibold text-ink">
          {formatCurrency(totalPaid)}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            支付记录
          </h3>
          <span className="text-xs text-ink-40">
            共 {transactions.length} 笔记录
          </span>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-ink-60">暂无付款记录。</p>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((t) => (
              <PaymentRecordRow
                key={t.id}
                transaction={t}
                orderByCode={orderByCode}
                base={base}
                usersReturnTo={usersReturnTo}
              />
            ))}
          </div>
        )}
      </Card>
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
  return { orderId, orderTitle, orderCode };
}

function PaymentRecordRow({
  transaction,
  orderByCode,
  base,
  usersReturnTo,
}: {
  transaction: WalletTransaction;
  orderByCode: Map<string, Order>;
  base: string;
  usersReturnTo: string | null;
}) {
  const { orderId, orderTitle, orderCode } = resolveOrderInfo(
    transaction,
    orderByCode,
  );
  const href = orderId
    ? usersReturnTo
      ? withReturnTo(`${base}/orders/${orderId}`, usersReturnTo)
      : `${base}/orders/${orderId}`
    : undefined;

  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-20 p-4">
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
                    <span className="text-xs text-ink-60">
                      订单编号 {orderCode}
                    </span>
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
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold text-ink">
          {formatCurrency(Math.abs(transaction.amount))}
        </div>
        <div className="text-xs text-ink-40">{transaction.status}</div>
      </div>
    </div>
  );
}

export default function AdminClientPaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">加载中…</div>
      }
    >
      <AdminClientPaymentsInner />
    </Suspense>
  );
}
