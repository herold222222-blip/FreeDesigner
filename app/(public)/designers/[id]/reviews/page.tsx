"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DesignerReviewCard } from "@/components/domain/designer-review-card";
import { DesignerName } from "@/components/domain/designer-name";
import { DesignerLevelBadge } from "@/components/domain/level-badges";
import { SpecialtyBadge } from "@/components/domain/status-badges";
import { ArrowLeft, Star } from "lucide-react";
import type { DesignerLevel } from "@/lib/types";
import { useDesigner, useDesignerReviews } from "@/lib/use-data";

export default function DesignerReviewsPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: designer, loading } = useDesigner(params.id);
  const { data: reviews } = useDesignerReviews(params.id);

  if (loading) {
    return (
      <div className="container-page py-20 text-center text-ink-60">
        正在加载历史评价...
      </div>
    );
  }
  if (!designer) {
    return (
      <div className="container-page py-20 text-center text-ink-60">
        未找到该设计师。
      </div>
    );
  }

  const level: DesignerLevel = designer.level ?? "mid_v1";

  return (
    <div className="container-page py-10">
      <Link
        href={`/designers/${designer.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回设计师主页
      </Link>

      <Card className="mb-8 p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={designer.avatar} alt={designer.name} />
            <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              <DesignerName designer={designer} />
              <span className="text-ink-60"> · 历史评价</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DesignerLevelBadge level={level} />
              <SpecialtyBadge specialty={designer.specialty} />
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1">
              <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
              <span className="text-3xl font-semibold tabular-nums text-ink">
                {designer.rating}
              </span>
              <span className="text-sm text-ink-60">/ 5</span>
            </div>
            <p className="mt-1 text-xs text-ink-60">
              共 {designer.reviewCount} 条好评 · 本页展示 {reviews.length} 条
            </p>
          </div>
        </div>

        {designer.ratingBreakdown ? (
          <div className="mt-6 grid gap-3 border-t border-ink-20 pt-6 sm:grid-cols-3">
            {(
              [
                { key: "professional", label: "专业能力" },
                { key: "service", label: "服务态度" },
                { key: "responsiveness", label: "响应速度" },
              ] as const
            ).map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between rounded-xl bg-ink-20/30 px-4 py-3 text-sm"
              >
                <span className="text-ink-60">{d.label}</span>
                <span className="font-semibold tabular-nums text-ink">
                  {designer.ratingBreakdown![d.key].toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {designer.impressions?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {designer.impressions.map((imp) => (
              <Badge key={imp.id} variant="muted" className="gap-1.5">
                {imp.label}
                <span className="text-[10px] font-semibold text-brand">+{imp.count}</span>
              </Badge>
            ))}
          </div>
        ) : null}
      </Card>

      <p className="mb-4 text-sm text-ink-60">
        以下为委托人完成项目验收后的真实评价，按完成时间倒序排列。
      </p>

      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card className="p-12 text-center text-ink-60">暂无历史评价</Card>
        ) : (
          reviews.map((r) => <DesignerReviewCard key={r.id} review={r} />)
        )}
      </div>
    </div>
  );
}
