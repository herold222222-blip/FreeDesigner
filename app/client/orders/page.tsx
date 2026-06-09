"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CLIENT_ORDER_FOCUS_META } from "@/lib/client-order-focus";
import { ScheduleRequestPanel } from "@/components/domain/schedule-request-panel";
import { UnifiedProjectList } from "@/components/domain/unified-project-list";
import { useScheduleRequests } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import type { ClientOrderFocus } from "@/lib/client-order-focus";

export default function ClientOrdersPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-ink-60">加载订单列表...</div>}>
      <ClientOrdersInner />
    </Suspense>
  );
}

const FOCUS_VALUES = [
  "pending_payment",
  "pending_acceptance",
  "pending_contract",
  "after_sales",
] as const;

function parseFocusParam(value: string | null): ClientOrderFocus | null {
  if (!value) return null;
  return FOCUS_VALUES.includes(value as ClientOrderFocus)
    ? (value as ClientOrderFocus)
    : null;
}

function ClientOrdersInner() {
  const params = useSearchParams();
  const focus = parseFocusParam(params.get("focus"));
  const identityId = useRoleStore((s) => s.identityId);
  const clientId = identityId ?? "";
  const { data: scheduleRequests, refresh: refreshSchedule } =
    useScheduleRequests();

  const myScheduleRequests = scheduleRequests.filter(
    (r) =>
      r.clientId === clientId &&
      (r.status === "pending" ||
        r.status === "accepted" ||
        r.status === "rejected"),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            {focus ? CLIENT_ORDER_FOCUS_META[focus].label : "平台订单"}
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            {focus
              ? CLIENT_ORDER_FOCUS_META[focus].description
              : "定向下单、扫码下单、按工时/按月等常规委托项目，可按类型与状态筛选。"}
          </p>
        </div>
        {focus ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/client/orders">查看全部平台订单</Link>
          </Button>
        ) : null}
      </div>

      {myScheduleRequests.length > 0 ? (
        <ScheduleRequestPanel
          requests={myScheduleRequests}
          perspective="client"
          onUpdated={refreshSchedule}
        />
      ) : null}

      <UnifiedProjectList
        perspective="client"
        identityId={clientId}
        platformOrdersOnly
        initialFocus={focus}
        emptyLabel={
          focus
            ? "该分类下暂无相关订单。"
            : "暂无平台订单，可切换「全部」查看各类型。"
        }
      />
    </div>
  );
}
