"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useOrder, useClient, useDesigners } from "@/lib/use-data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import {
  OrderStatusBadge,
  SpecialtyBadge,
} from "@/components/domain/status-badges";
import { StageTimeline } from "@/components/domain/stage-timeline";
import { OrderWorkCalendarContentsPanel } from "@/components/domain/order-work-calendar-contents-panel";
import { DesignerOrderScopePanel } from "@/components/domain/designer-order-scope-panel";
import { sumDesignerOrderNetEarnings } from "@/lib/designer-order-scope";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileSignature,
  MapPin,
  MessageSquare,
  Send,
  ShieldAlert,
  Sparkles,
  Upload,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";
import {
  acceptOrderRequest,
  designerSignOrderRequest,
  submitStageDeliverablesRequest,
  requestProjectSettlementRequest,
} from "@/lib/api-client";
import { needsDesignerSign } from "@/lib/order-lifecycle";
import { DisputeFilingDialog } from "@/components/domain/dispute-filing-dialog";
import { useState } from "react";

export default function DesignerOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: order, loading, refresh } = useOrder(params.id);
  const { data: client } = useClient(order?.clientId);
  const { data: designers } = useDesigners();
  const getDesigner = useMemo(
    () => (id: string) => designers.find((d) => d.id === id),
    [designers],
  );
  const push = useSessionStore((s) => s.pushNotification);
  const identityId = useRoleStore((s) => s.identityId);
  const currentDesignerId = identityId || order?.designerId || "";
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const runAction = async (
    fn: () => Promise<unknown>,
    successTitle: string,
    successDescription?: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      push({
        title: successTitle,
        description: successDescription,
        variant: "success",
      });
      refresh();
    } catch (e) {
      push({
        title: "操作失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = () =>
    runAction(
      () => acceptOrderRequest(order!.id),
      "已确认档期",
      "等待双方签约并支付预付款。",
    );

  if (loading) {
    return (
      <div className="py-20 text-center text-ink-60">正在加载项目详情...</div>
    );
  }
  if (!order) {
    return (
      <div className="py-20 text-center text-ink-60">未找到该项目或无权访问。</div>
    );
  }

  const myNetEarnings = currentDesignerId
    ? sumDesignerOrderNetEarnings(order, currentDesignerId)
    : 0;
  const feePct = Math.round((order.feeRate ?? 0.08) * 100);

  return (
    <div className="space-y-6">
      <Link
        href="/designer/orders"
        className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回我的项目
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SpecialtyBadge specialty={order.specialty} />
                  <OrderStatusBadge status={order.status} />
                  <ProjectIdCopy code={order.code} />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-ink">
                  {order.title}
                </h1>
                <p className="max-w-2xl text-sm text-ink-60">
                  {order.description}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-ink-60">我的预计实收</div>
                <div className="text-2xl font-semibold tracking-tight text-ink">
                  {formatCurrency(myNetEarnings)}
                </div>
                <div className="mt-1 text-xs text-emerald-700">
                  仅含本专业相关阶段 · 已扣 {feePct}% 平台费
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
              <Field label="服务模式" value={order.serviceMode === "online" ? "纯线上" : "线下上门"} icon={MapPin} />
              <Field
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
              <Field label="项目类型" value={order.projectType} />
              <Field label="预期交付" value={formatDate(order.expectedDeliveryAt)} icon={Calendar} />
            </div>
          </Card>

          {order.status === "in_revision" && order.revisions.length > 0 ? (
            <Card className="border-violet-200 bg-violet-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-violet-600" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-violet-900">
                    委托人提交了返修需求 · 请尽快响应
                  </div>
                  {order.revisions.map((r) => (
                    <div key={r.id} className="mt-3 rounded-lg bg-white p-4">
                      <div className="text-xs text-ink-40">
                        {formatDateTime(r.createdAt)}
                      </div>
                      <div className="mt-1 text-sm text-ink">
                        {r.description}
                      </div>
                      {r.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.attachments.map((a, i) => (
                            <Badge key={i} variant="muted">
                              📎 {a.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="brand"
                          disabled={busy}
                          onClick={() =>
                            runAction(
                              () =>
                                submitStageDeliverablesRequest(
                                  order.id,
                                  r.stageId,
                                ),
                              "返修成果已上传",
                              "委托人将收到验收提醒。",
                            )
                          }
                        >
                          <Upload className="h-3.5 w-3.5" /> 上传返修方案
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}

          {currentDesignerId ? (
            <DesignerOrderScopePanel
              order={order}
              designerId={currentDesignerId}
              getDesigner={getDesigner}
            />
          ) : null}

          <OrderWorkCalendarContentsPanel order={order} perspective="designer" />

          <Card className="p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  本专业付款阶段
                </h2>
                <p className="mt-1 text-sm text-ink-60">
                  仅展示与你相关的阶段款项与成果 · 委托方已支付后可至钱包申请提现。
                </p>
              </div>
            </div>
            <StageTimeline
              order={order}
              perspective="designer"
              getDesigner={getDesigner}
              collaboratorMode="designer"
              currentDesignerId={currentDesignerId}
              onUploadDeliverables={(stage) =>
                runAction(
                  () =>
                    submitStageDeliverablesRequest(order.id, stage.id),
                  "本阶段成果已上传",
                  "委托人可预览并付款解锁下载。",
                )
              }
            />
          </Card>

          <Card className="p-7">
            <div className="mb-5 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-ink-60" />
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                沟通记录
              </h2>
            </div>
            <div className="space-y-3">
              {order.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl p-4 text-sm ${
                    m.authorRole === "system"
                      ? "border border-dashed border-ink-20 text-ink-60"
                      : m.authorRole === "designer"
                        ? "ml-auto max-w-md bg-ink text-white"
                        : "max-w-md bg-ink-20/30 text-ink"
                  }`}
                >
                  <div
                    className={`mb-1 flex items-center gap-2 text-xs ${m.authorRole === "designer" ? "text-white/60" : "text-ink-40"}`}
                  >
                    <span className="font-medium">
                      {m.authorRole === "system"
                        ? "系统"
                        : m.authorRole === "designer"
                          ? "我"
                          : client?.name}
                    </span>
                    <span>· {formatDateTime(m.createdAt)}</span>
                  </div>
                  {m.content}
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                placeholder="输入消息与委托人沟通..."
                className="flex h-11 w-full rounded-xl border border-ink-20 bg-white px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
              />
              <Button>
                <Send className="h-4 w-4" /> 发送
              </Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              对接委托人
            </div>
            {client ? (
              <div className="mt-3 flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={client.avatar} alt={client.name} />
                  <AvatarFallback>{client.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-ink">
                    {client.name}
                    {client.verified && client.type === "enterprise" && (
                      <Badge variant="brand" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> 企业认证
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-ink-60">
                    {client.type === "enterprise" ? client.companyName : "个人委托人"}
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              电子合同
            </div>
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-ink-20 p-3">
              <FileSignature className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="text-sm font-medium text-ink">
                  {order.contractId || "尚未生成"}
                </div>
                <div className="text-xs text-ink-60">已签署 · 永久存档</div>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href={`/contracts/${order.contractId || "preview"}`}>在线查阅合同</Link>
            </Button>
          </Card>

          {["in_progress", "in_revision", "pending_review"].includes(
            order.status,
          ) && (
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wider text-ink-40">
                纠纷与申诉
              </div>
              <p className="mt-2 text-xs text-ink-60">
                若委托人长期未付款或未响应，可申请平台介入。
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setDisputeOpen(true)}
              >
                <ShieldAlert className="h-3.5 w-3.5" /> 申请平台介入
              </Button>
            </Card>
          )}

          {(order.status === "pending_schedule" ||
            needsDesignerSign(order) ||
            order.pendingSettlement) && (
            <Card className="space-y-3 p-5">
              <div className="text-xs uppercase tracking-wider text-ink-40">
                待办操作
              </div>
              {order.status === "pending_schedule" && (
                <>
                  <p className="text-xs text-ink-60">
                    委托人已提交档期申请，确认后双方可签约并支付预付款。
                  </p>
                  <Button
                    variant="brand"
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={handleAccept}
                  >
                    {busy ? "处理中..." : "确认接单档期"}
                  </Button>
                </>
              )}
              {needsDesignerSign(order) && (
                <Button
                  variant="brand"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => designerSignOrderRequest(order.id),
                      "合同已签署",
                      "请等待委托人签约并支付预付款。",
                    )
                  }
                >
                  签署电子合同
                </Button>
              )}
              {order.pendingSettlement && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => requestProjectSettlementRequest(order.id),
                      "已申请项目结算",
                      "请等待委托人确认最终服务完成。",
                    )
                  }
                >
                  申请项目结算
                </Button>
              )}
            </Card>
          )}

          <Card className="space-y-2 p-5 text-xs text-ink-60">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              每笔款项进入 30 天托管期,验收无误自动解冻可提现。
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              超过 30 天委托人无异议,系统自动确认成果无误。
            </div>
          </Card>
        </aside>
      </div>

      {order ? (
        <DisputeFilingDialog
          open={disputeOpen}
          onOpenChange={setDisputeOpen}
          order={order}
          onFiled={() => {
            push({
              title: "纠纷申请已提交",
              description: "平台管理员将尽快受理。",
              variant: "success",
            });
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Field({
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
      <div className="text-xs text-ink-40">{label}</div>
      <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink">
        {Icon ? <Icon className="h-3.5 w-3.5 text-ink-60" /> : null}
        {value}
      </div>
    </div>
  );
}
