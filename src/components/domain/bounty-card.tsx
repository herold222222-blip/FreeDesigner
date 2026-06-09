import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Bounty } from "@/lib/types";
import { SPECIALTIES } from "@/lib/constants";
import { getTrackLabelParts } from "@/lib/bounty-filters";
import { CalendarDays, Coins, MapPin, Users } from "lucide-react";
import { bountyApplicantCount } from "@/lib/bounty-privacy";
import { formatBountyReward, formatDate } from "@/lib/utils";

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const specialty = SPECIALTIES.find((s) => s.value === bounty.specialty)!;
  const trackLabels = getTrackLabelParts(bounty.primaryTrack);
  return (
    <Link href={`/bounties/${bounty.id}`} className="group block">
      <Card className="h-full p-6 transition-all hover:border-ink hover:shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{specialty.label}</Badge>
              {trackLabels.l2 ? (
                <Badge variant="muted" className="text-[10px]">
                  {trackLabels.l2}
                </Badge>
              ) : null}
              {trackLabels.l3 ? (
                <Badge variant="outline" className="text-[10px]">
                  {trackLabels.l3}
                </Badge>
              ) : null}
              {bounty.status === "open" && (
                <Badge variant="emerald">开放报名</Badge>
              )}
              {bounty.status === "paused" && (
                <Badge variant="amber">已暂停</Badge>
              )}
              {bounty.status === "in_review" && (
                <Badge variant="amber">报名审核中</Badge>
              )}
              {bounty.status === "awarded" && (
                <Badge variant="muted">已选定</Badge>
              )}
              {bounty.status === "completed" && (
                <Badge variant="emerald">已完成</Badge>
              )}
            </div>
            <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-ink group-hover:text-brand">
              {bounty.title}
            </h3>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-40">悬赏金额</div>
            <div className="text-2xl font-bold tracking-tight text-brand">
              {formatBountyReward(bounty.reward)}
            </div>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-ink-60">
          {bounty.description}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-60">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {bounty.location.label}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> 成果提交 {formatDate(bounty.deadline)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {bountyApplicantCount(bounty)} 位设计师报名
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5" /> {bounty.attachments.length} 份资料附件
          </span>
        </div>
      </Card>
    </Link>
  );
}
