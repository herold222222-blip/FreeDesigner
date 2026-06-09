"use client";

import Link from "next/link";
import type { Designer, PaymentStage, StageDesignerPaymentSplit } from "@/lib/types";
import type { ServiceProvider } from "@/mocks/service-providers";
import {
  stageHasAuditorSplits,
  stageHasCollaboratorSplits,
  stageHasProjectManagerSplits,
  stageHasReplacementSplits,
} from "@/lib/stage-payment-splits";
import { DesignerName } from "@/components/domain/designer-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { FileSearch, ShieldCheck, Split, UserCog, Users } from "lucide-react";

export function StagePaymentSplitsPanel({
  stage,
  splits,
  getDesigner,
  getServiceProvider,
}: {
  stage: PaymentStage;
  splits: StageDesignerPaymentSplit[];
  getDesigner: (id: string) => Designer | undefined;
  getServiceProvider?: (id: string) => ServiceProvider | undefined;
}) {
  if (!splits.length) return null;

  const splitTotal = splits.reduce((s, x) => s + x.orderRatio, 0);
  const hasReplacement = stageHasReplacementSplits(splits);
  const hasCollaborator = stageHasCollaboratorSplits(splits);
  const hasAuditor = stageHasAuditorSplits(splits);
  const hasPm = stageHasProjectManagerSplits(splits);
  const hasValueAdded = hasAuditor || hasPm;

  return (
    <div
      className={cn(
        "border-t border-ink-20 p-5",
        hasReplacement ? "bg-amber-50/40"
        : hasCollaborator ? "bg-violet-50/30"
        : hasValueAdded ? "bg-slate-50/90"
        : "bg-slate-50/80",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {hasReplacement ?
          <Split className="h-4 w-4 text-amber-700" />
        : hasCollaborator ?
          <Users className="h-4 w-4 text-violet-700" />
        : hasValueAdded ?
          <Users className="h-4 w-4 text-slate-600" />
        : <Users className="h-4 w-4 text-slate-600" />}
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            hasReplacement ? "text-amber-900"
            : hasCollaborator ? "text-violet-900"
            : "text-slate-800",
          )}
        >
          {hasValueAdded ?
            "本阶段 · 费用分配"
          : "本阶段 · 各专业设计师费用分配"}
        </span>
        {hasReplacement ?
          <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-800">
            含历史设计师拆分
          </Badge>
        : null}
        {hasCollaborator ?
          <Badge variant="outline" className="border-violet-300 text-[10px] text-violet-800">
            含配合设计师工时费
          </Badge>
        : null}
        {hasAuditor ?
          <Badge variant="outline" className="border-amber-300 text-[10px] text-amber-800">
            含审图师
          </Badge>
        : null}
        {hasPm ?
          <Badge variant="outline" className="border-indigo-300 text-[10px] text-indigo-800">
            含项目管理员
          </Badge>
        : null}
      </div>

      <div
        className={cn(
          "mb-3 rounded-lg border px-3 py-2 text-[11px]",
          hasReplacement ?
            "border-amber-200/80 bg-white/80 text-amber-900"
          : hasCollaborator ?
            "border-violet-200/80 bg-white/80 text-violet-900"
          : "border-slate-200 bg-white text-slate-700",
        )}
      >
        本阶段合同占比{" "}
        <span className="font-semibold">{formatPercent(stage.ratio)}%</span>
        （{formatCurrency(stage.amount)}），按下方比例结算至各服务方。
        {hasReplacement ?
          " 已支付款项不变，历史设计师按服务贡献保留对应份额。"
        : null}
        {hasCollaborator ?
          " 已确认配合费从原设计师份额中扣减后另行结算给配合方。"
        : null}
        {hasAuditor ?
          " 审图师按专业分别结算本阶段审图份额。"
        : null}
        {hasPm ? " 项目管理员按整体协调服务结算本阶段份额。" : null}
      </div>

      <PaymentSplitsList
        splits={splits}
        stageRatio={stage.ratio}
        getDesigner={getDesigner}
        getServiceProvider={getServiceProvider}
      />

      <div
        className={cn(
          "mt-3 flex items-center justify-between border-t border-dashed pt-2 text-xs",
          hasReplacement ? "border-amber-200/80 text-amber-900/80" : "border-slate-200 text-slate-600",
        )}
      >
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          拆分合计占订单 {formatPercent(splitTotal)}%
        </span>
        <span className="font-medium tabular-nums">
          {formatCurrency(splits.reduce((s, x) => s + x.amount, 0))}
        </span>
      </div>
    </div>
  );
}

