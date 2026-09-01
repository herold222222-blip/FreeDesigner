"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SCAN_PAYMENT_PRESETS,
  newStageId,
  paymentStagesTotalRatio,
  type ScanPaymentStageDraft,
} from "@/lib/scan-order";
import { LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { PaymentEscrowHint } from "@/components/domain/payment-escrow-hint";

export function ScanPaymentStagesEditor({
  stages,
  onChange,
  totalAmount,
  className,
  variant = "custom",
  ruleHint,
  allowAddRemove = true,
}: {
  stages: ScanPaymentStageDraft[];
  onChange: (stages: ScanPaymentStageDraft[]) => void;
  totalAmount: number;
  className?: string;
  /** custom：扫码面积/直填可选手动预设；daily/monthly 与常规委托工时阶段一致 */
  variant?: "custom" | "daily" | "monthly";
  ruleHint?: string;
  allowAddRemove?: boolean;
}) {
  const ratioSum = paymentStagesTotalRatio(stages);
  const ratioComplete = ratioSum === 100;

  const applyPreset = (index: number) => {
    const preset = SCAN_PAYMENT_PRESETS[index];
    const platformNotes =
      index === 0
        ? LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES.map((s) => s.note)
        : [];
    onChange(
      preset.stages.map((s, i) => ({
        ...s,
        id: newStageId(),
        note: platformNotes[i] ?? s.note ?? "",
      })),
    );
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
      {
        id: newStageId(),
        name: `阶段 ${stages.length + 1}`,
        ratio: remain || 10,
        note: "",
      },
    ]);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-base font-semibold text-ink">付款阶段</Label>
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            ratioComplete ? "text-emerald-700" : "text-rose-600",
          )}
        >
          比例合计 {ratioSum}% {ratioComplete ? "✓" : "（须等于 100%）"}
        </span>
      </div>
      <PaymentEscrowHint />
      {ruleHint ? (
        <p className="text-xs leading-relaxed text-ink-60">{ruleHint}</p>
      ) : null}
      {!ratioComplete ? (
        <p className="text-xs leading-relaxed text-rose-600">
          各阶段付款比例合计必须为 100%，当前为 {ratioSum}%，请修改后再继续。
        </p>
      ) : null}

      {variant === "custom" ? (
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
      ) : null}

      <div className="space-y-3">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="space-y-2 rounded-xl border border-ink-20 bg-ink-20/20 p-3"
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_88px_88px_auto]">
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
                  className={cn(
                    "pr-7",
                    !ratioComplete && "border-rose-300 focus-visible:ring-rose-400",
                  )}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-40">
                  %
                </span>
              </div>
              <div className="flex items-center text-sm font-medium tabular-nums text-ink">
                {formatCurrency(Math.round((totalAmount * stage.ratio) / 100))}
              </div>
              {allowAddRemove ? (
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
              ) : null}
            </div>
            <Textarea
              required
              placeholder="付款条件说明（必填），如合同签订后 2 个工作日内支付"
              value={stage.note ?? ""}
              onChange={(e) => updateStage(stage.id, { note: e.target.value })}
              rows={2}
              className="min-h-0 text-xs border-ink"
            />
          </div>
        ))}
      </div>

      {allowAddRemove ? (
        <Button type="button" variant="outline" size="sm" onClick={addStage}>
          <Plus className="h-3.5 w-3.5" /> 添加付款阶段
        </Button>
      ) : null}
    </div>
  );
}
