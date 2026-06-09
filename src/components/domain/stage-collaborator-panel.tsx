"use client";

import { useMemo, useState } from "react";
import type {
  Designer,
  Order,
  PaymentStage,
  StageCollaboratorService,
} from "@/lib/types";
import {
  COLLABORATOR_STATUS_META,
  calcCollaboratorFee,
  getMergedStageCollaborators,
} from "@/lib/stage-collaborator";
import { getDesignerTrackIds } from "@/lib/designer-order-scope";
import { resolveTrackLabels } from "@/lib/constants";
import { designers } from "@/mocks/designers";
import { useCollaboratorStore } from "@/store/collaborator-store";
import { useSessionStore } from "@/store/session-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock,
  Plus,
  UserPlus,
  X,
} from "lucide-react";

export function StageCollaboratorPanel({
  order,
  stage,
  getDesigner,
  mode,
  currentDesignerId,
}: {
  order: Order;
  stage: PaymentStage;
  getDesigner: (id: string) => Designer | undefined;
  mode: "admin" | "client" | "designer";
  /** designer 模式下当前登录设计师 id */
  currentDesignerId?: string;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const runtimeServices = useCollaboratorStore((s) => s.services);
  const [addOpen, setAddOpen] = useState(false);

  const services = useMemo(() => {
    const all = getMergedStageCollaborators(order, stage.id);
    if (mode !== "designer" || !currentDesignerId) return all;
    const myTrackIds = getDesignerTrackIds(order, currentDesignerId);
    return all.filter(
      (s) =>
        s.primaryDesignerId === currentDesignerId ||
        s.collaboratorDesignerId === currentDesignerId ||
        (s.trackAssignmentId && myTrackIds.has(s.trackAssignmentId)),
    );
  }, [order, stage.id, runtimeServices, mode, currentDesignerId]);

  if (services.length === 0 && mode !== "admin") return null;

  return (
    <div className="border-t border-ink-20 bg-violet-50/30 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-violet-700" />
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-900">
            配合设计师服务
          </span>
        </div>
        {mode === "admin" ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-violet-200 text-violet-900 hover:bg-violet-100"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            增加配合设计师
          </Button>
        ) : null}
      </div>

      {services.length === 0 ? (
        <p className="text-xs text-violet-800/70">
          本阶段暂无配合设计师记录。管理员可登记临时配合修改的工时服务。
        </p>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <CollaboratorServiceCard
              key={service.id}
              service={service}
              order={order}
              stage={stage}
              getDesigner={getDesigner}
              mode={mode}
              currentDesignerId={currentDesignerId}
              onNotify={push}
            />
          ))}
        </div>
      )}

      {mode === "admin" ? (
        <AddCollaboratorDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          order={order}
          stage={stage}
          getDesigner={getDesigner}
          onNotify={push}
        />
      ) : null}
    </div>
  );
}

