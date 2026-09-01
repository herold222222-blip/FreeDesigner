"use client";

import { cn } from "@/lib/utils";
import { maskBountyHallTitle } from "@/lib/bounty-hall-privacy";
import type { Bounty, BountyTitleVisibility } from "@/lib/types";

const PREVIEW_FALLBACK = "广州御龙湾府景观园建施工图设计";

export function BountyTitleVisibilityField({
  value,
  onChange,
  title,
  primaryTrack,
}: {
  value: BountyTitleVisibility | null;
  onChange: (next: BountyTitleVisibility) => void;
  title?: string;
  primaryTrack?: Bounty["primaryTrack"];
}) {
  const preview = maskBountyHallTitle(
    title?.trim() || PREVIEW_FALLBACK,
    primaryTrack ? { primaryTrack } : undefined,
  );

  return (
    <div className="space-y-2">
      <div className="flex w-fit rounded-full border border-ink-20 p-0.5 text-xs">
        <button
          type="button"
          className={cn(
            "rounded-full px-3 py-1",
            value === "public" ? "bg-ink text-white" : "text-ink-60",
          )}
          onClick={() => onChange("public")}
        >
          公开显示
        </button>
        <button
          type="button"
          className={cn(
            "rounded-full px-3 py-1",
            value === "masked" ? "bg-ink text-white" : "text-ink-60",
          )}
          onClick={() => onChange("masked")}
        >
          脱敏显示
        </button>
      </div>
      <p className="text-xs text-ink-40">
        {value === "public"
          ? "悬赏大厅对外展示完整项目名称。"
          : value === "masked"
            ? `大厅只显示首字和专业相关内容，例如「${preview}」。`
            : "请选择项目名称在大厅公开显示还是脱敏显示。"}
      </p>
    </div>
  );
}
