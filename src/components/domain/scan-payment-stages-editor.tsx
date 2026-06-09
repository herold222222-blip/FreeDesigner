"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SCAN_PAYMENT_PRESETS,
  newStageId,
  paymentStagesTotalRatio,
  paymentStagesValid,
  type ScanPaymentStageDraft,
} from "@/lib/scan-order";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export function ScanPaymentStagesEditor({
  stages,
  onChange,
  totalAmount,
  className,
}: {
  stages: ScanPaymentStageDraft[];
  onChange: (stages: ScanPaymentStageDraft[]) => void;
  totalAmount: number;
  className?: string;
}) {
  const ratioSum = paymentStagesTotalRatio(stages);
  const valid = paymentStagesValid(stages);

  const applyPreset = (index: number) => {
    const preset = SCAN_PAYMENT_PRESETS[index];
    onChange(preset.stages.map((s) => ({ ...s, id: newStageId() })));
  };

  const updateStage = (id: string, patch: Partial<ScanPaymentStageDraft>) => {
    onChange(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStage = (id: string) => {
    if (stages.length <= 1) return;
    onChange(stages.filter((s) => s.id !== id));
  };

  const addStage = () => {
    const remain = Math.max(0, 100 - ratioSum);
    onChange([
      ...stages,
      { id: newStageId(), name: `阶段 ${stages.length + 1}`, ratio: remain || 10 },
    ]);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-base font-semibold text-ink">付款阶段</Label>
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            valid ? "text-emerald-700" : "text-amber-700",
          )}
        >
          比例合计 {ratioSum}% {valid ? "✓" : "（须等于 100%）"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {SCAN_PAYMENT_PRESETS.map((p, i) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => applyPreset(i)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="grid gap-2 rounded-xl border border-ink-20 bg-ink-20/20 p-3 sm:grid-cols-[1fr_88px_88px_auto]"
          >
            <Input
              placeholder="阶段名称，如预付款"
              value={stage.name}
              onChange={(e) => updateStage(stage.id, { name: e.target.value })}
            />
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={100}
                value={stage.ratio}
                onChange={(e) =>
                  updateStage(stage.id, { ratio: Number(e.target.value) || 0 })
                }
                className="pr-7"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-40">
                %
              </span>
            </div>
            <div className="flex items-center text-sm font-medium tabular-nums text-ink">
              {formatCurrency(Math.round((totalAmount * stage.ratio) / 100))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-ink-40 hover:text-red-600"
              onClick={() => removeStage(stage.id)}
              disabled={stages.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addStage}>
        <Plus className="h-3.5 w-3.5" /> 添加付款阶段
      </Button>
    </div>
  );
}
