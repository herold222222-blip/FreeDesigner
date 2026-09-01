"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type {
  DeliverableFile,
  Designer,
  Order,
  PaymentStage,
  ServiceProvider,
  StageDesignerPaymentSplit,
} from "@/lib/types";
import {
  StageRevisionDialog,
  type RevisionAttachment,
} from "@/components/domain/stage-revision-dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  getStageParticipantGroups,
  type StageParticipantRole,
} from "@/lib/stage-track-groups";
import { DeliverableHistorySections } from "@/components/domain/deliverable-file-list";
import { DesignerName } from "@/components/domain/designer-name";
import { DesignerLevelBadge } from "@/components/domain/level-badges";
import { withReturnTo } from "@/lib/admin-return-to";
import { isContractFullySigned } from "@/lib/order-lifecycle";
import { resolveProjectDesignerName } from "@/lib/designer-contact-privacy";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Check, FileSearch, UserCog, Users } from "lucide-react";
import { DeliverablesForwardControls } from "@/components/domain/deliverables-forward-controls";
import {
  canClientConfirmPhase,
  clientConfirmLabel,
  resolveDeliverablePhase,
} from "@/lib/deliverable-phase";

const ROLE_META: Record<
  StageParticipantRole,
  { label: string; tone: string }
> = {
  designer: { label: "设计师", tone: "bg-ink-20/50 text-ink" },
  auditor: { label: "审图师", tone: "bg-amber-100 text-amber-800" },
  project_manager: { label: "项目管理员", tone: "bg-violet-100 text-violet-800" },
};

function splitForGroup(
  group: { role: StageParticipantRole; personId: string },
  splits?: StageDesignerPaymentSplit[],
) {
  if (!splits?.length) return undefined;
  if (group.role === "designer") {
    return splits.find((s) => s.designerId === group.personId && s.role !== "auditor" && s.role !== "project_manager");
  }
  if (group.role === "auditor") {
    return splits.find((s) => s.role === "auditor" && s.serviceProviderId === group.personId);
  }
  return splits.find(
    (s) => s.role === "project_manager" && s.serviceProviderId === group.personId,
  );
}

function ParticipantIdentity({
  designer,
  name,
  avatar,
  revealFullName,
  roleLabel,
  roleTone,
  RoleIcon,
  specialtyLabel,
  profileHref,
}: {
  designer?: Designer;
  name: string;
  avatar?: string;
  revealFullName: boolean;
  roleLabel: string;
  roleTone: string;
  RoleIcon: typeof Users;
  specialtyLabel: string;
  profileHref?: string;
}) {
  const body = (
    <>
      <Avatar className="h-9 w-9">
        {avatar ? <AvatarImage src={avatar} alt={name} /> : null}
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">
            {designer ? (
              <DesignerName designer={designer} revealFullName={revealFullName} />
            ) : (
              name
            )}
          </span>
          <Badge className={roleTone}>
            <RoleIcon className="mr-1 h-3 w-3" />
            {roleLabel}
          </Badge>
          {designer ? (
            <DesignerLevelBadge level={designer.level ?? "mid_v1"} />
          ) : null}
        </div>
        <div className="mt-0.5 text-xs text-ink-60">{specialtyLabel}</div>
      </div>
    </>
  );
  if (!profileHref) {
    return <div className="flex min-w-0 items-start gap-3">{body}</div>;
  }
  return (
    <Link
      href={profileHref}
      className="-m-1 flex min-w-0 items-start gap-3 rounded-xl p-1 transition-colors hover:bg-ink-20/50"
    >
      {body}
    </Link>
  );
}

