"use client";

import { useEffect, useRef, useState } from "react";
import type { Order, OrderAuditAssignment } from "@/lib/types";
import { resolveTrackLabels } from "@/lib/constants";
import {
  getServiceProviderById,
  serviceProviders,
  type ServiceProvider,
} from "@/mocks/service-providers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DeliverableFileList } from "@/components/domain/deliverable-file-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useSessionStore } from "@/store/session-store";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  RefreshCw,
  UserCog,
} from "lucide-react";

const STATUS_META = {
  serving: { label: "服务中", tone: "bg-brand/10 text-brand" },
  completed: { label: "已完成", tone: "bg-emerald-100 text-emerald-800" },
  pending_match: { label: "待匹配", tone: "bg-amber-100 text-amber-800" },
} as const;

function getDeliverablesForIds(
  order: Order,
  stageId: string,
  deliverableIds?: string[],
) {
  if (!deliverableIds?.length) return [];
  const stage = order.stages.find((s) => s.id === stageId);
  return stage?.deliverables?.filter((d) => deliverableIds.includes(d.id)) ?? [];
}

export function OrderValueAddedServicesPanel({
  order,
  mode = "client",
}: {
  order: Order;
  mode?: "client" | "admin";
}) {
  const audits = order.auditAssignments ?? [];
  const pm = order.projectManagement;
  if (!order.withAuditService && !order.withProjectManagement) return null;
  if (audits.length === 0 && !pm) return null;

  const drawingBase = Math.round(order.totalAmount / 1.28);
  const auditFee = order.withAuditService ? Math.round(drawingBase * 0.08) : 0;
  const pmFee = order.withProjectManagement ? Math.round(drawingBase * 0.2) : 0;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-20 px-7 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            增值服务 · 审图与项目管理
          </h2>
          {order.withAuditService ?
            <Badge variant="outline" className="border-amber-300 text-amber-800">
              第三方审图
            </Badge>
          : null}
          {order.withProjectManagement ?
            <Badge variant="outline" className="border-violet-300 text-violet-800">
              施工图项目管理
            </Badge>
          : null}
        </div>
        <p className="mt-1 text-sm text-ink-60">
          {mode === "admin"
            ? "审图师按三级专业审核成果；项目管理员统筹进度。管理员可点击头像更换服务人员。"
            : "审图师按三级专业分别审核设计师成果；项目管理员统筹整体施工图对外沟通与进度协调。"}
        </p>
        {(auditFee > 0 || pmFee > 0) && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-60">
            <span>
              出图费约 <strong className="text-ink">{formatCurrency(drawingBase)}</strong>
            </span>
            {auditFee > 0 ?
              <span>
                审图费 +8% · <strong className="text-amber-800">{formatCurrency(auditFee)}</strong>
              </span>
            : null}
            {pmFee > 0 ?
              <span>
                项目管理 +20% ·{" "}
                <strong className="text-violet-800">{formatCurrency(pmFee)}</strong>
              </span>
            : null}
          </div>
        )}
      </div>

      {audits.length > 0 ? (
        <div className="border-b border-ink-20 px-7 py-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
            <FileSearch className="h-4 w-4" />
            审图师 · 按三级专业
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {audits.map((audit) => (
              <AuditAssignmentCard
                key={audit.id}
                order={order}
                audit={audit}
                mode={mode}
              />
            ))}
          </div>
        </div>
      ) : null}

      {pm ? (
        <div className="px-7 py-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-900">
            <UserCog className="h-4 w-4" />
            施工图项目管理员 · 整体服务
          </div>
          <ProjectManagerCard order={order} pm={pm} mode={mode} />
        </div>
      ) : null}
    </Card>
  );
}

function AuditAssignmentCard({
  order,
  audit,
  mode = "client",
}: {
  order: Order;
  audit: OrderAuditAssignment;
  mode?: "client" | "admin";
}) {
  const labels = resolveTrackLabels(audit.l1, audit.l2, audit.l3);
  const auditor = getServiceProviderById(audit.auditorId);
  const meta = STATUS_META[audit.status];
  const deliverables = getDeliverablesForIds(
    order,
    audit.stageId,
    audit.deliverableIds,
  );
  const designTrack = order.trackAssignments?.find(
    (a) => a.id === audit.trackAssignmentId,
  );

  return (
    <div className="rounded-2xl border border-amber-200/60 bg-amber-50/30 p-4">
      <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px] text-ink-60">
        <span className="font-medium text-ink">{labels.l1Label}</span>
        <ChevronRight className="h-3 w-3" />
        <span>{labels.l2Label}</span>
        <ChevronRight className="h-3 w-3" />
        <span>{labels.l3Label}</span>
      </div>

      {auditor ? (
        <div className="flex items-start gap-3">
          <ServiceProviderAvatarMenu
            provider={auditor}
            mode={mode}
            replaceLabel="更换审图师"
            roleFilter="auditor"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">{auditor.name}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", meta.tone)}>
                {meta.label}
              </span>
            </div>
            <div className="text-xs text-amber-900/80">{auditor.title}</div>
            {auditor.credential ?
              <div className="mt-0.5 text-[11px] text-ink-60">{auditor.credential}</div>
            : null}
          </div>
        </div>
      ) : null}

      {designTrack ? (
        <div className="mt-2 text-[11px] text-ink-60">
          审图对象：对应设计专业 ·{" "}
          {resolveTrackLabels(designTrack.l1, designTrack.l2, designTrack.l3).l3Label}
        </div>
      ) : null}

      {deliverables.length > 0 ? (
        <div className="mt-3 border-t border-dashed border-amber-200/80 pt-3">
          <div className="mb-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-amber-800/80">
            <ClipboardCheck className="h-3 w-3" />
            审图成果
          </div>
          <DeliverableFileList files={deliverables} compact unlocked />
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-ink-40">设计师提交后将出具审图意见</div>
      )}
    </div>
  );
}

