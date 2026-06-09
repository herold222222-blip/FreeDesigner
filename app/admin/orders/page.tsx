"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminOrderListToolbar } from "@/components/domain/admin-order-list-toolbar";
import { OrderRow } from "@/components/domain/order-row";
import { useConsoleBasePath } from "@/components/layout/console-base-path";
import {
  buildAdminOrderPartyIndex,
  countAdminOrdersBySpecialty,
  countAdminOrdersByStatus,
  filterAdminOrders,
  parseAdminOrderStatusParam,
  type AdminOrderSpecialtyFilter,
  type AdminOrderStatusFilter,
} from "@/lib/admin-order-filters";
import {
  countPaymentOverdueOrders,
  getOrderPaymentOverdueInfo,
} from "@/lib/order-payment-overdue";
import { AdminConsoleReturnBar } from "@/components/layout/admin-console-return-bar";
import { parseAdminUsersReturnTo, withReturnTo } from "@/lib/admin-return-to";
import { useAdminDesigners, useClients, useOrders } from "@/lib/use-data";
import { cn } from "@/lib/utils";
import { designers as mockDesigners } from "@/mocks/designers";
import { clients as mockClients } from "@/mocks/clients";

function AdminOrdersInner() {
  const base = useConsoleBasePath();
  const searchParams = useSearchParams();
  const { data: orders, loading } = useOrders();
  const { data: designersRaw } = useAdminDesigners();
  const { data: clientsRaw } = useClients();
  const designers = designersRaw.length > 0 ? designersRaw : mockDesigners;
  const clients = clientsRaw.length > 0 ? clientsRaw : mockClients;

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<AdminOrderStatusFilter>("all");
  const [specialtyFilter, setSpecialtyFilter] =
    useState<AdminOrderSpecialtyFilter>("all");

  const designerIdFilter = searchParams.get("designerId") ?? undefined;
  const clientIdFilter = searchParams.get("clientId") ?? undefined;
  const statusParam = searchParams.get("status");
  const usersReturnTo = parseAdminUsersReturnTo(searchParams.get("returnTo"));

  const orderListQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (designerIdFilter) params.set("designerId", designerIdFilter);
    if (clientIdFilter) params.set("clientId", clientIdFilter);
    if (statusParam) params.set("status", statusParam);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [designerIdFilter, clientIdFilter, statusParam]);
  const filteredDesigner = designerIdFilter
    ? designers.find((d) => d.id === designerIdFilter)
    : undefined;
  const filteredClient = clientIdFilter
    ? clients.find((c) => c.id === clientIdFilter)
    : undefined;

  useEffect(() => {
    setStatusFilter(parseAdminOrderStatusParam(searchParams.get("status")));
  }, [searchParams]);

  const partyIndex = useMemo(
    () => buildAdminOrderPartyIndex(designers, clients),
    [designers, clients],
  );

  const statusCounts = useMemo(
    () =>
      countAdminOrdersByStatus(orders, query, specialtyFilter, partyIndex),
    [orders, query, specialtyFilter, partyIndex],
  );

  const specialtyCounts = useMemo(
    () => countAdminOrdersBySpecialty(orders, query, statusFilter, partyIndex),
    [orders, query, statusFilter, partyIndex],
  );

  const filteredOrders = useMemo(
    () =>
      filterAdminOrders(
        orders,
        query,
        statusFilter,
        specialtyFilter,
        partyIndex,
        designerIdFilter,
        clientIdFilter,
      ),
    [
      orders,
      query,
      statusFilter,
      specialtyFilter,
      partyIndex,
      designerIdFilter,
      clientIdFilter,
    ],
  );

  const overdueCount = useMemo(
    () => countPaymentOverdueOrders(orders),
    [orders],
  );

  const inProgressCount = orders.filter((o) =>
    ["in_progress", "pending_review", "in_revision"].includes(o.status),
  ).length;

  return (
    <div className="space-y-6">
      {usersReturnTo ? (
        <AdminConsoleReturnBar returnTo={usersReturnTo} />
      ) : null}

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          订单监管
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          查看平台所有订单状态、资金流转、合同签署情况。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`${base}/orders?status=payment_overdue`} className="block">
          <Card
            className={cn(
              "p-5 transition-all hover:border-rose-300 hover:shadow-md",
              statusFilter === "payment_overdue" && "border-rose-300 ring-1 ring-rose-200",
            )}
          >
            <div className="text-xs uppercase tracking-wider text-ink-40">
              超时支付订单
            </div>
            <div className="mt-2 text-2xl font-semibold text-rose-600">
              {overdueCount}
            </div>
            <p className="mt-2 text-[11px] text-ink-40">
              委托人逾期未付的阶段款
            </p>
          </Card>
        </Link>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-ink-40">
            进行中订单
          </div>
          <div className="mt-2 text-2xl font-semibold text-ink">
            {inProgressCount}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-ink-40">
            托管中资金
          </div>
          <div className="mt-2 text-2xl font-semibold text-ink">
            ¥{" "}
            {orders
              .reduce(
                (sum, o) =>
                  sum +
                  o.stages
                    .filter((s) => s.status === "paid" || s.status === "frozen")
                    .reduce((acc, s) => acc + s.amount, 0),
                0,
              )
              .toLocaleString()}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-ink-40">
            待解冻资金
          </div>
          <div className="mt-2 text-2xl font-semibold text-ink">
            ¥{" "}
            {orders
              .reduce(
                (sum, o) =>
                  sum +
                  o.stages
                    .filter((s) => s.status === "frozen")
                    .reduce((acc, s) => acc + s.amount, 0),
                0,
              )
              .toLocaleString()}
          </div>
        </Card>
      </div>

      {filteredDesigner ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-brand/30 bg-brand/5 p-4">
          <p className="text-sm text-ink">
            正在查看设计师{" "}
            <strong>{filteredDesigner.name}</strong> 的关联订单
          </p>
          <div className="flex flex-wrap gap-2">
            {usersReturnTo ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={usersReturnTo}>返回用户管理</Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link
                href={
                  usersReturnTo
                    ? withReturnTo(`${base}/orders`, usersReturnTo)
                    : `${base}/orders`
                }
              >
                清除筛选
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {filteredClient ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-brand/30 bg-brand/5 p-4">
          <p className="text-sm text-ink">
            正在查看委托人{" "}
            <strong>{filteredClient.name}</strong> 的关联订单
          </p>
          <div className="flex flex-wrap gap-2">
            {usersReturnTo ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={usersReturnTo}>返回委托人列表</Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link
                href={
                  usersReturnTo
                    ? withReturnTo(`${base}/orders`, usersReturnTo)
                    : `${base}/orders`
                }
              >
                清除筛选
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <AdminOrderListToolbar
        query={query}
        statusFilter={statusFilter}
        specialtyFilter={specialtyFilter}
        statusCounts={statusCounts}
        specialtyCounts={specialtyCounts}
        onQueryChange={setQuery}
        onStatusFilterChange={setStatusFilter}
        onSpecialtyFilterChange={setSpecialtyFilter}
        resultCount={filteredOrders.length}
      />

      <div className="space-y-4">
        {loading ? (
          <Card className="p-12 text-center text-ink-60">正在加载订单...</Card>
        ) : filteredOrders.length === 0 ? (
          <Card className="p-12 text-center text-ink-60">
            {orders.length === 0
              ? "暂无订单。"
              : "没有符合当前搜索或筛选条件的订单。"}
          </Card>
        ) : (
          filteredOrders.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              href={
                usersReturnTo
                  ? withReturnTo(`${base}/orders/${o.id}${orderListQuery}`, usersReturnTo)
                  : `${base}/orders/${o.id}${orderListQuery}`
              }
              perspective="client"
              paymentOverdue={getOrderPaymentOverdueInfo(o)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载中…</div>}>
      <AdminOrdersInner />
    </Suspense>
  );
}
