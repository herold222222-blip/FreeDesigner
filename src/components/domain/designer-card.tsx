"use client";

import Link from "next/link";
import Image from "next/image";
import type { Designer } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  OnlineDot,
  SpecialtyBadge,
  WorkloadBadge,
} from "@/components/domain/status-badges";
import { ActivityDot } from "@/components/domain/activity-dot";
import { DesignerLevelBadge, DesignerLevelCoefficientBadge } from "@/components/domain/level-badges";
import { FavoriteButton } from "@/components/domain/favorite-button";
import { DesignerCodeCopy } from "@/components/domain/designer-code-copy";
import { DesignerName } from "@/components/domain/designer-name";
import { MapPin, Star, Briefcase, Plane, PencilLine, Phone } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { getDesignerV11TimeRates } from "@/lib/designer-rates";
import { SUBJECT_TYPE_META } from "@/lib/constants";
import { Users, Building2, User } from "lucide-react";
import type { DesignerLevel } from "@/lib/types";
import { useDesignerContactPrivacy } from "@/lib/use-designer-contact-privacy";

export function DesignerCard({ designer }: { designer: Designer }) {
  const cover = designer.portfolio[0]?.cover;
  const level: DesignerLevel = designer.level ?? "mid_v1";
  const rates = getDesignerV11TimeRates({ ...designer, level });
  const { displayName, displayPhone, displayContactName, canViewFull } =
    useDesignerContactPrivacy(designer);

  return (
    <Card className="group overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-lg">
      <Link href={`/designers/${designer.id}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-ink-20">
          {cover ? (
            <Image
              src={cover}
              alt={displayName}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : null}
          <div className="absolute left-4 top-4 flex items-center gap-2">
            <Badge variant="default" className="bg-white/90 text-ink">
              <OnlineDot status={designer.onlineStatus} />
              {designer.onlineStatus === "online" ? "在线" : "离线"}
            </Badge>
          </div>
          <div className="absolute right-3 top-3" onClick={(e) => e.preventDefault()}>
            <FavoriteButton designerId={designer.id} />
          </div>
        </div>
      </Link>
      <div className="space-y-4 p-5">
        <Link href={`/designers/${designer.id}`} className="block">
          <div className="flex items-start gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12 ring-2 ring-white">
                <AvatarImage src={designer.avatar} alt={designer.name} />
                <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5">
                <ActivityDot level={designer.activityIndicator} size="sm" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="min-w-0 text-base font-semibold text-ink">
                  <DesignerName
                    designer={designer}
                    displayName={displayName}
                    className="max-w-full"
                  />
                </h3>
                <SpecialtyBadge specialty={designer.specialty} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <SubjectTypeBadge designer={designer} />
                <DesignerLevelBadge level={level} />
                <DesignerLevelCoefficientBadge level={level} />
              </div>
              <DesignerCardContactLines
                designer={designer}
                displayPhone={displayPhone}
                displayContactName={displayContactName}
                canDial={canViewFull}
              />
              <p className="mt-1 line-clamp-1 text-xs text-ink-60">
                {designer.tagline}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <WorkloadBadge status={designer.workloadStatus} />
            {designer.isOpenToTravel ? (
              <Badge variant="outline" className="gap-1">
                <Plane className="h-3 w-3" /> 支持出差
              </Badge>
            ) : null}
            {designer.supportsHandDrawing ? (
              <Badge variant="outline" className="gap-1">
                <PencilLine className="h-3 w-3" /> 支持手改图
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-ink-60">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {designer.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              {designer.yearsOfExperience} 年经验
            </span>
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {designer.rating}
            </span>
          </div>

          {designer.ratingBreakdown ? (
            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-ink-20/30 p-2 text-center text-[10px] text-ink-60">
              <div>
                <div className="font-semibold text-ink">
                  {designer.ratingBreakdown.professional.toFixed(1)}
                </div>
                <div>专业</div>
              </div>
              <div>
                <div className="font-semibold text-ink">
                  {designer.ratingBreakdown.service.toFixed(1)}
                </div>
                <div>服务</div>
              </div>
              <div>
                <div className="font-semibold text-ink">
                  {designer.ratingBreakdown.responsiveness.toFixed(1)}
                </div>
                <div>响应</div>
              </div>
            </div>
          ) : null}

          {designer.impressions && designer.impressions.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {designer.impressions.slice(0, 3).map((imp) => (
                <Badge key={imp.id} variant="muted" className="text-[10px]">
                  {imp.label} +{imp.count}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-4 border-t border-ink-20 pt-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-ink-60">
                按时间参考价
                <span className="ml-1 text-[10px] text-ink-40">
                  （v1.1 · {rates.trackLabel}）
                </span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
              <div className="rounded-lg bg-emerald-50/80 px-2.5 py-2">
                <div className="text-ink-50">线上（远程）</div>
                <div className="mt-0.5 font-semibold tabular-nums text-ink">
                  {formatCurrency(rates.remote.daily)}
                  <span className="ml-0.5 font-normal text-ink-60">/天</span>
                </div>
                <div className="mt-1 font-semibold tabular-nums text-brand">
                  {formatCurrency(rates.remote.monthly)}
                  <span className="ml-0.5 font-normal text-ink-60">/月</span>
                </div>
              </div>
              <div className="rounded-lg bg-amber-50/80 px-2.5 py-2">
                <div className="text-ink-50">线下（驻场）</div>
                <div className="mt-0.5 font-semibold tabular-nums text-ink">
                  {formatCurrency(rates.onsite.daily)}
                  <span className="ml-0.5 font-normal text-ink-60">/天</span>
                </div>
                <div className="mt-1 font-semibold tabular-nums text-brand">
                  {formatCurrency(rates.onsite.monthly)}
                  <span className="ml-0.5 font-normal text-ink-60">/月</span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-ink-40">
              单价 = v1.1 文档基准 × 综合系数{" "}
              {Math.round(rates.multiplier * 100)}
              %（设计师等级 × 地区梯队）；不含税与驻场含绘图加成。
            </p>
          </div>
        </Link>
      </div>
    </Card>
  );
}

function DesignerCardContactLines({
  designer,
  displayPhone,
  displayContactName,
  canDial,
}: {
  designer: Designer;
  displayPhone?: string;
  displayContactName?: string;
  canDial: boolean;
}) {
  const phone = displayPhone;
  const subjectType = designer.subjectType ?? "individual";
  const contactName =
    (subjectType === "team" || subjectType === "company") && displayContactName
      ? displayContactName
      : null;

  if (!phone && !designer.code) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-60">
      {phone ? (
        <div className="flex shrink-0 items-center gap-1">
          <Phone className="h-3 w-3 shrink-0 text-ink-40" aria-hidden />
          {contactName ? (
            <span className="text-ink-60">{contactName} · </span>
          ) : null}
          {canDial ? (
            <>
              <a
                href={`tel:${phone}`}
                className="text-brand underline-offset-2 hover:underline sm:hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {phone}
              </a>
              <span className="hidden sm:inline">{phone}</span>
            </>
          ) : (
            <span>{phone}</span>
          )}
        </div>
      ) : null}
      {designer.code ? (
        <DesignerCodeCopy
          code={designer.code}
          compact
          prefix="ID:"
          className="shrink-0 [&_span]:!font-sans [&_span]:!text-xs [&_span]:!text-ink-60"
        />
      ) : null}
    </div>
  );
}

function SubjectTypeBadge({ designer }: { designer: Designer }) {
  const type = designer.subjectType ?? "individual";
  const Icon = type === "company" ? Building2 : type === "team" ? Users : User;
  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="h-3 w-3" />
      {SUBJECT_TYPE_META[type].label}
    </Badge>
  );
}
