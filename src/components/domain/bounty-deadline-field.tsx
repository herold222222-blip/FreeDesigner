"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BOUNTY_VALID_UNTIL_HOURS,
  type BountyDeadlineDraft,
} from "@/lib/bounty-validity";

export function BountyDeadlineField({
  value,
  onChange,
  idPrefix = "bounty-deadline",
}: {
  value: BountyDeadlineDraft;
  onChange: (next: BountyDeadlineDraft) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex w-fit rounded-full border border-ink-20 p-0.5 text-xs">
        <button
          type="button"
          className={cn(
            "rounded-full px-3 py-1",
            value.mode === "negotiate" ? "bg-ink text-white" : "text-ink-60",
          )}
          onClick={() => onChange({ ...value, mode: "negotiate" })}
        >
          协商确定
        </button>
        <button
          type="button"
          className={cn(
            "rounded-full px-3 py-1",
            value.mode === "until" ? "bg-ink text-white" : "text-ink-60",
          )}
          onClick={() => onChange({ ...value, mode: "until" })}
        >
          指定整点时间
        </button>
      </div>
      {value.mode === "until" ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
          />
          <select
            id={`${idPrefix}-hour`}
            className="h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
            value={value.hour}
            onChange={(e) => onChange({ ...value, hour: e.target.value })}
          >
            <option value="">选择整点</option>
            {BOUNTY_VALID_UNTIL_HOURS.map((hour) => (
              <option key={hour} value={String(hour)}>
                {hour}点
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <p className="text-xs text-ink-40">
        {value.mode === "negotiate"
          ? "协商确定表示成果提交时间由双方另行约定。"
          : "精确到整点，例如 2026年10月21日15点。设计师须在此时间前提交设计成果。"}
      </p>
    </div>
  );
}
