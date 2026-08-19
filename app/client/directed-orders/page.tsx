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
import { Crosshair } from "lucide-react";

export default function ClientDirectedOrdersPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-ink-60">加载订单列表...</div>}>
      <ClientDirectedOrdersInner />
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

function ClientDirectedOrdersInner() {
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
            {focus ? CLIENT_ORDER_FOCUS_META[focus].label : "定向下单"}
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            {focus
              ? CLIENT_ORDER_FOCUS_META[focus].description
              : "指定设计师发起的委托项目，含定向下单与扫码下单，可按类型与状态筛选。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {focus ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/client/directed-orders">查看全部定向下单</Link>
            </Button>
          ) : null}
          <Button asChild variant="brand">
            <Link href="/designers">
              <Crosshair className="h-4 w-4" /> 挑选设计师下单
            </Link>
          </Button>
        </div>
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
        directedOrdersOnly
        initialFocus={focus}
        emptyLabel={
          focus ? "该分类下暂无相关定向下单。" : "暂无定向下单项目。"
        }
      />
    </div>
  );
}
