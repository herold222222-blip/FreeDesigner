"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  applyRatePercentToLine,
  applyRateSettingsToSnapshot,
  buildDefaultPercents,
  clampDesignerRatePercent,
  DEFAULT_DESIGNER_RATE_PERCENT,
  DESIGNER_RATE_PERCENT_STEP,
  getLineRatePercent,
  getTimeRatePercentKey,
  getTimeSubRatePercent,
  hasCustomRateSettings,
  mergePercentsWithDefaults,
  TIME_RATE_SUB_META,
  type DesignerRatePercents,
  type TimeRateSubKey,
} from "@/lib/designer-rate-settings";
import {
  getDesignerPricingBaseSnapshot,
  type DesignerPricingBaseLine,
  type DesignerPricingBaseSnapshot,
} from "@/lib/designer-pricing-base";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import { useSessionStore } from "@/store/session-store";
import { updateDesignerProfileRequest } from "@/lib/api-client";
import type { Designer } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Minus, Plus, RotateCcw, Save } from "lucide-react";

export function DesignerMyRatesEditor({
  designer,
  onSaved,
}: {
  designer: Designer;
  onSaved?: () => void;
}) {
  const pricingConfig = usePlatformPricingStore((s) => s.config);
  const push = useSessionStore((s) => s.pushNotification);
  const [saving, setSaving] = useState(false);

  const platformSnapshot = useMemo(
    () => getDesignerPricingBaseSnapshot(designer, pricingConfig),
    [designer, pricingConfig],
  );

  const [draft, setDraft] = useState<DesignerRatePercents>(() =>
    mergePercentsWithDefaults(platformSnapshot, designer.ratePercents ?? {}),
  );

  useEffect(() => {
    setDraft(
      mergePercentsWithDefaults(platformSnapshot, designer.ratePercents ?? {}),
    );
  }, [designer.id, designer.ratePercents, platformSnapshot]);

  const displaySnapshot = useMemo(
    () => applyRateSettingsToSnapshot(platformSnapshot, draft),
    [platformSnapshot, draft],
  );

  const areaLines = displaySnapshot.lines.filter(
    (l) => l.phase === "施工图" || l.phase === "方案",
  );
  const timeLines = displaySnapshot.lines.filter((l) => l.phase === "按时间");

  const patchPercent = (key: string, next: number) => {
    setDraft((prev) => ({
      ...prev,
      [key]: clampDesignerRatePercent(next),
    }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateDesignerProfileRequest(designer.id, { ratePercents: draft });
      push({
        title: "费率已保存",
        description: "已同步至服务器，侧栏取费卡片将使用您的自定义费率。",
        variant: "success",
      });
      onSaved?.();
    } catch (e) {
      push({
        title: "保存失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (saving) return;
    const defaults = buildDefaultPercents(platformSnapshot);
    setDraft(defaults);
    setSaving(true);
    try {
      await updateDesignerProfileRequest(designer.id, { ratePercents: defaults });
      push({
        title: "已恢复平台基数",
        description: "各项费率系数已重置为 100% 并同步至服务器。",
        variant: "success",
      });
      onSaved?.();
    } catch (e) {
      push({
        title: "重置失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!platformSnapshot.available) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm font-medium text-ink">暂无可用取费基数</p>
        <p className="mt-2 text-sm text-ink-60">
          当前为{platformSnapshot.specialtyLabel}，平台取费规则筹备中。景观设计师可在此调节按面积与按时间的展示费率。
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-ink">平台取费基数说明</h3>
            <p className="mt-1 text-sm text-ink-60">
              {displaySnapshot.subjectLabel} · {displaySnapshot.specialtyLabel} ·{" "}
              {displaySnapshot.exampleTitle}
            </p>
            <p className="mt-1 text-xs text-ink-40">{displaySnapshot.multiplierNote}</p>
          </div>
          {hasCustomRateSettings(draft) ? (
            <Badge variant="brand">已自定义</Badge>
          ) : (
            <Badge variant="muted">平台默认 100%</Badge>
          )}
        </div>
      </Card>

      {areaLines.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-40">
            按面积 · 设计单价（元/㎡）
          </h3>
          <div className="space-y-3">
            {areaLines.map((line) => (
              <RateEditorRow
                key={line.id}
                line={line}
                platformLine={platformSnapshot.lines.find((l) => l.id === line.id)!}
                percent={getLineRatePercent(line.id, draft)}
                onPercentChange={(p) => patchPercent(line.id, p)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {timeLines.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-40">
            按时间 · 工日 / 月费（线上 / 驻场分项设置）
          </h3>
          <div className="space-y-3">
            {timeLines.map((line) => (
              <TimeRateEditorCard
                key={line.id}
                line={line}
                platformLine={platformSnapshot.lines.find((l) => l.id === line.id)!}
                draft={draft}
                onPercentChange={patchPercent}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button variant="brand" className="gap-2" onClick={handleSave}>
          <Save className="h-4 w-4" />
          保存
        </Button>
        <Button variant="outline" className="gap-2" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          重置为平台基数
        </Button>
      </div>
    </div>
  );
}

function RateEditorRow({
  line,
  platformLine,
  percent,
  onPercentChange,
}: {
  line: ReturnType<typeof applyRatePercentToLine>;
  platformLine: DesignerPricingBaseLine;
  percent: number;
  onPercentChange: (percent: number) => void;
}) {
  const platformDisplay = applyRatePercentToLine(platformLine, {});

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand" className="text-[10px]">
              {line.phase}
            </Badge>
            <span className="text-sm font-medium text-ink">{line.trackLabel}</span>
          </div>
          {line.subLabel ? (
            <p className="mt-1 text-xs text-ink-60">{line.subLabel}</p>
          ) : null}
          {line.hint ? (
            <p className="mt-2 text-[11px] leading-relaxed text-ink-40">{line.hint}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-[10px] text-ink-40">平台基数</div>
            <div className="text-xs tabular-nums text-ink-60">
              {platformDisplay.amountLabel}
            </div>
          </div>
          <PercentStepper value={percent} onChange={onPercentChange} />
          <div className="text-right">
            <div className="text-[10px] text-ink-40">自定义费率</div>
            <div className="text-sm font-semibold tabular-nums text-brand">
              {line.amountLabel}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function TimeRateEditorCard({
  line,
  platformLine,
  draft,
  onPercentChange,
}: {
  line: ReturnType<typeof applyRatePercentToLine>;
  platformLine: DesignerPricingBaseLine;
  draft: DesignerRatePercents;
  onPercentChange: (key: string, percent: number) => void;
}) {
  const platformDisplay = applyRatePercentToLine(platformLine, {});
  const tb = platformLine.timeBundle;
  const applied = line.appliedTimeRates;

  if (!tb || !applied) return null;

  const groups: { label: "线上" | "驻场"; keys: TimeRateSubKey[] }[] = [
    { label: "线上", keys: ["remoteDaily", "remoteMonthly"] },
    { label: "驻场", keys: ["onsiteDaily", "onsiteMonthly"] },
  ];

  const baseByKey: Record<TimeRateSubKey, number> = {
    remoteDaily: tb.remoteDaily,
    remoteMonthly: tb.remoteMonthly,
    onsiteDaily: tb.onsiteDaily,
    onsiteMonthly: tb.onsiteMonthly,
  };

  const appliedByKey: Record<TimeRateSubKey, number> = {
    remoteDaily: applied.remoteDaily,
    remoteMonthly: applied.remoteMonthly,
    onsiteDaily: applied.onsiteDaily,
    onsiteMonthly: applied.onsiteMonthly,
  };

  return (
    <Card className="p-4">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand" className="text-[10px]">
            {line.phase}
          </Badge>
          <span className="text-sm font-medium text-ink">{line.trackLabel}</span>
        </div>
        {line.hint ? (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-40">{line.hint}</p>
        ) : null}
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="text-xs font-semibold text-ink-60">{group.label}</div>
            {group.keys.map((subKey) => {
              const meta = TIME_RATE_SUB_META[subKey];
              const percentKey = getTimeRatePercentKey(line.id, subKey);
              const percent = getTimeSubRatePercent(line.id, subKey, draft);
              const unitLabel = meta.unit === "工日" ? "/工日" : "/月";

              return (
                <div
                  key={subKey}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-20/60 bg-ink-5/30 px-3 py-2.5"
                >
                  <div className="min-w-[4.5rem] text-sm font-medium text-ink">
                    按{meta.unit}
                  </div>

                  <div className="flex flex-1 flex-wrap items-center justify-end gap-3 sm:gap-4">
                    <div className="text-right">
                      <div className="text-[10px] text-ink-40">平台基数</div>
                      <div className="text-xs tabular-nums text-ink-60">
                        {formatCurrency(baseByKey[subKey])}
                        {unitLabel}
                      </div>
                    </div>
                    <PercentStepper
                      value={percent}
                      onChange={(p) => onPercentChange(percentKey, p)}
                    />
                    <div className="min-w-[5.5rem] text-right">
                      <div className="text-[10px] text-ink-40">自定义费率</div>
                      <div className="text-sm font-semibold tabular-nums text-brand">
                        {formatCurrency(appliedByKey[subKey])}
                        {unitLabel}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-ink-20/80 bg-white/60 px-3 py-2 text-[11px] text-ink-50">
        平台参考：{platformDisplay.subLabel}
      </div>
    </Card>
  );
}

export function PercentStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onChange(value - DESIGNER_RATE_PERCENT_STEP)}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <div className="flex h-8 min-w-[5.75rem] shrink-0 items-center justify-center gap-0.5 rounded-md border border-input bg-background px-2">
        <Input
          type="number"
          min={50}
          max={200}
          step={5}
          value={value}
          onChange={(e) =>
            onChange(Number(e.target.value) || DEFAULT_DESIGNER_RATE_PERCENT)
          }
          className="h-8 w-10 min-w-[2.5rem] shrink-0 border-0 bg-transparent p-0 text-center text-sm tabular-nums shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="shrink-0 text-sm tabular-nums text-ink-60">%</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onChange(value + DESIGNER_RATE_PERCENT_STEP)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