function ProjectManagerCard({
  order,
  pm,
  mode = "client",
}: {
  order: Order;
  pm: NonNullable<Order["projectManagement"]>;
  mode?: "client" | "admin";
}) {
  const manager = getServiceProviderById(pm.projectManagerId);
  const meta = STATUS_META[pm.status];
  const deliverables = getDeliverablesForIds(
    order,
    pm.stageId,
    pm.deliverableIds,
  );

  return (
    <div className="rounded-2xl border border-violet-200/60 bg-violet-50/30 p-5">
      {manager ? (
        <div className="flex items-start gap-3">
          <ServiceProviderAvatarMenu
            provider={manager}
            mode={mode}
            replaceLabel="更换项目管理员"
            roleFilter="project_manager"
            size="lg"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-ink">{manager.name}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", meta.tone)}>
                {meta.label}
              </span>
            </div>
            <div className="text-sm text-violet-900/90">{manager.title}</div>
            {manager.credential ?
              <div className="mt-0.5 text-xs text-ink-60">{manager.credential}</div>
            : null}
          </div>
        </div>
      ) : null}

      <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm text-ink-60">
        {pm.scope}
      </p>

      {deliverables.length > 0 ? (
        <div className="mt-4 border-t border-dashed border-violet-200/80 pt-3">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-violet-800/80">
            项目管理成果
          </div>
          <DeliverableFileList files={deliverables} compact unlocked />
        </div>
      ) : null}
    </div>
  );
}

function ServiceProviderAvatarMenu({
  provider,
  mode,
  replaceLabel,
  roleFilter,
  size = "md",
}: {
  provider: ServiceProvider;
  mode: "client" | "admin";
  replaceLabel: string;
  roleFilter: ServiceProvider["role"];
  size?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [nextId, setNextId] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const push = useSessionStore((s) => s.pushNotification);
  const dim = size === "lg" ? "h-11 w-11" : "h-10 w-10";
  const ring =
    roleFilter === "auditor" ? "ring-amber-200/80" : "ring-violet-200/80";

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const avatar = (
    <Avatar className={cn(dim, "ring-2", ring)}>
      <AvatarImage src={provider.avatar} alt={provider.name} />
      <AvatarFallback>{provider.name.slice(0, 1)}</AvatarFallback>
    </Avatar>
  );

  if (mode !== "admin") {
    return avatar;
  }

  const candidates = serviceProviders.filter(
    (p) => p.role === roleFilter && p.id !== provider.id,
  );

  return (
    <>
      <div ref={wrapRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full ring-offset-2 transition-shadow hover:ring-2 hover:ring-brand/40"
          title={`${provider.name} · 点击管理`}
        >
          {avatar}
        </button>
        {open ? (
          <div className="absolute left-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-ink-20 bg-white py-1 shadow-xl">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink hover:bg-ink-20/40"
              onClick={() => {
                setOpen(false);
                setReplaceOpen(true);
              }}
            >
              <RefreshCw className="h-4 w-4 text-ink-60" />
              {replaceLabel}
            </button>
          </div>
        ) : null}
      </div>

      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{replaceLabel}</DialogTitle>
            <DialogDescription>
              将「{provider.name}」更换为其他
              {roleFilter === "auditor" ? "审图师" : "项目管理员"}。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>新任服务人员</Label>
            <select
              className="flex h-10 w-full rounded-md border border-ink-20 bg-background px-3 text-sm"
              value={nextId}
              onChange={(e) => setNextId(e.target.value)}
            >
              <option value="">请选择</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.title}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceOpen(false)}>
              取消
            </Button>
            <Button
              variant="brand"
              onClick={() => {
                const next = candidates.find((p) => p.id === nextId);
                if (!next) {
                  push({ title: "请选择新任服务人员", variant: "destructive" });
                  return;
                }
                setReplaceOpen(false);
                setNextId("");
                push({
                  title: `${replaceLabel}成功`,
                  description: `「${provider.name}」→「${next.name}」`,
                  variant: "success",
                });
              }}
            >
              确认更换
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OrderValueAddedBadges({ order }: { order: Order }) {
  if (!order.withAuditService && !order.withProjectManagement) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.withAuditService ?
        <Badge variant="outline" className="border-amber-300 text-amber-800">
          含第三方审图
        </Badge>
      : null}
      {order.withProjectManagement ?
        <Badge variant="outline" className="border-violet-300 text-violet-800">
          含施工图项目管理
        </Badge>
      : null}
    </div>
  );
}
