"use client";

import { Badge } from "@/components/ui/badge";
import { resolveTrackLabels } from "@/lib/constants";
import {
  getOnlineMeetingTimeLabel,
  getTravelDurationLabel,
} from "@/lib/designer-service-settings";
import type { Designer, Specialty } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Clock, Globe, PencilLine, Plane } from "lucide-react";

function formatTrackLabel(track: { l1: Specialty; l2: string; l3: string }) {
  const { l1Label, l2Label, l3Label } = resolveTrackLabels(
    track.l1,
    track.l2,
    track.l3,
  );
  return { l1Label, l2Label, l3Label, full: `${l1Label} · ${l2Label} · ${l3Label}` };
}

function TrackSpecialtyCard({
  title,
  tracks,
  variant,
}: {
  title: string;
  tracks: { l1: Specialty; l2: string; l3: string }[];
  variant: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3 shadow-sm",
        isPrimary
          ? "border-amber-300/90 bg-gradient-to-br from-amber-50 via-amber-50/90 to-orange-100/70"
          : "border-sky-300/90 bg-gradient-to-br from-sky-50 via-sky-50/90 to-indigo-100/60",
      )}
    >
      <div
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider",
          isPrimary ? "text-amber-800/80" : "text-sky-800/80",
        )}
      >
        {title}
      </div>
      {tracks.length > 0 ? (
        <div className="mt-2 space-y-2">
          {tracks.map((track) => {
            const { l1Label, l2Label, l3Label } = formatTrackLabel(track);
            return (
              <div key={`${track.l1}-${track.l2}-${track.l3}`}>
                <div
                  className={cn(
                    "text-sm font-semibold leading-snug",
                    isPrimary ? "text-amber-950" : "text-sky-950",
                  )}
                >
                  {l1Label}
                </div>
                <div
                  className={cn(
                    "mt-0.5 text-xs leading-snug",
                    isPrimary ? "text-amber-900/75" : "text-sky-900/75",
                  )}
                >
                  {l2Label} · {l3Label}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 text-xs text-ink-40">
          {isPrimary ? "未设置" : "无"}
        </div>
      )}
    </div>
  );
}

function ServiceTag({
  label,
  positive,
  icon: Icon,
}: {
  label: string;
  positive?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[11px] font-normal leading-snug",
        positive
          ? "border-emerald-200/80 bg-emerald-50/50 text-ink"
          : "border-ink-20 bg-ink-20/20 text-ink-60",
      )}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" /> : null}
      {label}
    </Badge>
  );
}

/** 入驻服务设置 12–19 + 擅长项目类型（案例同步） */
export function DesignerRegistrationTags({ designer }: { designer: Designer }) {
  const acceptTravel = designer.isOpenToTravel;
  const travelDetail = acceptTravel
    ? getTravelDurationLabel(designer.travelDuration) || "已接受"
    : null;
  const overseas =
    designer.hasOverseasExperience && designer.overseasCountries?.length
      ? designer.overseasCountries.join("、")
      : null;
  const meetingLabel = designer.onlineMeetingTime
    ? getOnlineMeetingTimeLabel(designer.onlineMeetingTime)
    : designer.meetingFlexibility || "未设置";

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        <ServiceTag label={`在职 · ${designer.isInJob ? "是" : "否"}`} positive={designer.isInJob} />

        <ServiceTag
          label={`改图服务 · ${designer.supportsHandDrawing ? "接受" : "不接受"}`}
          positive={designer.supportsHandDrawing}
          icon={PencilLine}
        />

        <ServiceTag
          label={
            acceptTravel
              ? `出差 · 是${travelDetail ? ` · ${travelDetail}` : ""}`
              : "出差 · 否"
          }
          positive={acceptTravel}
          icon={Plane}
        />

        <ServiceTag
          label={`背靠背合同 · ${designer.acceptBackToBackContract ? "接受" : "不接受"}`}
          positive={designer.acceptBackToBackContract}
        />

        <ServiceTag
          label={
            designer.hasOverseasExperience
              ? `境外项目 · 是${overseas ? ` · ${overseas}` : ""}`
              : "境外项目 · 否"
          }
          positive={designer.hasOverseasExperience}
          icon={Globe}
        />

        <ServiceTag
          label={`按时间计费 · ${designer.acceptTimeBilling !== false ? "是" : "否"}`}
          positive={designer.acceptTimeBilling !== false}
        />

        <ServiceTag
          label={`现场服务经验 · ${designer.hasOnsiteExperience ? "是" : "否"}`}
          positive={!!designer.hasOnsiteExperience}
        />

        <ServiceTag
          label={`线上会议 · ${meetingLabel}`}
          positive
          icon={Clock}
        />
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-medium text-ink-40">
          擅长项目类型 · 根据上传案例同步
        </div>
        <div className="flex flex-wrap gap-1.5">
          {designer.projectTypeTags.length > 0 ? (
            designer.projectTypeTags.map((t) => (
              <Badge key={t} variant="muted" className="text-[11px] font-normal">
                {t}
              </Badge>
            ))
          ) : (
            <Badge variant="outline" className="text-[11px] font-normal text-ink-60">
              暂无案例分类，上传作品后自动展示
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <TrackSpecialtyCard
          title="主专业"
          variant="primary"
          tracks={designer.primaryTrack ? [designer.primaryTrack] : []}
        />
        <TrackSpecialtyCard
          title="副专业"
          variant="secondary"
          tracks={designer.secondaryTracks ?? []}
        />
      </div>
    </div>
  );
}
