"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  STRUCTURE_L3_LABEL,
  STRUCTURE_SHEET_UNIT_PRICE,
  formatStructureSheetsLabel,
  parsePositiveIntSheets,
} from "@/lib/structure-sheets";

export function StructureSheetsPicker({
  enabled,
  onEnabledChange,
  mode,
  onModeChange,
  sheets,
  onSheetsChange,
  showEnableToggle = true,
  className,
}: {
  enabled: boolean;
  onEnabledChange?: (next: boolean) => void;
  mode: "pending" | "estimate" | "";
  onModeChange: (mode: "pending" | "estimate") => void;
  sheets: number | "";
  onSheetsChange: (next: number | "") => void;
  showEnableToggle?: boolean;
  className?: string;
}) {
  const estimateValid = parsePositiveIntSheets(sheets) != null;
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        enabled ? "border-ink bg-ink-20/25" : "border-ink-20",
        className,
      )}
    >
      {showEnableToggle ? (
        <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange?.(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            {STRUCTURE_L3_LABEL}
            <span className="ml-1.5 text-[11px] font-normal text-ink-40">
              {STRUCTURE_SHEET_UNIT_PRICE} 元/张
            </span>
          </span>
        </label>
      ) : (
        <div className="text-sm font-medium text-ink">
          {STRUCTURE_L3_LABEL}
          <span className="ml-1.5 text-[11px] font-normal text-ink-40">
            {STRUCTURE_SHEET_UNIT_PRICE} 元/张
          </span>
        </div>
      )}
      {enabled ? (
        <div className="mt-3 space-y-2 pl-6">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { v: "pending" as const, l: "不确定，待系统评估" },
                { v: "estimate" as const, l: "预估张数" },
              ] as const
            ).map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => {
                  onModeChange(m.v);
                  if (m.v === "estimate" && parsePositiveIntSheets(sheets) == null) {
                    onSheetsChange(1);
                  }
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  mode === m.v
                    ? "border-ink bg-ink text-white"
                    : "border-ink-20 text-ink-60 hover:border-ink/40",
                )}
              >
                {m.l}
              </button>
            ))}
            {mode === "estimate" ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  className="h-9 w-24"
                  value={sheets}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      onSheetsChange("");
                      return;
                    }
                    const n = Number(raw);
                    onSheetsChange(Number.isFinite(n) ? n : "");
                  }}
                />
                <span className="text-xs text-ink-40">张</span>
              </div>
            ) : null}
          </div>
          <p className="text-[11px] leading-relaxed text-ink-60">
            {mode === "estimate" && estimateValid
              ? `当前按 ${formatStructureSheetsLabel(Number(sheets))} 计入，费用 ${STRUCTURE_SHEET_UNIT_PRICE} × ${Number(sheets)} = ¥${(STRUCTURE_SHEET_UNIT_PRICE * Number(sheets)).toLocaleString("zh-CN")}。管理员后续仍可增改张数。`
              : mode === "pending"
                ? "先按 0 元占位，管理员确认张数后按 450 元/张计入订单。"
                : "请选择待系统评估，或自行填写大于零的整数张数。"}
          </p>
        </div>
      ) : (
        <p className="mt-1.5 pl-6 text-[11px] leading-relaxed text-ink-60">
          园建出图不含结构图。如需景观结构设计，请勾选后按张数报价。
        </p>
      )}
    </div>
  );
}
