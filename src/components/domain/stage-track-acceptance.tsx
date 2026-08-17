"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DeliverableFile, Designer, Order, PaymentStage } from "@/lib/types";
import {
  getStageTrackDeliverableGroups,
  stageAcceptanceKey,
} from "@/lib/stage-track-groups";
import { resolveTrackLabels } from "@/lib/constants";
import { useStageAcceptanceStore } from "@/store/stage-acceptance-store";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DesignerName } from "@/components/domain/designer-name";
import { DeliverableFileList } from "@/components/domain/deliverable-file-list";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileBox,
  Lock,
} from "lucide-react";

function isStageClientAccepted(stage: PaymentStage) {
  return Boolean(stage.deliverablesConfirmedAt) || stage.status === "released";
}

function downloadDeliverableFiles(files: DeliverableFile[]) {
  const downloadable = files.filter((file) => file.url || file.thumbnail);
  if (downloadable.length === 0) return false;
  for (const file of downloadable) {
    const href = file.url || file.thumbnail;
    if (!href) continue;
    const a = document.createElement("a");
    a.href = href;
    a.download = file.name;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  return true;
}

const EMPTY_ACCEPTED: string[] = [];

export function StageTrackAcceptancePanel({
  order,
  stage,
  getDesigner,
  onPreview,
  onRevise,
  onStageComplete,
  onTrackAccepted,
  canConfirm = true,
}: {
  order: Order;
  stage: PaymentStage;
  getDesigner: (id: string) => Designer | undefined;
  onPreview: () => void;
  onRevise: () => void;
  onStageComplete: () => void;
  onTrackAccepted: (trackLabel: string) => void;
  /** 仅委托方可点「确认验收」；管理端只展示状态 */
  canConfirm?: boolean;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const acceptanceKey = stageAcceptanceKey(order.id, stage.id);
  const storedAcceptedIds =
    useStageAcceptanceStore((s) => s.acceptedByStage[acceptanceKey]) ??
    EMPTY_ACCEPTED;
  const acceptTracks = useStageAcceptanceStore((s) => s.acceptTracks);
  const clientAccepted = isStageClientAccepted(stage);

  const groups = useMemo(
    () => getStageTrackDeliverableGroups(order, stage),
    [order, stage],
  );
  const acceptedIds = clientAccepted
    ? groups.map((g) => g.groupId)
    : storedAcceptedIds;

  const [selected, setSelected] = useState<string[]>([]);

  const pendingGroups = groups.filter((g) => !acceptedIds.includes(g.groupId));
  const allAccepted =
    groups.length > 0 && groups.every((g) => acceptedIds.includes(g.groupId));

  const handleDownload = (files: DeliverableFile[], unlocked: boolean) => {
    if (!unlocked) {
      push({
        title: "需先验收确认才能下载",
        variant: "destructive",
      });
      return;
    }
    if (!downloadDeliverableFiles(files)) {
      push({ title: "暂无可下载文件" });
    }
  };

  const acceptedBadge = (
    <Badge variant="emerald" className="h-9 px-3 text-xs">
      <CheckCircle2 className="h-3.5 w-3.5" />
      委托方已验收
    </Badge>
  );
  const selectablePending = pendingGroups.map((g) => g.groupId);
  const allSelected =
    selectablePending.length > 0 &&
    selectablePending.every((id) => selected.includes(id));

  const trackLabelOf = (groupId: string) => {
    const group = groups.find((g) => g.groupId === groupId);
    if (!group?.assignment) return group?.fallbackLabel ?? "成果";
    const labels = resolveTrackLabels(
      group.assignment.l1,
      group.assignment.l2,
      group.assignment.l3,
    );
    return labels.l3Label;
  };

  const toggleSelect = (groupId: string) => {
    setSelected((prev) =>
      prev.includes(groupId) ?
        prev.filter((id) => id !== groupId)
      : [...prev, groupId],
    );
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? [] : selectablePending);
  };

  const acceptGroupIds = (groupIds: string[]) => {
    const pending = groupIds.filter((id) => !acceptedIds.includes(id));
    if (pending.length === 0) return;

    acceptTracks(acceptanceKey, pending);
    setSelected((prev) => prev.filter((id) => !pending.includes(id)));
    pending.forEach((id) => onTrackAccepted(trackLabelOf(id)));

    const nextAccepted = [...new Set([...acceptedIds, ...pending])];
    if (groups.every((g) => nextAccepted.includes(g.groupId))) {
      onStageComplete();
    }
  };

  if (groups.length === 0) return null;

  const usePerTrackUi = groups.length > 1 || groups[0].assignment;

  if (!usePerTrackUi) {
    const group = groups[0];
    const accepted = acceptedIds.includes(group.groupId);
    return (
      <div className="border-t border-ink-20 bg-ink-20/20 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-60">
            <FileBox className="h-3.5 w-3.5" /> 阶段成果文件
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onPreview}>
              <Eye className="h-3.5 w-3.5" /> 在线预览
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(group.deliverables, accepted)}
            >
              <Download className="h-3.5 w-3.5" /> 下载成果
            </Button>
            {accepted ? acceptedBadge : canConfirm ? (
              <Button
                size="sm"
                variant="brand"
                onClick={() => acceptGroupIds([group.groupId])}
              >
                <Check className="h-3.5 w-3.5" /> 确认验收
              </Button>
            ) : null}
          </div>
        </div>

        <DeliverableFileList
          files={group.deliverables}
          getDesigner={getDesigner}
          unlocked={accepted}
        />

        {!accepted && canConfirm ? (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={onRevise}>
              申请返修
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-t border-ink-20 bg-ink-20/20 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-60">
            <FileBox className="h-3.5 w-3.5" />
            阶段成果 · 按专业验收
          </div>
          <p className="mt-1 text-xs text-ink-60">
            每个三级专业可单独验收；也可全选后一并确认。验收通过后解锁对应成果下载。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPreview}>
            <Eye className="h-3.5 w-3.5" /> 在线预览
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              handleDownload(
                groups.flatMap((g) => g.deliverables),
                allAccepted,
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> 下载成果
          </Button>
          {allAccepted ? acceptedBadge : canConfirm && pendingGroups.length > 0 ? (
            <>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-20 bg-white px-3 py-1.5 text-xs text-ink">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-ink-20 accent-brand"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
                全选待验收
              </label>
              <Button
                size="sm"
                variant="brand"
                disabled={selected.length === 0}
                onClick={() => acceptGroupIds(selected)}
              >
                <Check className="h-3.5 w-3.5" />
                验收已选（{selected.length}）
              </Button>
              <Button size="sm" onClick={() => acceptGroupIds(selectablePending)}>
                一键验收全部
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {allAccepted ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          本阶段全部专业已验收完成，成果文件已解锁下载。
        </div>
      ) : (
        <div className="mb-4 text-xs text-ink-60">
          已验收 {acceptedIds.length}/{groups.length} 个专业
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group) => {
          const accepted = acceptedIds.includes(group.groupId);
          const isSelected = selected.includes(group.groupId);
          const assignment = group.assignment;
          const labels =
            assignment ?
              resolveTrackLabels(assignment.l1, assignment.l2, assignment.l3)
            : null;
          const designer =
            assignment ? getDesigner(assignment.designerId) : undefined;

          return (
            <div
              key={group.groupId}
              className={cn(
                "rounded-2xl border p-4 transition-colors",
                accepted ?
                  "border-emerald-200 bg-emerald-50/40"
                : isSelected ?
                  "border-brand/40 bg-brand/5"
                : "border-ink-20 bg-white",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {!accepted ? (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-ink-20 accent-brand"
                      checked={isSelected}
                      onChange={() => toggleSelect(group.groupId)}
                    />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  )}

                  <div className="min-w-0 flex-1 space-y-2">
                    {labels ? (
                      <div className="flex flex-wrap items-center gap-1 text-xs text-ink-60">
                        <span className="font-medium text-ink">{labels.l1Label}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>{labels.l2Label}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>{labels.l3Label}</span>
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-ink">
                        {group.fallbackLabel ?? "成果分组"}
                      </div>
                    )}

                    {designer ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={designer.avatar} alt={designer.name} />
                          <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <Link
                          href={`/designers/${designer.id}`}
                          className="text-xs font-medium text-ink hover:text-brand"
                        >
                          <DesignerName designer={designer} />
                        </Link>
                      </div>
                    ) : null}

                    <DeliverableFileList
                      files={group.deliverables}
                      getDesigner={getDesigner}
                      compact
                      unlocked={accepted}
                    />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {accepted ?
                    <Badge variant="emerald">委托方已验收</Badge>
                  : <>
                      <Badge variant="outline" className="text-[10px]">
                        <Lock className="mr-1 h-3 w-3" />
                        待验收
                      </Badge>
                      {canConfirm ? (
                        <Button
                          size="sm"
                          variant="brand"
                          onClick={() => acceptGroupIds([group.groupId])}
                        >
                          <Check className="h-3.5 w-3.5" />
                          验收本专业
                        </Button>
                      ) : null}
                    </>
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!allAccepted && canConfirm ? (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={onRevise}>
            申请返修
          </Button>
        </div>
      ) : null}
    </div>
  );
}
