"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BOUNTY_VALID_UNTIL_HOURS,
  type BountyValidUntilDraft,
} from "@/lib/bounty-validity";

export function BountyValidUntilField({
  value,
  onChange,
  idPrefix = "bounty-valid-until",
}: {
  value: BountyValidUntilDraft;
  onChange: (next: BountyValidUntilDraft) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex w-fit rounded-full border border-ink-20 p-0.5 text-xs">
        <button
          type="button"
          className={cn(
            "rounded-full px-3 py-1",
            value.mode === "unlimited" ? "bg-ink text-white" : "text-ink-60",
          )}
          onClick={() => onChange({ ...value, mode: "unlimited" })}
        >
          不限
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
        {value.mode === "unlimited"
          ? "不限表示悬赏可持续报名，直至你暂停、选定设计师或关闭。"
          : "精确到整点，例如 2026年9月1日15点。到期后设计师无法继续报名。"}
      </p>
    </div>
  );
}