function CollaboratorServiceCard({
  service,
  order,
  stage,
  getDesigner,
  mode,
  currentDesignerId,
  onNotify,
}: {
  service: StageCollaboratorService;
  order: Order;
  stage: PaymentStage;
  getDesigner: (id: string) => Designer | undefined;
  mode: "admin" | "client" | "designer";
  currentDesignerId?: string;
  onNotify: ReturnType<typeof useSessionStore.getState>["pushNotification"];
}) {
  const updateService = useCollaboratorStore((s) => s.updateService);
  const ensureService = useCollaboratorStore((s) => s.ensureService);
  const meta = COLLABORATOR_STATUS_META[service.status];
  const primary = getDesigner(service.primaryDesignerId);
  const collaborator = getDesigner(service.collaboratorDesignerId);
  const assignment = order.trackAssignments?.find(
    (a) => a.id === service.trackAssignmentId,
  );
  const trackLabel =
    assignment ?
      resolveTrackLabels(assignment.l1, assignment.l2, assignment.l3).l3Label
    : "本阶段";

  const isPrimaryDesigner =
    mode === "designer" && currentDesignerId === service.primaryDesignerId;
  const isCollaboratorDesigner =
    mode === "designer" &&
    currentDesignerId === service.collaboratorDesignerId;

  const patchService = (patch: Partial<StageCollaboratorService>) => {
    ensureService(service);
    updateService(service.id, patch);
  };

  const submitConfirm = () => {
    patchService({
      status: "pending_confirm",
      submittedAt: new Date().toISOString(),
    });
    onNotify({
      title: "配合确认单已提交",
      description: `等待 ${primary?.name ?? "原设计师"} 确认 ¥${service.totalFee} 配合费。`,
      variant: "success",
    });
  };

  const confirmService = () => {
    patchService({
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      confirmedByDesignerId: service.primaryDesignerId,
    });
    onNotify({
      title: "配合费已确认生效",
      description: `${collaborator?.name ?? "配合设计师"} ¥${service.totalFee} 将从本阶段 ${primary?.name ?? "原设计师"} 份额中扣除。`,
      variant: "success",
    });
  };

  const rejectService = () => {
    patchService({
      status: "rejected",
      rejectedAt: new Date().toISOString(),
      rejectReason: "原设计师驳回了本次配合费",
    });
    onNotify({
      title: "配合费确认单已驳回",
      variant: "destructive",
    });
  };

  return (
    <div className="rounded-xl border border-violet-200/80 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {collaborator ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={collaborator.avatar} alt={collaborator.name} />
                <AvatarFallback>{collaborator.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium text-ink">
                  {collaborator.name}
                  <span className="ml-1.5 text-xs font-normal text-ink-60">
                    配合 · {trackLabel}
                  </span>
                </div>
                <div className="text-[11px] text-ink-60">
                  协助 {primary?.name ?? "原设计师"}
                </div>
              </div>
            </div>
          ) : null}
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", meta.tone)}>
            {meta.label}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums text-ink">
            {formatCurrency(service.totalFee)}
          </div>
          <div className="text-[11px] text-ink-60">
            {service.workDays} 天 × {formatCurrency(service.dailyRate)}/天
          </div>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-violet-900/80">{meta.description}</p>

      {service.description ? (
        <p className="mt-2 rounded-lg bg-violet-50/50 px-2.5 py-2 text-xs text-ink-60">
          {service.description}
        </p>
      ) : null}

      {service.status === "confirmed" ? (
        <div className="mt-2 text-[11px] text-emerald-700">
          <Clock className="mr-1 inline h-3 w-3" />
          已于 {formatDateTime(service.confirmedAt!)} 确认生效 · 从 {primary?.name}{" "}
          本阶段份额中扣除 {formatCurrency(service.totalFee)}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {service.status === "in_progress" &&
        (mode === "admin" || isCollaboratorDesigner) ? (
          <Button size="sm" variant="brand" onClick={submitConfirm}>
            发起确认单
          </Button>
        ) : null}

        {service.status === "pending_confirm" &&
        (mode === "admin" || isPrimaryDesigner) ? (
          <>
            <Button size="sm" variant="brand" className="gap-1" onClick={confirmService}>
              <Check className="h-3.5 w-3.5" />
              确认配合费
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={rejectService}>
              <X className="h-3.5 w-3.5" />
              驳回
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function AddCollaboratorDialog({
  open,
  onOpenChange,
  order,
  stage,
  getDesigner,
  onNotify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  stage: PaymentStage;
  getDesigner: (id: string) => Designer | undefined;
  onNotify: ReturnType<typeof useSessionStore.getState>["pushNotification"];
}) {
  const addService = useCollaboratorStore((s) => s.addService);
  const assignments =
    order.trackAssignments?.filter((a) => a.stageId === stage.id) ?? [];
  const [trackId, setTrackId] = useState(assignments[0]?.id ?? "");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [workDays, setWorkDays] = useState("3");
  const [dailyRate, setDailyRate] = useState("500");
  const [description, setDescription] = useState("");

  const selectedAssignment = assignments.find((a) => a.id === trackId);
  const primaryDesignerId = selectedAssignment?.designerId ?? order.designerId;
  const primaryName = getDesigner(primaryDesignerId)?.name ?? "原设计师";

  const days = Math.max(0, Number(workDays) || 0);
  const rate = Math.max(0, Number(dailyRate) || 0);
  const totalFee = calcCollaboratorFee(days, rate);

  const candidateDesigners = designers.filter(
    (d) => d.id !== primaryDesignerId,
  );

  const reset = () => {
    setTrackId(assignments[0]?.id ?? "");
    setCollaboratorId("");
    setWorkDays("3");
    setDailyRate("500");
    setDescription("");
  };

  const handleSubmit = () => {
    if (!collaboratorId || days <= 0 || rate <= 0) {
      onNotify({ title: "请完整填写配合设计师与工时", variant: "destructive" });
      return;
    }
    if (totalFee > stage.amount) {
      onNotify({
        title: "配合费不能超过本阶段款项",
        description: `本阶段 ${formatCurrency(stage.amount)}，请调整天数或日费率。`,
        variant: "destructive",
      });
      return;
    }

    const id = `collab_${Date.now().toString(36)}`;
    addService({
      id,
      orderId: order.id,
      stageId: stage.id,
      primaryDesignerId,
      trackAssignmentId: trackId || undefined,
      collaboratorDesignerId: collaboratorId,
      workDays: days,
      dailyRate: rate,
      totalFee,
      status: "in_progress",
      description: description.trim() || undefined,
      adminNote: "管理员登记",
      createdAt: new Date().toISOString(),
    });

    onNotify({
      title: "已登记配合设计师服务",
      description: `${getDesigner(collaboratorId)?.name} · ${days} 天 · ${formatCurrency(totalFee)}`,
      variant: "success",
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>增加配合设计师</DialogTitle>
          <DialogDescription>
            阶段「{stage.name}」· 款项 {formatCurrency(stage.amount)}。配合费按工时计算，需原设计师
            {primaryName} 确认后才会从本阶段份额中扣减并生效。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {assignments.length > 0 ? (
            <div className="space-y-1.5">
              <Label>关联专业 / 原设计师</Label>
              <Select value={trackId} onValueChange={setTrackId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择专业分工" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((a) => {
                    const labels = resolveTrackLabels(a.l1, a.l2, a.l3);
                    const name = getDesigner(a.designerId)?.name ?? a.designerId;
                    return (
                      <SelectItem key={a.id} value={a.id}>
                        {labels.l3Label} · {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="rounded-lg bg-ink-20/30 px-3 py-2 text-xs text-ink-60">
              原设计师：{primaryName}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>配合设计师</Label>
            <Select value={collaboratorId} onValueChange={setCollaboratorId}>
              <SelectTrigger>
                <SelectValue placeholder="选择设计师" />
              </SelectTrigger>
              <SelectContent>
                {candidateDesigners.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} · {d.tagline.slice(0, 12)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>工作天数</Label>
              <Input
                type="number"
                min={1}
                value={workDays}
                onChange={(e) => setWorkDays(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>日费率（元/天）</Label>
              <Input
                type="number"
                min={1}
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3">
            <div className="text-xs text-violet-800">预计配合费</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-violet-950">
              {formatCurrency(totalFee)}
            </div>
            <div className="mt-1 text-[11px] text-violet-800/80">
              确认生效后，{primaryName} 本阶段实得约{" "}
              {formatCurrency(Math.max(0, stage.amount - totalFee))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>配合说明（选填）</Label>
            <Textarea
              rows={2}
              placeholder="例如：协助修改方案文本与效果图细节..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="brand" onClick={handleSubmit}>
            登记并通知配合方
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 管理员订单详情：各阶段配合服务总览 */
export function AdminStageCollaboratorSection({
  order,
  getDesigner,
}: {
  order: Order;
  getDesigner: (id: string) => Designer | undefined;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-20 px-7 py-5">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          配合设计师管理
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          按付款阶段登记临时配合修改服务（工时计费）。配合完成后由配合方发起确认单，原设计师确认后费用计入阶段分配。
        </p>
      </div>
      <div className="divide-y divide-ink-20">
        {order.stages.map((stage) => (
          <div key={stage.id}>
            <div className="flex items-center justify-between bg-ink-20/10 px-7 py-3">
              <div>
                <span className="text-sm font-medium text-ink">{stage.name}</span>
                <span className="ml-2 text-xs text-ink-60">
                  {formatCurrency(stage.amount)}
                </span>
              </div>
            </div>
            <StageCollaboratorPanel
              order={order}
              stage={stage}
              getDesigner={getDesigner}
              mode="admin"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