export function StageParticipantDeliverables({
  order,
  stage,
  getDesigner,
  getServiceProvider,
  roles,
  unlocked = true,
  forceShow,
  compact,
  splits,
  showFiles = true,
  onConfirm,
  confirmDisabled,
  onRevise,
  reviseDisabled,
}: {
  order: Order;
  stage: PaymentStage;
  getDesigner: (id: string) => Designer | undefined;
  getServiceProvider?: (id: string) => ServiceProvider | undefined;
  roles?: StageParticipantRole[];
  unlocked?: boolean;
  forceShow?: boolean;
  compact?: boolean;
  splits?: StageDesignerPaymentSplit[];
  showFiles?: boolean;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  onRevise?: (payload: {
    file: DeliverableFile;
    description: string;
    attachments: RevisionAttachment[];
  }) => void;
  reviseDisabled?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviseFile, setReviseFile] = useState<DeliverableFile | null>(null);
  const pathname = usePathname();
  const revealFullName = isContractFullySigned(order);
  const groups = getStageParticipantGroups(order, stage).filter((g) =>
    roles ? roles.includes(g.role) : true,
  );
  const hasExtraRoles = groups.some((g) => g.role !== "designer");
  const designerCount = groups.filter((g) => g.role === "designer").length;
  const hasFiles = groups.some((g) => g.deliverables.length > 0);
  const stageRevisions = (order.revisions ?? []).filter(
    (r) => r.stageId === stage.id,
  );
  const confirmedAt = stage.deliverablesConfirmedAt;
  const confirmed = Boolean(confirmedAt);
  const phase = resolveDeliverablePhase(stage, order.status);
  const confirmLabel = clientConfirmLabel(phase);
  const confirmable = Boolean(onConfirm) && canClientConfirmPhase(stage, order.status);
  const canForward = (stage.deliverables ?? []).length > 0;

  if (groups.length === 0) return null;
  if (!forceShow && !hasExtraRoles && designerCount <= 1 && !hasFiles) return null;

  const finishConfirm = () => {
    setConfirmOpen(false);
    onConfirm?.();
  };

  const handleConfirmClick = () => {
    if (confirmDisabled || !confirmable) return;
    setConfirmOpen(true);
  };

  return (
    <div
      className={cn(
        compact
          ? "mt-3 rounded-xl border border-ink-20 bg-ink-20/20 p-4"
          : "border-t border-ink-20 bg-ink-20/20 p-5",
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-60">
        <Users className="h-3.5 w-3.5" />
        {showFiles ? "本阶段参与人与成果" : "本阶段参与人费用"}
      </div>
      <div className="space-y-3">
        {groups.map((group) => {
          const designer =
            group.role === "designer" ? getDesigner(group.personId) : undefined;
          const provider =
            group.role !== "designer"
              ? getServiceProvider?.(group.personId)
              : undefined;
          const name = designer
            ? resolveProjectDesignerName(designer.name, revealFullName)
            : (provider?.name ?? "待指定");
          const avatar = designer?.avatar ?? provider?.avatar;
          const roleMeta = ROLE_META[group.role];
          const RoleIcon =
            group.role === "auditor"
              ? FileSearch
              : group.role === "project_manager"
                ? UserCog
                : Users;
          const fee = splitForGroup(group, splits);

          return (
            <div
              key={group.id}
              className="rounded-2xl border border-ink-20 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <ParticipantIdentity
                  designer={designer}
                  name={name}
                  avatar={avatar}
                  revealFullName={revealFullName}
                  roleLabel={roleMeta.label}
                  roleTone={roleMeta.tone}
                  RoleIcon={RoleIcon}
                  specialtyLabel={group.label}
                  profileHref={
                    designer
                      ? pathname
                        ? withReturnTo(`/designers/${designer.id}`, pathname)
                        : `/designers/${designer.id}`
                      : undefined
                  }
                />
                <div className="text-right">
                  {fee ? (
                    <div className="text-sm font-semibold tabular-nums text-ink">
                      {formatCurrency(fee.amount)}
                    </div>
                  ) : null}
                  {showFiles ? (
                    <span className="text-xs text-ink-40">
                      {group.deliverables.length > 0
                        ? `${group.deliverables.length} 个附件`
                        : "暂无成果 / 确认单"}
                    </span>
                  ) : null}
                </div>
              </div>
              {showFiles && group.deliverables.length > 0 ? (
                <div className="mt-3">
                  <DeliverableHistorySections
                    files={group.deliverables}
                    getDesigner={getDesigner}
                    compact
                    unlocked={unlocked}
                    onRevise={
                      onRevise && !reviseDisabled
                        ? (file) => setReviseFile(file)
                        : undefined
                    }
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {stageRevisions.length > 0 ? (
        <div className="mt-3 space-y-2">
          {stageRevisions.map((rev) => (
            <div
              key={rev.id}
              className="rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-xs text-ink"
            >
              <div className="text-violet-800">
                {formatDateTime(rev.createdAt)} ·{" "}
                {rev.status === "pending" ? "待设计师返修" : "设计师已回传"}
                {rev.fileName ? ` · ${rev.fileName}` : ""}
              </div>
              {rev.description ? (
                <div className="mt-1 text-ink">{rev.description}</div>
              ) : null}
              {rev.attachments.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rev.attachments.map((a, i) =>
                    a.url ? (
                      <a
                        key={`${rev.id}-${i}`}
                        href={a.url}
                        download={a.name}
                        className="rounded-full bg-white px-2 py-0.5 text-[11px] text-violet-800 hover:underline"
                      >
                        {a.name}
                      </a>
                    ) : (
                      <Badge key={`${rev.id}-${i}`} variant="muted">
                        {a.name}
                      </Badge>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {confirmable || confirmed || canForward || stage.preliminaryConfirmedAt || stage.preliminarySkippedAt ? (
        <div className="mt-3 space-y-2">
          {stage.preliminaryConfirmedAt && !confirmed ? (
            <p className="text-xs text-ink-50">
              初步成果已于 {formatDateTime(stage.preliminaryConfirmedAt)} 确认，
              {confirmable ? "请确认最终成果。" : "等待设计师上传最终成果 / 确认单。"}
            </p>
          ) : null}
          {stage.preliminarySkippedAt && !stage.preliminaryConfirmedAt && !confirmed ? (
            <p className="text-xs text-ink-50">
              设计师已跳过初步成果
              {confirmable ? "，请确认最终成果。" : "，等待上传最终成果 / 确认单。"}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
          {confirmedAt ? (
            <span className="text-[11px] text-ink-40">
              最终成果确认时间 {formatDateTime(confirmedAt)}
            </span>
          ) : null}
          <DeliverablesForwardControls
            orderId={order.id}
            stageId={stage.id}
            title={`${order.code} · ${stage.name}`}
            enabled={canForward}
            confirmable={confirmable}
            confirmLabel={confirmLabel}
          />
          {confirmable ? (
            <Button
              variant="brand"
              size="sm"
              disabled={confirmDisabled}
              onClick={handleConfirmClick}
            >
              <Check className="h-3.5 w-3.5" />
              {confirmLabel}
            </Button>
          ) : confirmed ? (
            <Button variant="brand" size="sm" disabled>
              <Check className="h-3.5 w-3.5" />
              已确认最终成果
            </Button>
          ) : null}
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmLabel}</DialogTitle>
            <DialogDescription>
              {phase === "preliminary"
                ? hasFiles
                  ? "是否确认此阶段初步成果？确认后设计师将上传最终 PDF + CAD 完整成果。"
                  : "当前暂无初步成果文件，是否仍确认？"
                : hasFiles
                  ? "是否确认此阶段最终成果 / 确认单？"
                  : "当前设计师未上传最终成果或者确认单，是否确认此阶段设计成果？"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button variant="brand" onClick={finishConfirm}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StageRevisionDialog
        open={!!reviseFile}
        onOpenChange={(open) => {
          if (!open) setReviseFile(null);
        }}
        file={reviseFile}
        onSubmit={(payload) => {
          if (!reviseFile || !onRevise) return;
          onRevise({ file: reviseFile, ...payload });
          setReviseFile(null);
        }}
      />
    </div>
  );
}
