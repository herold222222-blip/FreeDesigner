"use client";

import { cn } from "@/lib/utils";
import {
  difficultyOptionKey,
  type LandscapeAreaDifficultyOption,
} from "@/lib/landscape-area-difficulty";

export function LandscapeAreaDifficultyCards({
  options,
  selectedValue,
  selectedKey,
  onSelect,
  heading,
  missingHint,
  className,
}: {
  options: LandscapeAreaDifficultyOption[];
  selectedValue?: number;
  selectedKey?: string;
  onSelect: (opt: LandscapeAreaDifficultyOption) => void;
  heading?: string;
  missingHint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        heading
          ? "mt-3 border-t border-dashed border-ink-20/70 pt-3"
          : undefined,
        className,
      )}
    >
      {heading ? (
        <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-40">
          {heading}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const key = difficultyOptionKey(opt);
          const selected =
            selectedKey != null
              ? selectedKey === key
              : selectedValue === opt.value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(opt)}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-left text-[11px] leading-snug transition-colors",
                selected
                  ? "border-brand/40 bg-brand/5"
                  : "border-ink-20/80 bg-white/60 hover:border-brand/40",
              )}
            >
              <span className="font-semibold text-ink">
                {opt.label} · {Math.round(opt.value * 100)}%
              </span>
              <span className="mt-1 block text-ink-60">{opt.remark}</span>
            </button>
          );
        })}
      </div>
      {missingHint ? (
        <p className="mt-1.5 text-[10px] text-rose-500">{missingHint}</p>
      ) : null}
    </div>
  );
}
