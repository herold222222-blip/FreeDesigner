"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
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
import { BountyApplicantList } from "@/components/domain/bounty-applicant-list";
import { BountyEditDialog } from "@/components/domain/bounty-edit-dialog";
import { SpecialtyBadge } from "@/components/domain/status-badges";
import { useBounty, useDesigners } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import {
  bountyStatusBadgeVariant,
  bountyStatusLabel,
  canManageBountyBeforeContract,
} from "@/lib/bounty-manage";
import { bountyApplicantCount } from "@/lib/bounty-privacy";
import { getTrackLabelParts } from "@/lib/bounty-filters";
import {
  awardBountyRequest,
  deleteBountyRequest,
  pauseBountyRequest,
  resumeBountyRequest,
  updateBountyRequest,
} from "@/lib/api-client";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Megaphone,
  Pause,
  Pencil,
  Play,
  Trash2,
  Users,
} from "lucide-react";
import { formatBountyReward, formatDate, formatDateTime } from "@/lib/utils";

export default function ClientBountyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bountyId = typeof params.id === "string" ? params.id : "";
  const identityId = useRoleStore((s) => s.identityId);
  const push = useSessionStore((s) => s.pushNotification);
  const { data: bounty, refresh } = useBounty(bountyId);
  const { data: designers } = useDesigners();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!bounty) {
    return (
      <Card className="p-12 text-center text-ink-60">未找到该悬赏项目。</Card>
    );
  }

  if (bounty.publisherId !== identityId) {
    return (
      <Card className="p-12 text-center text-ink-60">
        仅可查看自己发布的悬赏报名情况。
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/client/bounties">返回我的悬赏</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const trackLabels = getTrackLabelParts(bounty.primaryTrack);
  const manageable = canManageBountyBeforeContract(bounty);
  const isPaused = bounty.status === "paused";

  const runAction = async (fn: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      push({ title: success, variant: "success" });
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

  const handleDelete = async () => {
    setDeleteOpen(false);
    setBusy(true);
    try {
      await deleteBountyRequest(bounty.id);
      push({ title: "悬赏已删除", variant: "success" });
      router.push("/client/bounties");
    } catch (e) {
      push({
        title: "删除失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/client/bounties"
        className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回我的悬赏
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SpecialtyBadge specialty={bounty.specialty} />
              <Badge variant="muted">{trackLabels.l1}</Badge>
              <Badge variant={bountyStatusBadgeVariant(bounty.status)}>
                {bountyStatusLabel(bounty.status)}
              </Badge>
              <span className="text-xs text-ink-40">{bounty.code}</span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
              {bounty.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-60">
              {bounty.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-60">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {bounty.location.label}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" /> 成果提交{" "}
                {formatDate(bounty.deadline)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />{" "}
                {bountyApplicantCount(bounty)} 位设计师报名
              </span>
              <span>发布于 {formatDateTime(bounty.publishedAt)}</span>
            </div>
            <div className="mt-4 text-2xl font-bold text-brand">
              {formatBountyReward(bounty.reward)}
            </div>
          </div>

          {manageable ? (
            <div className="flex flex-wrap gap-2">
              {isPaused ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => resumeBountyRequest(bounty.id),
                      "悬赏已恢复开放报名",
                    )
                  }
                >
                  <Play className="h-3.5 w-3.5" /> 恢复报名
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    runAction(
                      () => pauseBountyRequest(bounty.id),
                      "悬赏已暂停，设计师将无法新报名",
                    )
                  }
                >
                  <Pause className="h-3.5 w-3.5" /> 暂停悬赏
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" /> 修改
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> 删除
              </Button>
            </div>
          ) : (
            <p className="max-w-[200px] text-xs text-ink-50">
              已选定设计师或已结案，悬赏不可再修改。
            </p>
          )}
        </div>

        {isPaused ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            悬赏已暂停，设计师暂时无法新报名；恢复后可继续接收报名。
          </p>
        ) : null}
      </Card>

      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              报名设计师
            </h2>
            <p className="mt-1 text-sm text-ink-60">
              {bountyApplicantCount(bounty)} 位设计师已申请，可挑选合作方并发起沟通
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/bounties/${bounty.id}`}>
              <Megaphone className="h-3.5 w-3.5" /> 查看公开悬赏页
            </Link>
          </Button>
        </div>
        <BountyApplicantList
          bounty={bounty}
          designers={designers}
          onSelectDesigner={async (designerId) => {
            if (busy || bounty.status === "awarded") return;
            setBusy(true);
            try {
              const order = await awardBountyRequest(bounty.id, designerId);
              push({
                title: "已确认中标设计师",
                description: "平台订单已生成，请双方签约。",
                variant: "success",
              });
              refresh();
              router.push(`/client/orders/${order.id}`);
            } catch (e) {
              push({
                title: "操作失败",
                description: e instanceof Error ? e.message : "请稍后再试",
                variant: "destructive",
              });
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>

      <BountyEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        bounty={bounty}
        saving={busy}
        onSave={async (payload) => {
          await runAction(
            () => updateBountyRequest(bounty.id, payload),
            "悬赏信息已更新",
          );
          setEditOpen(false);
        }}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除悬赏</DialogTitle>
            <DialogDescription>
              删除后悬赏将永久移除，已报名设计师将收到通知。此操作不可撤销，确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="brand"
              className="bg-rose-600 hover:bg-rose-700"
              disabled={busy}
              onClick={handleDelete}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
