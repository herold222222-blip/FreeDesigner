"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  Designer,
  Order,
  OrderDesignerReplacement,
  OrderTrackAssignment,
  DeliverableFile,
} from "@/lib/types";
import { useDesigners } from "@/lib/use-data";
import { resolveTrackLabels } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DesignerName } from "@/components/domain/designer-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DeliverableFileList } from "@/components/domain/deliverable-file-list";
import { PaymentSplitsList } from "@/components/domain/stage-payment-splits";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useSessionStore } from "@/store/session-store";
import { formatCurrency, formatDateTime, formatPercent, formatServicePeriod } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  UserRound,
  History,
  ArrowRight,
  FileBox,
  Split,
} from "lucide-react";

const ASSIGNMENT_STATUS: Record<
  OrderTrackAssignment["status"],
  { label: string; tone: string }
> = {
  serving: { label: "服务中", tone: "bg-brand/10 text-brand" },
  completed: { label: "已交付", tone: "bg-emerald-100 text-emerald-800" },
  pending_match: { label: "待匹配", tone: "bg-amber-100 text-amber-800" },
};

function getAssignmentDeliverables(order: Order, assignment: OrderTrackAssignment) {
  const stage = order.stages.find((s) => s.id === assignment.stageId);
  if (!stage?.deliverables?.length) return [];
  if (!assignment.deliverableIds?.length) return [];
  return stage.deliverables.filter((d) =>
    assignment.deliverableIds!.includes(d.id),
  );
}

function getHistoricalDeliverables(
  order: Order,
  assignmentId: string,
): DeliverableFile[] {
  const seen = new Set<string>();
  const files: DeliverableFile[] = [];
  for (const record of order.designerReplacements ?? []) {
    if (record.trackAssignmentId !== assignmentId) continue;
    for (const file of record.previousDeliverables ?? []) {
      if (seen.has(file.id)) continue;
      seen.add(file.id);
      files.push(file);
    }
  }
  return files.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
}

