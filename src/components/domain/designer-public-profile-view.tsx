"use client";

import Link from "next/link";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ActivityDot } from "@/components/domain/activity-dot";
import {
  OnlineDot,
  SpecialtyBadge,
  WorkloadBadge,
} from "@/components/domain/status-badges";
import {
  DesignerLevelBadge,
  DesignerLevelCoefficientBadge,
  RegionTierBadge,
} from "@/components/domain/level-badges";
import { FavoriteButton } from "@/components/domain/favorite-button";
import { DesignerCodeCopy } from "@/components/domain/designer-code-copy";
import { DesignerName } from "@/components/domain/designer-name";
import { ScanOrderQrDialog } from "@/components/domain/scan-order-qr-dialog";
import { DesignerSchedulePicker } from "@/components/domain/designer-schedule-picker";
import { DesignerRegistrationTags } from "@/components/domain/designer-registration-tags";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  Star,
} from "lucide-react";
import { getDesignerV11TimeRates } from "@/lib/designer-rates";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getOnlineMeetingTimeLabel } from "@/lib/designer-service-settings";
import { AdminConsoleReturnBar } from "@/components/layout/admin-console-return-bar";
import type { Designer, DesignerLevel } from "@/lib/types";
import { useDesignerContactPrivacy } from "@/lib/use-designer-contact-privacy";