export function PaymentSplitsList({
  splits,
  stageRatio,
  getDesigner,
  getServiceProvider,
}: {
  splits: StageDesignerPaymentSplit[];
  stageRatio?: number;
  getDesigner: (id: string) => Designer | undefined;
  getServiceProvider?: (id: string) => ServiceProvider | undefined;
}) {
  return (
    <div className="space-y-2">
      {splits.map((split, idx) => (
        <SplitRow
          key={`${split.designerId ?? split.serviceProviderId}-${split.trackAssignmentId ?? idx}-${idx}`}
          split={split}
          stageRatio={stageRatio}
          getDesigner={getDesigner}
          getServiceProvider={getServiceProvider}
        />
      ))}
    </div>
  );
}

function SplitRow({
  split,
  stageRatio,
  getDesigner,
  getServiceProvider,
}: {
  split: StageDesignerPaymentSplit;
  stageRatio?: number;
  getDesigner: (id: string) => Designer | undefined;
  getServiceProvider?: (id: string) => ServiceProvider | undefined;
}) {
  const designer = split.designerId ? getDesigner(split.designerId) : undefined;
  const provider =
    split.serviceProviderId && getServiceProvider ?
      getServiceProvider(split.serviceProviderId)
    : undefined;
  const withinStagePct =
    stageRatio && stageRatio > 0 ?
      formatPercent(split.orderRatio / stageRatio)
    : null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5",
        split.fromReplacement || split.role === "previous" ?
          "border-ink-20 bg-white/90"
        : split.role === "current" ?
          "border-brand/30 bg-brand/5"
        : split.role === "collaborator" ?
          "border-violet-300/80 bg-violet-50/60"
        : split.role === "auditor" ?
          "border-amber-300/80 bg-amber-50/50"
        : split.role === "project_manager" ?
          "border-indigo-300/80 bg-indigo-50/50"
        : "border-ink-20 bg-white",
      )}
    >
      {designer ? (
        <Link href={`/designers/${designer.id}`} className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={designer.avatar} alt={designer.name} />
            <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-ink hover:text-brand">
            <DesignerName designer={designer} />
          </span>
        </Link>
      ) : provider ? (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={provider.avatar} alt={provider.name} />
            <AvatarFallback>{provider.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-ink">{provider.name}</span>
        </div>
      ) : (
        <span className="text-sm text-ink-60">服务方不可用</span>
      )}

      <div className="min-w-0 flex-1 text-xs text-ink-60">{split.label}</div>

      <div className="text-right">
        <div className="text-sm font-semibold tabular-nums text-ink">
          占订单 {formatPercent(split.orderRatio)}%
          {withinStagePct ?
            <span className="ml-1 text-[11px] font-normal text-ink-60">
              · 本阶段 {withinStagePct}%
            </span>
          : null}
        </div>
        <div className="text-[11px] tabular-nums text-ink-60">
          {formatCurrency(split.amount)}
        </div>
      </div>

      {split.role === "previous" ?
        <Badge variant="muted" className="shrink-0 text-[10px]">
          历史设计师
        </Badge>
      : split.role === "current" ?
        <Badge variant="brand" className="shrink-0 text-[10px]">
          现任设计师
        </Badge>
      : split.role === "collaborator" ?
        <Badge
          variant="outline"
          className="shrink-0 border-violet-300 text-[10px] text-violet-800"
        >
          配合设计师
        </Badge>
      : split.role === "auditor" ?
        <Badge
          variant="outline"
          className="shrink-0 border-amber-300 text-[10px] text-amber-800"
        >
          <FileSearch className="mr-0.5 h-3 w-3" />
          审图师
        </Badge>
      : split.role === "project_manager" ?
        <Badge
          variant="outline"
          className="shrink-0 border-indigo-300 text-[10px] text-indigo-800"
        >
          <UserCog className="mr-0.5 h-3 w-3" />
          项目管理员
        </Badge>
      : null}
    </div>
  );
}
