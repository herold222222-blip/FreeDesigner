"use client";



import { Suspense, useMemo } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useOrder, useDesigners } from "@/lib/use-data";
import { AdminAssignDesignerPanel } from "@/components/domain/admin-assign-designer-panel";

import { Card } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { Separator } from "@/components/ui/separator";

import {

  OrderStatusBadge,

  SpecialtyBadge,

} from "@/components/domain/status-badges";

import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import { StageTimeline } from "@/components/domain/stage-timeline";
import { OrderWorkCalendarContentsPanel } from "@/components/domain/order-work-calendar-contents-panel";

import { AdminStageCollaboratorSection } from "@/components/domain/stage-collaborator-panel";

import { OrderTrackAssignmentsPanel } from "@/components/domain/order-track-assignments";

import {

  OrderValueAddedBadges,

  OrderValueAddedServicesPanel,

} from "@/components/domain/order-value-added-services";

import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

import { useConsoleBasePath } from "@/components/layout/console-base-path";
import { AdminConsoleReturnBar } from "@/components/layout/admin-console-return-bar";
import { parseAdminUsersReturnTo, withReturnTo } from "@/lib/admin-return-to";

import { ArrowLeft, Calendar, Clock, MapPin, ShieldAlert } from "lucide-react";

function AdminOrderDetailInner({
  params,
}: {
  params: { id: string };
}) {
  const base = useConsoleBasePath();
  const searchParams = useSearchParams();
  const usersReturnTo = parseAdminUsersReturnTo(searchParams.get("returnTo"));
  const designerIdFilter = searchParams.get("designerId");
  const statusParam = searchParams.get("status");

  const { data: order, loading, refresh } = useOrder(params.id);

  const { data: designers } = useDesigners();

  const getDesignerById = useMemo(

    () => (id: string) => designers.find((d) => d.id === id),

    [designers],

  );



  if (loading) {

    return <div className="py-20 text-center text-ink-60">正在加载订单...</div>;

  }

  if (!order) {

    return <div className="py-20 text-center text-ink-60">未找到该订单。</div>;

  }



  const ordersListQuery = (() => {
    const params = new URLSearchParams();
    if (designerIdFilter) params.set("designerId", designerIdFilter);
    if (statusParam) params.set("status", statusParam);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  })();

  const ordersListHref =
    usersReturnTo
      ? withReturnTo(`${base}/orders${ordersListQuery}`, usersReturnTo)
      : `${base}/orders${ordersListQuery}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {usersReturnTo ? (
          <AdminConsoleReturnBar returnTo={usersReturnTo} />
        ) : null}
        <Link
          href={ordersListHref}
          className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {usersReturnTo ? "返回订单列表" : "返回订单监管"}
        </Link>
      </div>

      <Card className="p-7">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div className="space-y-2">

            <div className="flex flex-wrap items-center gap-2">

              <SpecialtyBadge specialty={order.specialty} />

              <OrderStatusBadge status={order.status} />

              <OrderValueAddedBadges order={order} />

              <Badge variant="muted">管理员视图</Badge>

              <ProjectIdCopy code={order.code} />

            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-ink">

              {order.title}

            </h1>

            <p className="max-w-2xl text-sm text-ink-60">{order.description}</p>

          </div>

          <div className="text-right">

            <div className="text-xs text-ink-60">订单总额</div>

            <div className="text-2xl font-semibold tracking-tight text-ink">

              {formatCurrency(order.totalAmount)}

            </div>

          </div>

        </div>



        <Separator className="my-6" />



        <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">

          <Meta

            label="服务模式"

            value={order.serviceMode === "online" ? "纯线上" : "线下上门"}

            icon={MapPin}

          />

          <Meta

            label="计费模式"

            value={

              order.billingMode === "area"

                ? "常规面积报价"

                : order.billingMode === "daily"

                  ? "按工时"

                  : "按月雇佣"

            }

            icon={Clock}

          />

          <Meta label="项目类型" value={order.projectType} />

          <Meta

            label="预期交付"

            value={formatDate(order.expectedDeliveryAt)}

            icon={Calendar}

          />

        </div>



        {order.onsiteSchedule ? (

          <div className="mt-5 rounded-xl border border-ink-20 bg-ink-20/20 p-4 text-sm">

            <div className="text-xs font-medium uppercase tracking-wider text-ink-40">

              线下上门安排

            </div>

            <div className="mt-2 text-ink">

              {formatDate(order.onsiteSchedule.from)} 至{" "}

              {formatDate(order.onsiteSchedule.to)} · {order.onsiteSchedule.address}

            </div>

          </div>

        ) : null}

      </Card>



      {order.status === "matching" ? (
        <AdminAssignDesignerPanel
          order={order}
          designers={designers}
          onAssigned={refresh}
        />
      ) : null}

      {order.status === "in_revision" && order.revisions.length > 0 ? (

        <Card className="border-violet-200 bg-violet-50 p-5">

          <div className="flex items-start gap-3">

            <ShieldAlert className="mt-0.5 h-5 w-5 text-violet-600" />

            <div className="flex-1">

              <div className="text-sm font-semibold text-violet-900">

                返修进行中

              </div>

              {order.revisions.map((r) => (

                <div key={r.id} className="mt-3 rounded-lg bg-white p-4">

                  <div className="text-xs text-ink-40">

                    {formatDateTime(r.createdAt)}

                  </div>

                  <div className="mt-1 text-sm text-ink">{r.description}</div>

                </div>

              ))}

            </div>

          </div>

        </Card>

      ) : null}



      <OrderTrackAssignmentsPanel

        order={order}

        getDesigner={getDesignerById}

        mode="admin"

      />



      {order.withAuditService || order.withProjectManagement ? (

        <OrderValueAddedServicesPanel order={order} mode="admin" />

      ) : null}



      <AdminStageCollaboratorSection

        order={order}

        getDesigner={getDesignerById}

      />



      <OrderWorkCalendarContentsPanel order={order} perspective="admin" />



      <Card className="p-7">

        <div className="mb-5">

          <h2 className="text-lg font-semibold tracking-tight text-ink">

            付款阶段预览

          </h2>

          <p className="mt-1 text-sm text-ink-60">

            含已确认配合费扣减后的设计师分配；待付款阶段可转发支付链接给委托人扫码支付。

          </p>

        </div>

        <StageTimeline

          order={order}

          perspective="admin"

          getDesigner={getDesignerById}

          collaboratorMode="client"

        />

      </Card>

    </div>

  );
}

export default function AdminOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-ink-60">正在加载订单...</div>
      }
    >
      <AdminOrderDetailInner params={params} />
    </Suspense>
  );
}

function Meta({

  label,

  value,

  icon: Icon,

}: {

  label: string;

  value: string;

  icon?: React.ComponentType<{ className?: string }>;

}) {

  return (

    <div>

      <div className="flex items-center gap-1 text-xs text-ink-40">

        {Icon ? <Icon className="h-3 w-3" /> : null}

        {label}

      </div>

      <div className="mt-1 font-medium text-ink">{value}</div>

    </div>

  );

}


