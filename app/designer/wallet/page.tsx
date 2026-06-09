"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import { useOrders, useWallet } from "@/lib/use-data";
import { isProjectId } from "@/lib/project-id";
import type { Order, WalletTransaction } from "@/lib/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  ArrowDownToLine,
  CircleDollarSign,
  Lock,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Receipt,
  Coins,
} from "lucide-react";
import { useSessionStore } from "@/store/session-store";

export default function DesignerWalletPage() {
  const push = useSessionStore((s) => s.pushNotification);
  const { data: wallet } = useWallet();
  const { data: orders } = useOrders();
  const designerWallet = wallet.summary;
  const designerTransactions = wallet.transactions;

  const orderByCode = useMemo(() => {
    const map = new Map<string, Order>();
    for (const order of orders) map.set(order.code, order);
    return map;
  }, [orders]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(0);

  useEffect(() => {
    setWithdrawAmount(designerWallet.available);
  }, [designerWallet.available]);

  const handleWithdraw = () => {
    push({
      title: "提现申请已提交",
      description: `${formatCurrency(withdrawAmount)} 将于 1 个工作日内到账中国建设银行尾号 8821。`,
      variant: "success",
    });
    setWithdrawOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            钱包 · 提现
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            所有项目款项进入 30 天托管期,验收无误后自动解冻可提现。
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/designer/wallet/stats">
            <TrendingUp className="h-4 w-4" />
            收入统计
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-ink-40">
              可提现余额
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-emerald-700">
            {formatCurrency(designerWallet.available)}
          </div>
          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button variant="brand" size="sm" className="mt-3 w-full">
                <ArrowDownToLine className="h-4 w-4" /> 立即提现
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>提现到银行卡</DialogTitle>
                <DialogDescription>
                  提现将于 1 个工作日内到账。原型阶段不会真实发生。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>提现金额</Label>
                  <Input
                    type="number"
                    className="mt-2"
                    value={withdrawAmount}
                    max={designerWallet.available}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value || 0))}
                  />
                  <p className="mt-1 text-xs text-ink-60">
                    最多可提现 {formatCurrency(designerWallet.available)}
                  </p>
                </div>
                <div>
                  <Label>到账银行卡</Label>
                  <div className="mt-2 rounded-xl border border-ink-20 p-3 text-sm">
                    <div className="font-medium text-ink">
                      中国建设银行 · 尾号 8821
                    </div>
                    <div className="mt-1 text-xs text-ink-60">
                      持卡人 · 陈牧之
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                  取消
                </Button>
                <Button variant="brand" onClick={handleWithdraw}>
                  确认提现
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-ink-40">
              托管中(冻结)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
              <Lock className="h-4 w-4 text-violet-600" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-ink">
            {formatCurrency(designerWallet.pendingFrozen)}
          </div>
          <div className="mt-1 text-xs text-ink-60">30 天后自动解冻</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-ink-40">
              累计收入
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-20/50">
              <CircleDollarSign className="h-4 w-4 text-ink-60" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-ink">
            {formatCurrency(designerWallet.totalIncome)}
          </div>
        </Card>

      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            交易流水
          </h3>
          <span className="text-xs text-ink-40">
            共 {designerTransactions.length} 笔记录
          </span>
        </div>
        <div className="space-y-2.5">
          {designerTransactions.map((t) => {
            const isPositive = t.amount > 0;
            const TypeIcon =
              t.type === "income"
                ? Coins
                : t.type === "withdraw"
                  ? ArrowDownToLine
                  : t.type === "fee"
                    ? Receipt
                    : ShieldCheck;
            const orderInfo = resolveDesignerOrderInfo(t, orderByCode);
            return (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-xl border border-ink-20 p-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      t.status === "frozen"
                        ? "bg-violet-100 text-violet-600"
                        : t.type === "withdraw"
                          ? "bg-rose-100 text-rose-600"
                          : t.type === "fee"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium text-ink">{t.note}</div>
                    {orderInfo.href && (orderInfo.orderTitle || orderInfo.orderCode) ? (
                      <Link
                        href={orderInfo.href}
                        className="group block min-w-0 rounded-md transition-colors hover:bg-ink-20/30"
                      >
                        {orderInfo.orderTitle ? (
                          <div className="truncate text-sm font-medium text-ink group-hover:text-brand">
                            {orderInfo.orderTitle}
                          </div>
                        ) : null}
                        {orderInfo.orderCode && isProjectId(orderInfo.orderCode) ? (
                          <ProjectIdCopy code={orderInfo.orderCode} compact />
                        ) : orderInfo.orderCode ? (
                          <span className="text-xs text-ink-60">
                            订单 {orderInfo.orderCode}
                          </span>
                        ) : null}
                      </Link>
                    ) : null}
                    <div className="text-xs text-ink-60">
                      {formatDateTime(t.occurredAt)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-base font-semibold ${
                      isPositive ? "text-ink" : "text-ink-60"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {formatCurrency(t.amount)}
                  </div>
                  <Badge
                    variant={
                      t.status === "frozen"
                        ? "violet"
                        : t.status === "withdrawn"
                          ? "muted"
                          : "emerald"
                    }
                  >
                    {t.status === "frozen"
                      ? "托管中"
                      : t.status === "withdrawn"
                        ? "已提现"
                        : "可提现"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function resolveDesignerOrderInfo(
  transaction: WalletTransaction,
  orderByCode: Map<string, Order>,
) {
  const matched = transaction.orderCode
    ? orderByCode.get(transaction.orderCode)
    : undefined;
  const orderId = transaction.orderId ?? matched?.id;
  const orderTitle = transaction.orderTitle ?? matched?.title;
  const orderCode = transaction.orderCode ?? matched?.code;
  const href = orderId ? `/designer/orders/${orderId}` : undefined;
  return { orderId, orderTitle, orderCode, href };
}
