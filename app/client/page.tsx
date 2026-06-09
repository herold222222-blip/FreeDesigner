"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderRow } from "@/components/domain/order-row";
import { useOrders, useBounties } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import {
  buildClientDashboardSummary,
  CLIENT_ORDER_FOCUS_META,
  countClientOrderFocus,
  type ClientOrderFocus,
} from "@/lib/client-order-focus";
import {
  bountyStatusBadgeVariant,
  bountyStatusLabel,
} from "@/lib/bounty-manage";
import { cn, formatBountyReward } from "@/lib/utils";
import { useMemo } from "react";
import {
  ArrowRight,
  Megaphone,
  Sparkles,
  CalendarRange,
  CircleDollarSign,
  FileSignature,
  FileCheck,
  Headphones,
} from "lucide-react";

const DASHBOARD_CARDS: {
  focus: ClientOrderFocus;
  icon: typeof CircleDollarSign;
}[] = [
  { focus: "pending_payment", icon: CircleDollarSign },
  { focus: "pending_acceptance", icon: FileCheck },
  { focus: "pending_contract", icon: FileSignature },
  { focus: "after_sales", icon: Headphones },
];

export default function ClientDashboardPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const clientId = identityId || "client_lin";
  const { data: orders } = useOrders();
  const { data: allBounties } = useBounties();

  const myBounties = useMemo(
    () => allBounties.filter((b) => b.publisherId === clientId),
    [allBounties, clientId],
  );
  const platformOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.clientId === clientId && o.orderSource !== "bounty",
      ),
    [orders, clientId],
  );
  const myOrders = platformOrders.slice(0, 3);
  const summary = useMemo(
    () => buildClientDashboardSummary(platformOrders),
    [platformOrders],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            林先生,你好 👋
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            今天是 2026-05-01。{summary}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/designers">
              找设计 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="brand">
            <Link href="/entrust/new">
              <Megaphone className="h-4 w-4" /> 发布委托
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {DASHBOARD_CARDS.map(({ focus, icon: Icon }) => {
          const meta = CLIENT_ORDER_FOCUS_META[focus];
          const count = countClientOrderFocus(platformOrders, focus);
          const isPayment = focus === "pending_payment";
          const paymentActive = isPayment && count > 0;
          return (
            <Link key={focus} href={meta.href} className="group block">
              <Card
                className={cn(
                  "relative overflow-hidden p-5 transition-all",
                  isPayment
                    ? cn(
                        "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/80 shadow-sm",
                        "hover:border-amber-400 hover:shadow-md",
                        paymentActive && "ring-2 ring-amber-400/50",
                      )
                    : "hover:border-brand/40 hover:bg-brand/[0.02]",
                )}
              >
                {paymentActive ? (
                  <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                    待付款
                  </span>
                ) : null}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-medium uppercase tracking-wider",
                      isPayment
                        ? "text-amber-900"
                        : "text-ink-40 group-hover:text-ink-60",
                    )}
                  >
                    {meta.label}
                  </span>
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      isPayment
                        ? "bg-amber-200/80 text-amber-800 group-hover:bg-amber-300"
                        : "bg-ink-20/50 group-hover:bg-brand/10",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        isPayment
                          ? "text-amber-800"
                          : "text-ink-60 group-hover:text-brand",
                      )}
                    />
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-3 text-2xl font-semibold tracking-tight",
                    isPayment ? "text-amber-950" : "text-ink",
                  )}
                >
                  {count}
                </div>
                {isPayment && count > 0 ? (
                  <p className="mt-1.5 text-xs font-medium text-amber-800/90">
                    点击前往支付 →
                  </p>
                ) : null}
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-ink">
              最近订单
            </h3>
            <Link
              href="/client/orders"
              className="text-xs font-medium text-brand hover:text-brand-700"
            >
              查看全部 →
            </Link>
          </div>
          <div className="space-y-3">
            {myOrders.length === 0 ? (
              <p className="text-sm text-ink-60">暂无订单。</p>
            ) : null}
            {myOrders.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                href={`/client/orders/${o.id}`}
                perspective="client"
              />
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-tight text-ink">
              我的悬赏
            </h3>
            <Link
              href="/client/bounties"
              className="text-xs font-medium text-brand hover:text-brand-700"
            >
              查看全部 →
            </Link>
          </div>
          <div className="space-y-3">
            {myBounties.length === 0 ? (
              <p className="text-sm text-ink-60">你还没有发布悬赏。</p>
            ) : null}
            {myBounties.slice(0, 3).map((b) => (
              <Link
                key={b.id}
                href={`/client/bounties/${b.id}`}
                className="block rounded-xl border border-ink-20 p-4 transition-colors hover:border-ink"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge
                      variant={bountyStatusBadgeVariant(b.status)}
                      className="mb-2"
                    >
                      {bountyStatusLabel(b.status)}
                    </Badge>
                    <div className="line-clamp-2 text-sm font-medium text-ink">
                      {b.title}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-brand">
                      {formatBountyReward(b.reward)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-ink-60">
                  {b.applicants.length} 位设计师已报名
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden bg-ink p-7 text-white">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20">
              <CalendarRange className="h-5 w-5 text-brand-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <Sparkles className="h-3.5 w-3.5" /> 按月雇佣 · 续约提醒
              </div>
              <div className="mt-1 text-base font-semibold">
                你正在按月雇佣设计师 <strong>李然</strong>(室内设计)
              </div>
              <div className="mt-1 text-xs text-white/60">
                本月雇佣周期至 2026-05-31。请在每月 25 号前支付下月服务费,
                未按时续费将自动终止。
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
              <Link href="/client/monthly">查看续约</Link>
            </Button>
            <Button asChild variant="brand">
              <Link href="/client/monthly">立即续约下月</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
