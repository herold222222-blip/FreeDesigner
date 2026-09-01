"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Bounty } from "@/lib/types";
import { SPECIALTIES } from "@/lib/constants";
import { getTrackLabelParts } from "@/lib/bounty-filters";
import { CalendarDays, Clock, Coins, MapPin, Users } from "lucide-react";
import { bountyApplicantCount } from "@/lib/bounty-privacy";
import {
  maskGuestBountyDeadline,
  maskGuestBountyValidUntil,
} from "@/lib/bounty-guest-privacy";
import { isBountyHallAwardedGroup } from "@/lib/bounty-hall-privacy";
import { cn } from "@/lib/utils";
import { BountyRewardAmount } from "@/components/domain/bounty-reward-amount";
import {
  formatBountyDeadline,
  formatBountyValidUntil,
  isBountyValidityExpired,
} from "@/lib/bounty-validity";
import { parseRegularEntrustDescription } from "@/lib/entrust-description";
import { MemberLink } from "@/components/domain/member-link";
import { useRoleStore } from "@/store/role-store";

function bountyCardSummary(description: string) {
  const parsed = parseRegularEntrustDescription(description);
  const brief = parsed.brief.trim();
  const contactBits = [
    parsed.contact?.contactName
      ? `联系人 ${parsed.contact.contactName}`
      : null,
    parsed.contact?.contactPhone
      ? `电话 ${parsed.contact.contactPhone}`
      : null,
  ].filter((bit): bit is string => Boolean(bit));
  return {
    brief: brief || (contactBits.length ? "" : description.trim()),
    contactLine: contactBits.join(" · "),
  };
}

export function BountyCard({ bounty }: { bounty: Bounty }) {
  const role = useRoleStore((s) => s.role);
  const isGuest = role === "guest";
  const awarded = isBountyHallAwardedGroup(bounty);
  const specialty = SPECIALTIES.find((s) => s.value === bounty.specialty)!;
  const trackLabels = getTrackLabelParts(bounty.primaryTrack);

  const title = bounty.title;
  const { brief, contactLine } = bountyCardSummary(bounty.description);
  const deadlineText = formatBountyDeadline(bounty.deadline);
  const deadlineDisplay = isGuest
    ? maskGuestBountyDeadline(deadlineText)
    : deadlineText;
  const validUntilText = formatBountyValidUntil(bounty.validUntil);
  const validUntilDisplay = isGuest
    ? maskGuestBountyValidUntil(validUntilText)
    : validUntilText;
  const expired = isBountyValidityExpired(bounty.validUntil);

  return (
    <MemberLink href={`/bounties/${bounty.id}`} className="group block">
      <Card
        className={cn(
          "h-full p-6 transition-all",
          awarded
            ? "border-ink-20/80 bg-ink-20/20 text-ink-60 opacity-70 grayscale hover:border-ink-20 hover:shadow-none"
            : "hover:border-ink hover:shadow-md",
        )}
      >
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
              {bounty.status === "open" && !expired && (
                <Badge variant="emerald">开放报名</Badge>
              )}
              {bounty.status === "open" && expired && (
                <Badge variant="amber">已过期</Badge>
              )}
              {bounty.status === "paused" && (
                <Badge variant="amber">已暂停</Badge>
              )}
              {bounty.status === "in_review" && (
                <Badge variant="amber">报名审核中</Badge>
              )}
              {awarded && (
                <Badge variant="muted">已选定 · 不可报名</Badge>
              )}
              {bounty.status === "completed" && (
                <Badge variant="emerald">已完成</Badge>
              )}
            </div>
            <h3
              className={cn(
                "line-clamp-2 text-lg font-semibold leading-snug",
                awarded
                  ? "text-ink-60"
                  : "text-ink group-hover:text-brand",
              )}
            >
              {title}
            </h3>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs text-ink-40">悬赏金额</div>
            <BountyRewardAmount
              bounty={bounty}
              viewerRole={role}
              amountClassName="text-2xl"
            />
          </div>
        </div>
        <div className="mt-3 h-10 overflow-hidden text-sm leading-5 text-ink-60">
          {contactLine ? (
            <>
              <div className="truncate">{brief || "暂无项目说明"}</div>
              <div className="truncate text-ink-40">{contactLine}</div>
            </>
          ) : (
            <div className="line-clamp-2">{brief}</div>
          )}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-60">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {bounty.location.label}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> 有效期 {validUntilDisplay}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" /> 成果提交 {deadlineDisplay}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> {bountyApplicantCount(bounty)} 位设计师报名
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5" /> {bounty.attachments.length} 份资料附件
          </span>
        </div>
      </Card>
    </MemberLink>
  );
}
