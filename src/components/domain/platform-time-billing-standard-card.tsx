"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import {
  getPlatformTimeBillingReference,
  type TimeBillingReferenceTrack,
} from "@/lib/platform-time-billing-reference";
import type { PlatformPricingConfig } from "@/lib/platform-pricing";
import { formatCurrency, cn } from "@/lib/utils";

export function PlatformTimeBillingStandardCard({
  unit,
  config,
  highlightTrack,
  showOnsiteDrawingNote = false,
}: {
  unit: "day" | "month";
  config: PlatformPricingConfig;
  highlightTrack?: TimeBillingReferenceTrack | "";
  showOnsiteDrawingNote?: boolean;
}) {
  const reference = useMemo(
    () => getPlatformTimeBillingReference(unit, config),
    [unit, config],
  );

  const title =
    unit === "day" ? "平台按天计费标准参考" : "平台按月雇佣标准参考";

  const colClass = (track: TimeBillingReferenceTrack) =>
    cn(
      "rounded-md px-1.5 py-1 text-center",
      highlightTrack === track && "bg-brand/10 ring-1 ring-brand/30",
    );

  return (
    <div className="rounded-xl border border-brand/25 bg-gradient-to-br from-brand/8 to-amber-50/80 p-3.5">
      <div className="flex items-center gap-2 overflow-x-auto">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2 whitespace-nowrap text-[11px] leading-none">
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span className="text-ink-30">·</span>
          <span className="text-ink-60">{reference.exampleNote}</span>
        </div>
      </div>

      <div className="mt-2.5 overflow-x-auto">
        <div
          className="grid min-w-[28rem] gap-x-1 gap-y-0.5"
          style={{
            gridTemplateColumns: `3.25rem repeat(${reference.rows.length}, minmax(0, 1fr))`,
          }}
        >
          <div />
          {reference.rows.map((row) => (
            <div
              key={`head-${row.track}`}
              className={cn(colClass(row.track), "pb-0.5 text-[11px] font-medium text-ink")}
            >
              {row.trackLabel}
              {highlightTrack === row.track ? (
                <span className="ml-0.5 text-[9px] font-normal text-brand">·</span>
              ) : null}
            </div>
          ))}

          {(["线上", "驻场"] as const).map((mode) => (
            <RateRow
              key={mode}
              mode={mode}
              rows={reference.rows}
              unitSuffix={reference.unitSuffix}
              colClass={colClass}
            />
          ))}
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-ink-40">
        {reference.formulaNote}
        {showOnsiteDrawingNote ? " · 驻场含绘图额外 +10%" : ""}
      </p>
    </div>
  );
}

function RateRow({
  mode,
  rows,
  unitSuffix,
  colClass,
}: {
  mode: "线上" | "驻场";
  rows: ReturnType<typeof getPlatformTimeBillingReference>["rows"];
  unitSuffix: string;
  colClass: (track: TimeBillingReferenceTrack) => string;
}) {
  return (
    <>
      <div className="flex items-center text-[10px] text-ink-50">{mode}</div>
      {rows.map((row) => (
        <div
          key={`${mode}-${row.track}`}
          className={cn(colClass(row.track), "text-[11px] tabular-nums text-ink-70")}
        >
          <span className="font-semibold text-ink">
            {formatCurrency(mode === "线上" ? row.remote : row.onsite)}
          </span>
          <span className="text-ink-50">/{unitSuffix}</span>
        </div>
      ))}
    </>
  );
}
