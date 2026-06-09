import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DesignerProjectReview } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Star } from "lucide-react";

export function DesignerReviewCard({ review }: { review: DesignerProjectReview }) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">{review.projectTitle}</h3>
          <p className="mt-1 text-xs text-ink-60">
            {review.orderCode} · {review.projectType} · 委托人 {review.clientDisplayName}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="text-sm font-semibold tabular-nums text-ink">
            {review.overall.toFixed(1)}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-80">{review.content}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(
          [
            { key: "professional", label: "专业能力" },
            { key: "service", label: "服务态度" },
            { key: "responsiveness", label: "响应速度" },
          ] as const
        ).map((d) => (
          <div
            key={d.key}
            className="rounded-lg border border-ink-20/80 bg-ink-20/20 px-3 py-2 text-xs"
          >
            <span className="text-ink-50">{d.label}</span>
            <span className="ml-2 font-semibold tabular-nums text-ink">
              {review.breakdown[d.key].toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {review.impressionTags?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {review.impressionTags.map((t) => (
            <Badge key={t} variant="muted" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-[11px] text-ink-40">
        项目验收完成 · {formatDate(review.completedAt)}
      </p>
    </Card>
  );
}
