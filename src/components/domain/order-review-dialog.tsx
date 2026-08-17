"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RatingBreakdown } from "@/lib/types";

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-60">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="rounded p-0.5 hover:bg-ink-20/40"
            onClick={() => onChange(n)}
            aria-label={`${label} ${n} 星`}
          >
            <Star
              className={cn(
                "h-5 w-5",
                n <= value ? "fill-amber-400 text-amber-400" : "text-ink-20",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function OrderReviewDialog({
  open,
  onOpenChange,
  designerName,
  deadlineHint,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  designerName: string;
  deadlineHint?: string | null;
  onSubmit: (payload: {
    overall: number;
    breakdown: RatingBreakdown;
    content: string;
    anonymous: boolean;
  }) => Promise<void>;
}) {
  const [breakdown, setBreakdown] = useState<RatingBreakdown>({
    professional: 5,
    service: 5,
    responsiveness: 5,
  });
  const [content, setContent] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);

  const overall =
    Math.round(
      ((breakdown.professional +
        breakdown.service +
        breakdown.responsiveness) /
        3) *
        10,
    ) / 10;

  const handleSubmit = async () => {
    if (busy) return;
    if (!content.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ overall, breakdown, content: content.trim(), anonymous });
      onOpenChange(false);
      setContent("");
      setAnonymous(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>评价设计师</DialogTitle>
          <DialogDescription>
            对 {designerName} 在本项目中的表现进行评分和评论
            {deadlineHint ? `。${deadlineHint}` : "（最后一笔费用支付后 30 天内有效）。"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <StarRow
            label="专业能力"
            value={breakdown.professional}
            onChange={(v) =>
              setBreakdown((b) => ({ ...b, professional: v }))
            }
          />
          <StarRow
            label="服务态度"
            value={breakdown.service}
            onChange={(v) => setBreakdown((b) => ({ ...b, service: v }))}
          />
          <StarRow
            label="响应速度"
            value={breakdown.responsiveness}
            onChange={(v) =>
              setBreakdown((b) => ({ ...b, responsiveness: v }))
            }
          />
          <Textarea
            placeholder="请填写评价内容"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-ink-20 accent-brand"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            <span>
              匿名评价
              <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-40">
                勾选后，历史评价仅显示项目名首字和末两字、委托人姓氏，其余用 * 代替。
              </span>
            </span>
          </label>
        </div>
        <Button
          variant="brand"
          className="w-full"
          disabled={busy || !content.trim()}
          onClick={handleSubmit}
        >
          {busy ? "提交中..." : "提交评价"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