export function DesignerPublicProfileView({
  designer,
  embedded = false,
  returnTo,
}: {
  designer: Designer;
  embedded?: boolean;
  /** 从管理后台用户管理进入时，提供返回列表链接 */
  returnTo?: string;
}) {
  const level: DesignerLevel = designer.level ?? "mid_v1";
  const timeRates = getDesignerV11TimeRates({ ...designer, level });
  const { displayName } = useDesignerContactPrivacy(designer);

  const portfolioGrouped = designer.portfolio.reduce<
    Record<string, typeof designer.portfolio>
  >((acc, p) => {
    acc[p.category] = acc[p.category] || [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const startOfMonth = new Date("2026-05-01");

  return (
    <div className={embedded ? "py-2" : "container-page py-10"}>
      {!embedded && returnTo ? (
        <div className="mb-6">
          <AdminConsoleReturnBar returnTo={returnTo} />
        </div>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Card className="p-8">
            <div className="flex flex-wrap items-start gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24 ring-4 ring-white">
                  <AvatarImage src={designer.avatar} alt={displayName} />
                  <AvatarFallback>{displayName.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-1">
                  <ActivityDot level={designer.activityIndicator} />
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-ink">
                  <DesignerName
                    designer={designer}
                    displayName={displayName}
                    symbolClassName="h-8 w-8 stroke-[3.5]"
                  />
                </h1>
                {designer.code ? (
                  <DesignerCodeCopy code={designer.code} />
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <DesignerLevelBadge level={level} />
                  <DesignerLevelCoefficientBadge level={level} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SpecialtyBadge specialty={designer.specialty} />
                  <Badge variant="outline" className="gap-1.5">
                    <OnlineDot status={designer.onlineStatus} />
                    {designer.onlineStatus === "online" ? "实时在线" : "离线"}
                  </Badge>
                  <WorkloadBadge status={designer.workloadStatus} />
                  {designer.regionTier ? (
                    <RegionTierBadge tier={designer.regionTier} />
                  ) : null}
                </div>
                <p className="text-base text-ink-60">{designer.tagline}</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-60">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {designer.location}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {designer.yearsOfExperience} 年从业
                  </span>
                  <Link
                    href={`/designers/${designer.id}/reviews`}
                    className="inline-flex items-center gap-1 rounded-md transition-colors hover:bg-amber-50 hover:text-brand"
                    title="查看历史评价"
                  >
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {designer.rating} ({designer.reviewCount} 条好评)
                  </Link>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    完成 {designer.completedProjects} 个项目
                  </span>
                </div>
                <DesignerRegistrationTags designer={designer} />
              </div>
            </div>
            <Separator className="my-7" />
            {(designer.education || designer.formerEmployers?.length) ? (
              <div className="mb-4 grid gap-2 text-sm text-ink-60 sm:grid-cols-2">
                {designer.education ? (
                  <div>
                    <span className="text-ink-40">学历 · </span>
                    {designer.education}
                  </div>
                ) : null}
                {designer.formerEmployers?.length ? (
                  <div>
                    <span className="text-ink-40">曾任职 · </span>
                    {designer.formerEmployers.join("、")}
                  </div>
                ) : null}
              </div>
            ) : null}
            <p className="text-sm leading-relaxed text-ink-60">{designer.bio}</p>
            {!embedded ? (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <FavoriteButton designerId={designer.id} variant="labeled" />
              </div>
            ) : null}
          </Card>

          {designer.ratingBreakdown ? (
            <Card className="p-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-ink">
                    评价 · 三维度
                  </h2>
                  <p className="mt-1 text-sm text-ink-60">
                    委托人完成项目验收后打分 · 共 {designer.reviewCount} 条
                  </p>
                  <Link
                    href={`/designers/${designer.id}/reviews`}
                    className="mt-2 inline-flex text-sm font-medium text-brand hover:underline"
                  >
                    查看全部历史评价 →
                  </Link>
                </div>
                <Link
                  href={`/designers/${designer.id}/reviews`}
                  className="flex items-baseline gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-amber-50"
                >
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span className="text-3xl font-semibold tracking-tight text-ink">
                    {designer.rating}
                  </span>
                  <span className="text-sm text-ink-60">/ 5</span>
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {(
                  [
                    { key: "professional", label: "专业能力" },
                    { key: "service", label: "服务态度" },
                    { key: "responsiveness", label: "响应速度" },
                  ] as const
                ).map((d) => {
                  const value = designer.ratingBreakdown![d.key];
                  return (
                    <div key={d.key} className="rounded-2xl border border-ink-20 p-4">
                      <div className="text-xs uppercase tracking-wider text-ink-40">
                        {d.label}
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-semibold tracking-tight text-ink">
                          {value.toFixed(1)}
                        </span>
                        <span className="text-xs text-ink-60">/ 5</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-20/40">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-amber-500"
                          style={{ width: `${(value / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {designer.impressions && designer.impressions.length ? (
                <div className="mt-6">
                  <div className="text-xs uppercase tracking-wider text-ink-40">
                    印象标签 · 委托人累计盖戳
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {designer.impressions.map((imp) => (
                      <Badge
                        key={imp.id}
                        variant="muted"
                        className="gap-1.5 px-3 py-1 text-sm"
                      >
                        {imp.label}
                        <span className="rounded-full bg-white px-1.5 text-[10px] font-semibold text-brand">
                          +{imp.count}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink">作品集</h2>
                <p className="mt-1 text-sm text-ink-60">
                  按项目类型分类展示 · 共 {designer.portfolio.length} 件
                </p>
              </div>
            </div>
            <div className="space-y-8">
              {Object.entries(portfolioGrouped).map(([category, items]) => (
                <div key={category}>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="default" className="bg-ink">
                      {category}
                    </Badge>
                    <span className="text-xs text-ink-40">{items.length} 件</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {items.map((p) => (
                      <div
                        key={p.id}
                        className="group relative overflow-hidden rounded-xl"
                      >
                        <Image
                          src={p.cover}
                          alt={p.title}
                          width={600}
                          height={400}
                          className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink/70 via-ink/0 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                          <div className="text-xs text-white">
                            <div className="font-medium">{p.title}</div>
                            <div className="opacity-70">{p.year}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-ink">接单档期</h2>
                <p className="mt-1 text-sm text-ink-60">
                  定向下单与线下上门均需在档期内选择 · 最少半天 · 线上会议时间{" "}
                  {designer.onlineMeetingTime
                    ? getOnlineMeetingTimeLabel(designer.onlineMeetingTime)
                    : designer.meetingFlexibility}
                </p>
              </div>
            </div>
            <DesignerSchedulePicker
              calendar={designer.calendar}
              value={[]}
              readOnly
              initialYear={startOfMonth.getFullYear()}
              initialMonth={startOfMonth.getMonth() + 1}
            />
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-6">
            <div className="text-xs uppercase tracking-wider text-ink-40">
              定向下单 · 立即合作
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-50">
              v1.1 按时间报价（{timeRates.trackLabel}）：文档线上/线下基准 × 综合系数{" "}
              {Math.round(timeRates.multiplier * 100)}%（等级 × 地区）
            </p>
            <div className="mt-3 grid gap-3">
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
                <div className="text-xs font-medium text-emerald-900/80">线上（远程）</div>
                <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                  {formatCurrency(timeRates.remote.daily)}
                  <span className="ml-1 text-xs font-normal text-ink-60">/ 工日</span>
                </div>
                <div className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-brand">
                  {formatCurrency(timeRates.remote.monthly)}
                  <span className="ml-1 text-xs font-normal text-ink-60">/ 月</span>
                </div>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4">
                <div className="text-xs font-medium text-amber-900/80">线下（驻场）</div>
                <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">
                  {formatCurrency(timeRates.onsite.daily)}
                  <span className="ml-1 text-xs font-normal text-ink-60">/ 工日</span>
                </div>
                <div className="mt-2 text-lg font-semibold tabular-nums tracking-tight text-brand">
                  {formatCurrency(timeRates.onsite.monthly)}
                  <span className="ml-1 text-xs font-normal text-ink-60">/ 月</span>
                </div>
                <p className="mt-2 text-[10px] leading-snug text-ink-40">
                  驻场含绘图时在基准上另 +10%（与费用计算器一致）
                </p>
              </div>
            </div>
            {!embedded ? (
              <>
                <div className="mt-2 text-[11px] text-ink-60">
                  按月雇佣：首月预付，每月 25 号前支付下月服务费
                </div>
                <Button asChild variant="brand" size="lg" className="mt-5 w-full">
                  <Link href={`/order/new?designer=${designer.id}`}>
                    <Sparkles className="h-4 w-4" /> 发起定向下单
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="mt-2 w-full">
                  <Link href={`/order/new?designer=${designer.id}&mode=onsite`}>
                    <Calendar className="h-4 w-4" /> 预约线下上门
                  </Link>
                </Button>
                <ScanOrderQrDialog
                  designerId={designer.id}
                  designerName={designer.name}
                />
              </>
            ) : (
              <p className="mt-3 text-[11px] text-ink-40">
                委托人可见的下单入口在预览中已隐藏，对外主页仍正常展示。
              </p>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-3 text-xs uppercase tracking-wider text-ink-40">最近活跃</div>
            <div className="flex items-center gap-3">
              <ActivityDot level={designer.activityIndicator} />
              <div className="text-sm text-ink-60">
                上次登录 · {formatDate(designer.lastActiveAt)}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-3 text-xs uppercase tracking-wider text-ink-40">平台保障</div>
            <ul className="space-y-2.5 text-sm text-ink-60">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>实名 + 资质审核通过的认证设计师</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>资金平台托管,30 天验收期保障售后</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>电子合同自动签署,永久存档可查</span>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
