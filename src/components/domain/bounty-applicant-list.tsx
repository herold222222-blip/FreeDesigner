"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SpecialtyBadge } from "@/components/domain/status-badges";
import { Star } from "lucide-react";
import type { Bounty, Designer } from "@/lib/types";
import { getL3Label } from "@/lib/bounty-tracks";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";

type Props = {
  bounty: Bounty;
  designers: Designer[];
  onSelectDesigner?: (designerId: string) => void;
};

export function BountyApplicantList({
  bounty,
  designers,
  onSelectDesigner,
}: Props) {
  const push = useSessionStore((s) => s.pushNotification);
  const getDesignerById = (id: string) => designers.find((d) => d.id === id);

  if (bounty.applicants.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-ink-60">
        暂无设计师报名，请耐心等待或调整悬赏条件。
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bounty.applicants.map((a) => {
        const d = getDesignerById(a.designerId);
        if (!d) return null;
        return (
          <Card key={a.designerId} className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={d.avatar} alt={d.name} />
                <AvatarFallback>{d.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/designers/${d.id}`}
                    className="text-base font-semibold text-ink hover:text-brand"
                  >
                    {d.name}
                  </Link>
                  <SpecialtyBadge specialty={d.specialty} />
                  <span className="inline-flex items-center gap-1 text-xs text-ink-60">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {d.rating} · {d.completedProjects} 单经验
                  </span>
                </div>
                <p className="text-sm text-ink-80">{a.proposal}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-60">
                  {a.appliedL3 ? (
                    <span>
                      承接专业{" "}
                      <strong className="text-ink">
                        {getL3Label(bounty.specialty, a.appliedL3)}
                      </strong>
                    </span>
                  ) : null}
                  <span>
                    报价{" "}
                    <strong className="text-ink">
                      {formatCurrency(a.quotedAmount)}
                    </strong>
                  </span>
                  <span>
                    预计工期{" "}
                    <strong className="text-ink">{a.estimatedDays} 天</strong>
                  </span>
                  <span>报名 {formatDateTime(a.appliedAt)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  disabled={bounty.status === "awarded"}
                  onClick={() => {
                    if (onSelectDesigner) {
                      onSelectDesigner(a.designerId);
                      return;
                    }
                    push({
                      title: `已选择 ${d.name}`,
                      description: "将生成正式订单与电子合同（演示）。",
                      variant: "success",
                    });
                  }}
                >
                  {bounty.status === "awarded" ? "已选定" : "选择该设计师"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    push({
                      title: "私信沟通",
                      description: `已向 ${d.name} 发送沟通邀请（演示）。`,
                    })
                  }
                >
                  私信沟通
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
