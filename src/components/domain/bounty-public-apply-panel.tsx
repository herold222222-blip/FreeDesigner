"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BountyApplyDialog } from "@/components/domain/bounty-apply-dialog";
import { useDesigner } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import {
  designerCanAcceptOrders,
  portfolioReadinessHint,
} from "@/lib/designer-portfolio-readiness";
import type { Bounty, Role } from "@/lib/types";
import { BountyRewardAmount } from "@/components/domain/bounty-reward-amount";
import {
  formatBountyDeadline,
  formatBountyValidUntilLabel,
  isBountyOpenForApply,
} from "@/lib/bounty-validity";
import { Coins } from "lucide-react";
import { BountyPaymentStagesList } from "@/components/domain/bounty-payment-stages-list";

export function BountyPublicApplyPanel({
  bounty,
  applicantCount,
  alreadyApplied,
  viewerRole,
}: {
  bounty: Bounty;
  applicantCount: number;
  alreadyApplied: boolean;
  viewerRole: Role | "guest";
}) {
  const router = useRouter();
  const identityId = useRoleStore((s) => s.identityId);
  const { data: designer } = useDesigner(
    viewerRole === "designer" ? identityId : null,
  );
  const push = useSessionStore((s) => s.pushNotification);
  const [applyOpen, setApplyOpen] = useState(false);

  const open = isBountyOpenForApply(bounty);
  const showApply =
    viewerRole !== "client" &&
    viewerRole !== "admin" &&
    viewerRole !== "super_admin";

  const handleApplyClick = () => {
    if (!open || alreadyApplied) return;
    if (viewerRole !== "designer") return;
    if (designer && !designerCanAcceptOrders(designer)) {
      push({
        title: "请先上传项目类型案例",
        description: portfolioReadinessHint(designer),
        variant: "destructive",
      });
      return;
    }
    setApplyOpen(true);
  };

  return (
    <>
      <Card className="p-8">
        <div className="text-xs uppercase tracking-wider text-ink-40">
          悬赏金额
        </div>
        <BountyRewardAmount
          bounty={bounty}
          viewerRole={viewerRole}
          showInvoice
          className="mt-2"
          amountClassName="text-3xl"
        />
        <p className="mt-1 text-xs text-ink-60">
          选定设计师后资金转入平台托管
        </p>
        <BountyPaymentStagesList bounty={bounty} className="mt-4" />

        <Separator className="my-5" />

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-60">悬赏有效期</span>
            <span className="font-medium text-ink">
              {formatBountyValidUntilLabel(bounty.validUntil)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-60">成果提交时间</span>
            <span className="font-medium text-ink">
              {formatBountyDeadline(bounty.deadline)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-60">报名设计师</span>
            <span className="font-medium text-ink">{applicantCount} 位</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-60">资料附件</span>
            <span className="font-medium text-ink">
              {bounty.attachments.length} 份
            </span>
          </div>
        </div>

        {showApply ? (
          alreadyApplied ? (
            <Button disabled variant="outline" size="lg" className="mt-6 w-full">
              已报名
            </Button>
          ) : !open ? (
            <Button disabled variant="outline" size="lg" className="mt-6 w-full">
              {bounty.status === "open"
                ? "有效期已过"
                : bounty.status === "awarded" || bounty.awardedDesignerId
                  ? "已选定设计师，不可报名"
                  : "报名已结束"}
            </Button>
          ) : viewerRole === "designer" ? (
            <Button
              variant="brand"
              size="lg"
              className="mt-6 w-full"
              onClick={handleApplyClick}
            >
              <Coins className="h-4 w-4" /> 立即报名
            </Button>
          ) : (
            <Button asChild variant="brand" size="lg" className="mt-6 w-full">
              <Link
                href={`/login?role=designer&redirect=${encodeURIComponent(`/bounties/${bounty.id}`)}`}
              >
                <Coins className="h-4 w-4" /> 我是设计师 · 立即报名
              </Link>
            </Button>
          )
        ) : null}
      </Card>

      {viewerRole === "designer" ? (
        <BountyApplyDialog
          bounty={bounty}
          designer={designer ?? null}
          open={applyOpen}
          onOpenChange={setApplyOpen}
          onSuccess={() => {
            push({
              title: "报名成功",
              description: "已提交报名，等待发布方查看。",
              variant: "success",
            });
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
