"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BountyApplyDialog } from "@/components/domain/bounty-apply-dialog";
import { useBounties } from "@/lib/use-data";
import { useDesigner } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import { bountyApplicantCount } from "@/lib/bounty-privacy";
import type { Bounty } from "@/lib/types";
import { Megaphone, Users } from "lucide-react";
import { formatBountyReward, formatDate } from "@/lib/utils";
import {
  designerCanAcceptOrders,
  portfolioReadinessHint,
} from "@/lib/designer-portfolio-readiness";

export default function DesignerBountiesPage() {
  const identityId = useRoleStore((s) => s.identityId);
  const { data: bounties, refresh } = useBounties();
  const { data: designer } = useDesigner(identityId);
  const push = useSessionStore((s) => s.pushNotification);
  const [applyTarget, setApplyTarget] = useState<Bounty | null>(null);

  const matchingBounties = designer
    ? bounties.filter((b) => b.specialty === designer.specialty)
    : bounties.filter((b) => b.status === "open");

  const canAccept = designer ? designerCanAcceptOrders(designer) : false;

  const handleApplyClick = (bounty: Bounty) => {
    if (!canAccept) {
      push({
        title: "请先上传项目类型案例",
        description: designer ? portfolioReadinessHint(designer) : undefined,
        variant: "destructive",
      });
      return;
    }
    setApplyTarget(bounty);
  };

  const handleApplySuccess = () => {
    push({
      title: "报名成功",
      description: "已提交报名，等待发布方查看。",
      variant: "success",
    });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            悬赏报名
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            根据你的专业自动推荐悬赏项目,主动报名争取合作。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/bounties">
            <Megaphone className="h-4 w-4" /> 浏览全部悬赏
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        {matchingBounties.map((b) => (
          <Card key={b.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Badge variant="brand">匹配你的专业</Badge>
                <Link
                  href={`/bounties/${b.id}`}
                  className="block text-base font-semibold text-ink hover:text-brand"
                >
                  {b.title}
                </Link>
                <p className="line-clamp-2 text-sm text-ink-60">
                  {b.description}
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-60">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> 已有{" "}
                    {bountyApplicantCount(b)} 位报名
                  </span>
                  <span>成果提交 {formatDate(b.deadline)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-xl font-bold text-brand">
                  {formatBountyReward(b.reward)}
                </div>
                {identityId && b.applicants.some((a) => a.designerId === identityId) ? (
                  <Button disabled variant="outline">
                    已报名
                  </Button>
                ) : (
                  <Button onClick={() => handleApplyClick(b)}>立即报名</Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {applyTarget ? (
        <BountyApplyDialog
          bounty={applyTarget}
          designer={designer}
          open={!!applyTarget}
          onOpenChange={(open) => {
            if (!open) setApplyTarget(null);
          }}
          onSuccess={handleApplySuccess}
        />
      ) : null}
    </div>
  );
}