export function OrderTrackAssignmentsPanel({
  order,
  getDesigner,
  mode = "client",
}: {
  order: Order;
  getDesigner: (id: string) => Designer | undefined;
  mode?: "client" | "admin";
}) {
  const { data: allDesigners } = useDesigners();
  const assignments = order.trackAssignments ?? [];
  const replacements = order.designerReplacements ?? [];
  const [historyOpen, setHistoryOpen] = useState(false);

  if (assignments.length === 0) return null;

  const replacementCountByTrack = (trackId: string) =>
    replacements.filter((r) => r.trackAssignmentId === trackId).length;

  return (
    <Card className="p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            专业分工 · 服务设计师
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            {mode === "admin"
              ? "按一级 / 二级 / 三级专业查看服务设计师、更换记录与阶段成果。点击头像可更换设计师或查看历史成果。"
              : "按一级 / 二级 / 三级专业查看当前对接设计师及其阶段成果。点击头像可进行访问主页、申请更换或投诉。"}
          </p>
        </div>
        {replacements.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-3.5 w-3.5" />
            查看已更换设计师
            <span className="rounded-full bg-ink-20/60 px-1.5 py-0 text-[10px] font-medium tabular-nums">
              {replacements.length}
            </span>
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {assignments.map((assignment) => {
          const labels = resolveTrackLabels(
            assignment.l1,
            assignment.l2,
            assignment.l3,
          );
          const designer = getDesigner(assignment.designerId);
          const stage = order.stages.find((s) => s.id === assignment.stageId);
          const deliverables = getAssignmentDeliverables(order, assignment);
          const historicalDeliverables = getHistoricalDeliverables(
            order,
            assignment.id,
          );
          const statusMeta = ASSIGNMENT_STATUS[assignment.status];
          const replacedTimes = replacementCountByTrack(assignment.id);

          return (
            <div
              key={assignment.id}
              className="rounded-2xl border border-ink-20 bg-ink-20/10 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-1 text-xs text-ink-60">
                    <span className="font-medium text-ink">{labels.l1Label}</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span>{labels.l2Label}</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span>{labels.l3Label}</span>
                  </div>

                  {designer ? (
                    <div className="flex items-start gap-3">
                      <DesignerAvatarMenu
                        designer={designer}
                        mode={mode}
                        assignment={assignment}
                        order={order}
                        allDesigners={allDesigners}
                        onOpenHistory={() => setHistoryOpen(true)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <DesignerName
                            designer={designer}
                            className="text-sm font-semibold"
                          />
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              statusMeta.tone,
                            )}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-ink-60">
                          {designer.tagline}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-ink-60">设计师信息不可用</div>
                  )}

                  {stage ? (
                    <div className="text-xs text-ink-60">
                      当前阶段：
                      <span className="font-medium text-ink">{stage.name}</span>
                    </div>
                  ) : null}
                  {replacedTimes > 0 ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                      onClick={() => setHistoryOpen(true)}
                    >
                      <History className="h-3 w-3" />
                      该专业曾更换设计师 {replacedTimes} 次
                    </button>
                  ) : null}
                </div>
              </div>

              {deliverables.length > 0 ? (
                <div className="mt-4 border-t border-dashed border-ink-20 pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-40">
                    <FileBox className="h-3.5 w-3.5" />
                    本阶段已上传成果
                  </div>
                  <DeliverableFileList
                    files={deliverables}
                    getDesigner={getDesigner}
                  />
                </div>
              ) : assignment.status === "serving" ? (
                <div className="mt-4 border-t border-dashed border-ink-20 pt-3 text-xs text-ink-40">
                  该专业当前阶段暂无上传成果，设计师推进后将在此展示。
                </div>
              ) : null}

              {historicalDeliverables.length > 0 ? (
                <div className="mt-4 border-t border-dashed border-ink-20 pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-40">
                    <History className="h-3.5 w-3.5" />
                    历史成果（更换前设计师提交）
                  </div>
                  <DeliverableFileList
                    files={historicalDeliverables}
                    getDesigner={getDesigner}
                    compact
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <DesignerReplacementHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        replacements={replacements}
        getDesigner={getDesigner}
      />
    </Card>
  );
}

function DesignerReplacementHistoryDialog({
  open,
  onOpenChange,
  replacements,
  getDesigner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replacements: OrderDesignerReplacement[];
  getDesigner: (id: string) => Designer | undefined;
}) {
  const sorted = [...replacements].sort(
    (a, b) => new Date(b.replacedAt).getTime() - new Date(a.replacedAt).getTime(),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>已更换设计师记录</DialogTitle>
          <DialogDescription>
            以下为该订单中已通过平台审核并完成替换的历史记录，含原设计师提交成果及管理员更新的合同支付比例。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sorted.map((record) => {
            const labels = resolveTrackLabels(record.l1, record.l2, record.l3);
            const prev = getDesigner(record.previousDesignerId);
            const curr = getDesigner(record.currentDesignerId);
            const adj = record.paymentAdjustment;

            return (
              <div
                key={record.id}
                className="rounded-xl border border-ink-20 bg-ink-20/10 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-1 text-[11px] text-ink-60">
                  <span className="font-medium text-ink">{labels.l1Label}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>{labels.l2Label}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>{labels.l3Label}</span>
                </div>

                <div className="flex items-center gap-2">
                  {prev ? (
                    <Link
                      href={`/designers/${prev.id}`}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-ink-20 bg-white p-2 opacity-75 transition-opacity hover:opacity-100"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={prev.avatar} alt={prev.name} />
                        <AvatarFallback>{prev.name.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-ink line-through decoration-ink-40">
                          {prev.name}
                        </div>
                        <div className="text-[10px] text-ink-40">原设计师</div>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex-1 text-xs text-ink-40">原设计师不可用</div>
                  )}

                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-40" />

                  {curr ? (
                    <Link
                      href={`/designers/${curr.id}`}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 p-2 transition-colors hover:bg-brand/10"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={curr.avatar} alt={curr.name} />
                        <AvatarFallback>{curr.name.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-ink">
                          {curr.name}
                        </div>
                        <div className="text-[10px] text-brand">现任设计师</div>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex-1 text-xs text-ink-40">现任设计师不可用</div>
                  )}
                </div>

                <div className="mt-3 space-y-2 text-xs text-ink-60">
                  <div className="rounded-lg bg-white/80 px-2.5 py-2">
                    <div className="font-medium text-ink">原设计师服务时间</div>
                    <div className="mt-0.5 tabular-nums">
                      {formatServicePeriod(
                        record.previousServiceFrom,
                        record.previousServiceTo,
                      )}
                    </div>
                  </div>
                  {record.currentServiceFrom ? (
                    <div className="rounded-lg bg-brand/5 px-2.5 py-2">
                      <div className="font-medium text-ink">现任设计师服务时间</div>
                      <div className="mt-0.5 tabular-nums">
                        {formatServicePeriod(record.currentServiceFrom)}
                      </div>
                    </div>
                  ) : null}
                  {record.stageName ? (
                    <div className="text-ink-40">关联阶段 · {record.stageName}</div>
                  ) : null}
                  {record.reason ? (
                    <div className="rounded-lg bg-white/80 px-2.5 py-2 text-ink-60">
                      原因：{record.reason}
                    </div>
                  ) : null}
                </div>

                {(record.previousDeliverables?.length ?? 0) > 0 ? (
                  <div className="mt-4 border-t border-dashed border-ink-20 pt-4">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-40">
                      <FileBox className="h-3.5 w-3.5" />
                      原设计师已提交成果
                    </div>
                    <DeliverableFileList
                      files={record.previousDeliverables!}
                      getDesigner={getDesigner}
                      compact
                    />
                  </div>
                ) : null}

                {adj ? (
                  <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Split className="h-3.5 w-3.5 text-amber-800" />
                      <span className="text-xs font-semibold text-amber-900">
                        合同支付比例调整
                      </span>
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-[10px] text-amber-800"
                      >
                        管理员配置 · {formatDateTime(adj.adjustedAt)}
                      </Badge>
                    </div>
                    <p className="mb-3 text-[11px] leading-relaxed text-amber-900/90">
                      本阶段原占比{" "}
                      <span className="font-semibold">
                        {formatPercent(adj.originalOrderRatio)}%
                      </span>
                      ，更换前该专业独占{" "}
                      <span className="font-semibold">
                        {formatPercent(adj.previousSingleOrderRatio)}%
                      </span>
                      。已支付款项不变，仅调整后续结算分配。
                    </p>
                    {adj.adminNote ? (
                      <p className="mb-3 rounded-lg bg-white/70 px-2.5 py-2 text-[11px] text-amber-900/80">
                        {adj.adminNote}
                      </p>
                    ) : null}
                    <PaymentSplitsList
                      splits={adj.splits}
                      stageRatio={adj.originalOrderRatio}
                      getDesigner={getDesigner}
                    />
                    <div className="mt-2 text-right text-[11px] tabular-nums text-amber-900/80">
                      拆分合计{" "}
                      {formatCurrency(adj.splits.reduce((s, x) => s + x.amount, 0))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DesignerAvatarMenu({
  designer,
  mode = "client",
  assignment,
  order,
  allDesigners = [],
  onOpenHistory,
}: {
  designer: Designer;
  mode?: "client" | "admin";
  assignment?: OrderTrackAssignment;
  order?: Order;
  allDesigners?: Designer[];
  onOpenHistory?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [newDesignerId, setNewDesignerId] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const push = useSessionStore((s) => s.pushNotification);
  const isAdmin = mode === "admin";

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

  const submitReplace = () => {
    if (isAdmin) {
      const next = allDesigners.find((d) => d.id === newDesignerId);
      if (!next) {
        push({ title: "请选择新任设计师", variant: "destructive" });
        return;
      }
      setReplaceOpen(false);
      setReason("");
      setNewDesignerId("");
      push({
        title: `已更换设计师 · ${assignment ? resolveTrackLabels(assignment.l1, assignment.l2, assignment.l3).l3Label : "该专业"}`,
        description: `「${designer.name}」→「${next.name}」。请同步更新阶段支付比例拆分。`,
        variant: "success",
      });
      return;
    }
    setReplaceOpen(false);
    setReason("");
    push({
      title: "已提交更换设计师申请",
      description: `平台将在 1 个工作日内审核「${designer.name}」的更换请求并重新匹配。`,
      variant: "success",
    });
  };

  const submitComplaint = () => {
    if (!reason.trim()) {
      push({
        title: "请填写投诉说明",
        variant: "destructive",
      });
      return;
    }
    setComplaintOpen(false);
    setReason("");
    push({
      title: "投诉已提交",
      description: "客服将在 24 小时内联系你核实情况。",
      variant: "success",
    });
  };

  return (
    <>
      <div ref={wrapRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-full ring-offset-2 transition-shadow hover:ring-2 hover:ring-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          title={`${designer.name} · 点击查看操作`}
        >
          <Avatar className="h-12 w-12 cursor-pointer">
            <AvatarImage src={designer.avatar} alt={designer.name} />
            <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
        </button>

        {open ? (
          <div className="absolute left-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-ink-20 bg-white py-1 shadow-xl">
            <Link
              href={`/designers/${designer.id}`}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink hover:bg-ink-20/40"
              onClick={() => setOpen(false)}
            >
              <UserRound className="h-4 w-4 text-ink-60" />
              访问其主页
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink hover:bg-ink-20/40"
              onClick={() => {
                setOpen(false);
                setReplaceOpen(true);
              }}
            >
              <RefreshCw className="h-4 w-4 text-ink-60" />
              {isAdmin ? "更换设计师" : "申请更换设计师"}
            </button>
            {isAdmin && onOpenHistory ? (
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink hover:bg-ink-20/40"
                onClick={() => {
                  setOpen(false);
                  onOpenHistory();
                }}
              >
                <History className="h-4 w-4 text-ink-60" />
                查看已更换设计师
              </button>
            ) : null}
            {!isAdmin ? (
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  setOpen(false);
                  setComplaintOpen(true);
                }}
              >
                <AlertTriangle className="h-4 w-4" />
                投诉设计师
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={replaceOpen} onOpenChange={setReplaceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isAdmin ? "更换设计师" : "申请更换设计师"}
            </DialogTitle>
            <DialogDescription>
              {isAdmin
                ? `将「${designer.name}」更换为其他设计师。原设计师成果将保留为历史记录，请确认阶段支付比例拆分。`
                : `将向平台提交更换「${designer.name}」的申请。审核通过后系统将重新匹配同级别设计师，原阶段成果仍保留在订单中。`}
            </DialogDescription>
          </DialogHeader>
          {isAdmin ? (
            <div className="space-y-3">
              {assignment && order ? (
                <div className="rounded-lg bg-ink-20/20 px-3 py-2 text-xs text-ink-60">
                  专业：
                  {resolveTrackLabels(assignment.l1, assignment.l2, assignment.l3).l3Label}
                  {order.stages.find((s) => s.id === assignment.stageId)?.name
                    ? ` · ${order.stages.find((s) => s.id === assignment.stageId)!.name}`
                    : null}
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label>新任设计师</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-ink-20 bg-background px-3 text-sm"
                  value={newDesignerId}
                  onChange={(e) => setNewDesignerId(e.target.value)}
                >
                  <option value="">请选择设计师</option>
                  {allDesigners
                    .filter((d) => d.id !== designer.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>{isAdmin ? "更换说明（选填）" : "更换原因（选填）"}</Label>
            <Textarea
              rows={3}
              placeholder={
                isAdmin
                  ? "例如：原设计师无法继续服务，已与客户沟通同意更换..."
                  : "例如：沟通响应慢、专业方向不匹配..."
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReplaceOpen(false)}>
              取消
            </Button>
            <Button variant="brand" onClick={submitReplace}>
              {isAdmin ? "确认更换" : "提交申请"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={complaintOpen} onOpenChange={setComplaintOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>投诉设计师</DialogTitle>
            <DialogDescription>
              投诉对象：{designer.name}。平台将介入调查，必要时冻结该阶段托管资金。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>
              投诉说明 <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              rows={4}
              placeholder="请描述具体问题与期望处理方式..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setComplaintOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={submitComplaint}>
              提交投诉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
