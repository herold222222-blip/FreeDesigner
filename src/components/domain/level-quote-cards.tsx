"use client";

import type { DesignerLevel, OrderQuote } from "@/lib/types";
import {
  CLIENT_LEVEL_META,
  DESIGNER_LEVEL_META,
  REGION_TIER_META,
} from "@/lib/constants";
import { CLIENT_QUOTE_LEVELS, getQuoteOrderTotal } from "@/lib/regular-entrust-quote";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function LevelQuoteCards({
  quotes,
  selectedLevels = [],
  selectable = false,
  onToggle,
}: {
  quotes: OrderQuote[];
  selectedLevels?: DesignerLevel[];
  selectable?: boolean;
  onToggle?: (level: DesignerLevel) => void;
}) {
  const byLevel = new Map<DesignerLevel, OrderQuote>();
  for (const q of quotes) {
    byLevel.set(q.assumptions.designerLevel, q);
  }
  const cards = CLIENT_QUOTE_LEVELS.map((level) => byLevel.get(level)).filter(
    Boolean,
  ) as OrderQuote[];
  const displayCards = cards.length ? cards : quotes;
  if (!displayCards.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {displayCards.map((quote) => {
        const level = quote.assumptions.designerLevel;
        const meta = DESIGNER_LEVEL_META[level];
        const selected = selectedLevels.includes(level);
        return (
          <button
            key={level}
            type="button"
            disabled={!selectable}
            onClick={() => onToggle?.(level)}
            className={cn(
              "rounded-2xl border p-3.5 text-left transition-colors",
              selected
                ? "border-brand bg-brand/5 ring-1 ring-brand/30"
                : "border-ink-20 bg-white",
              selectable && !selected && "hover:border-ink/30",
              !selectable && "cursor-default",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 text-sm font-semibold leading-snug text-ink">
                {meta.label}
              </div>
              {selectable ? (
                selected ? (
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <Check className="h-3 w-3" />
                  </span>
                ) : (
                  <span className="inline-flex h-5 w-5 shrink-0 rounded-full border border-ink-20" />
                )
              ) : null}
            </div>

            <dl className="mt-2.5 space-y-1 rounded-lg bg-ink-20/25 px-2.5 py-2 text-[10px] leading-none text-ink-60">
              <CoeffRow
                label="等级"
                value={`×${meta.coefficient.toFixed(2)}`}
              />
              <CoeffRow
                label="地区"
                value={`×${
                  quote.assumptions.serviceMode === "remote"
                    ? "1.00"
                    : REGION_TIER_META[quote.assumptions.designerRegion].coefficient.toFixed(2)
                }`}
                tip={
                  quote.assumptions.serviceMode === "remote"
                    ? "远程服务统一按 1.0"
                    : REGION_TIER_META[quote.assumptions.designerRegion].label
                }
              />
              <CoeffRow
                label="客户"
                value={`×${CLIENT_LEVEL_META[quote.assumptions.clientLevel].coefficient.toFixed(2)}`}
                tip={CLIENT_LEVEL_META[quote.assumptions.clientLevel].label}
              />
              <CoeffRow
                label="税率"
                value={`×${quote.taxCoefficient.toFixed(2)}`}
              />
            </dl>

            <div className="mt-3 border-t border-ink-20/80 pt-2.5">
              <div className="text-[10px] leading-none text-ink-40">
                订单总额（含税）
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums tracking-tight text-brand">
                {formatCurrency(getQuoteOrderTotal(quote))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CoeffRow({
  label,
  value,
  tip,
}: {
  label: string;
  value: string;
  tip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="shrink-0 whitespace-nowrap text-ink-40">{label}</dt>
      <dd className="min-w-0 truncate text-right tabular-nums text-ink">
        <span className="font-medium">{value}</span>
        {tip ? (
          <span className="ml-1 font-normal text-ink-40">· {tip}</span>
        ) : null}
      </dd>
    </div>
  );
}
