"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getDesignerPricingBaseSnapshot } from "@/lib/designer-pricing-base";
import {
  applyRateSettingsToSnapshot,
  hasCustomRateSettings,
  mergePercentsWithDefaults,
  TIME_RATE_SUB_KEYS,
  TIME_RATE_SUB_META,
} from "@/lib/designer-rate-settings";
import { formatCurrency } from "@/lib/utils";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import { useDesignerRateSettingsStore } from "@/store/designer-rate-settings-store";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import { useDesigner } from "@/lib/use-data";
import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function DesignerPricingBaseSidebarCard() {
  const identityId = useRoleStore((s) => s.identityId) || "designer_chen";
  const { data: designer } = useDesigner(identityId);
  const pricingConfig = usePlatformPricingStore((s) => s.config);
  const savedByDesigner = useDesignerRateSettingsStore((s) => s.byDesigner);
  const push = useSessionStore((s) => s.pushNotification);
  const [open, setOpen] = useState(false);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [acceptPlatformBilling, setAcceptPlatformBilling] = useState(true);

  useEffect(() => {
    if (designer) setAcceptingOrders(designer.acceptingOrders !== false);
  }, [designer?.id, designer?.acceptingOrders]);

  const snapshot = useMemo(() => {
    if (!designer) return null;
    const platform = getDesignerPricingBaseSnapshot(designer, pricingConfig);
    const saved = savedByDesigner[designer.id] ?? {};
    const percents = mergePercentsWithDefaults(platform, saved);
    return applyRateSettingsToSnapshot(platform, percents);
  }, [designer, pricingConfig, savedByDesigner]);

  const isCustom = useMemo(() => {
    if (!designer) return false;
    return hasCustomRateSettings(savedByDesigner[designer.id] ?? {});
  }, [designer, savedByDesigner]);

  if (!designer || !snapshot) return null;

  const areaLines = snapshot.lines.filter((l) => l.phase === "施工图" || l.phase === "方案");
  const timeLines = snapshot.lines.filter((l) => l.phase === "按时间");
  const preview = snapshot.available
    ? [...areaLines, ...timeLines].slice(0, 3)
    : [];

  const toggleAccepting = (next: boolean) => {
    setAcceptingOrders(next);
    push({
      title: next ? "已开启接单" : "已关闭接单",
      description: next
        ? "主页将显示为可接单状态，委托人可发起定向委托。"
        : "主页将显示暂停接单，定向委托入口暂不可用。",
      variant: next ? "success" : "default",
    });
  };

  const togglePlatformBilling = (next: boolean) => {
    setAcceptPlatformBilling(next);
    push({
      title: next ? "已开启平台计费派单" : "已关闭平台计费派单",
      description: next
        ? "平台将按实时取费基数向您推送计费类委托。"
        : "将不再接收平台按计费基数匹配的派单。",
      variant: next ? "success" : "default",
    });
  };

  return (
    <div className="space-y-2 px-3 pb-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="rounded-xl border border-brand/25 bg-gradient-to-br from-brand/8 to-amber-50/80 p-3 shadow-sm">
          <div className="mb-2 flex items-start gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="text-[11px] font-semibold leading-snug text-ink">
                  乐自由实时取费基数
                </div>
                {isCustom ? (
                  <Badge variant="brand" className="h-4 px-1 text-[9px]">
                    自定义
                  </Badge>
                ) : null}
              </div>
              <div className="mt-0.5 text-[10px] leading-snug text-ink-50">
                {snapshot.available ? (
                  <>
                    以{snapshot.exampleTitle}为例 · {snapshot.subjectLabel} ·{" "}
                    {snapshot.specialtyLabel}
                  </>
                ) : (
                  <>仅景观专业已接入 · 当前为{snapshot.specialtyLabel}</>
                )}
              </div>
            </div>
          </div>

          {snapshot.available ? (
            <>
              <ul className="space-y-1.5">
                {preview.map((line) => (
                  <li
                    key={line.id}
                    className="rounded-lg border border-white/80 bg-white/70 px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Badge variant="muted" className="h-4 px-1 text-[9px]">
                        {line.phase}
                      </Badge>
                      <span className="text-[10px] font-semibold tabular-nums text-brand">
                        {line.amountLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-ink-60">
                      {line.trackLabel}
                    </div>
                    {line.subLabel ? (
                      <div className="mt-0.5 truncate text-[9px] text-ink-40">
                        {line.subLabel}
                      </div>
                    ) : null}
                    <CustomPercentHint line={line} />
                  </li>
                ))}
              </ul>

              <DialogTrigger asChild>
                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-ink-20/60 bg-white py-1.5 text-[10px] font-medium text-ink-60 transition-colors hover:border-brand/40 hover:text-brand"
                >
                  查看更多基数详情
                  <ChevronRight className="h-3 w-3" />
                </button>
              </DialogTrigger>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-ink-20/80 bg-white/50 px-3 py-4 text-center">
              <p className="text-xs font-medium text-ink-60">暂无</p>
              <p className="mt-1 text-[10px] leading-snug text-ink-40">
                {snapshot.specialtyLabel}取费基数规则筹备中，请持续关注平台更新。
              </p>
            </div>
          )}

          <Link
            href="/designer/rates"
            className="mt-2 flex w-full items-center justify-center rounded-lg border border-brand/30 bg-brand/5 py-1.5 text-[10px] font-medium text-brand transition-colors hover:bg-brand/10"
          >
            前往我的费率设置
          </Link>

          <div className="mt-2 flex items-center justify-between rounded-lg border border-white/80 bg-white/70 px-2 py-2">
            <Label
              htmlFor="platform-billing-dispatch"
              className="cursor-pointer text-[10px] font-medium leading-snug text-ink"
            >
              接受平台计费派单
            </Label>
            <Switch
              id="platform-billing-dispatch"
              checked={acceptPlatformBilling}
              onCheckedChange={togglePlatformBilling}
              className="h-5 w-9 data-[state=checked]:bg-brand [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4"
            />
          </div>
        </div>

        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>取费基数详情</DialogTitle>
            <p className="text-sm text-ink-60">
              {snapshot.subjectLabel} · {snapshot.specialtyLabel} · 仅展示与当前设计主体相关的专业
            </p>
            {snapshot.available ? (
              <p className="text-xs text-ink-40">
                示例：{snapshot.exampleTitle} · {snapshot.multiplierNote}
                {isCustom ? " · 已应用自定义费率系数" : ""}
              </p>
            ) : null}
          </DialogHeader>

          {snapshot.available ? (
            <>
              {areaLines.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-40">
                    按面积 · 各专业设计单价（元/㎡）
                  </h4>
                  <ul className="space-y-2">
                    {areaLines.map((line) => (
                      <PricingDetailRow key={line.id} line={line} />
                    ))}
                  </ul>
                </div>
              ) : null}

              {timeLines.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-40">
                    按时间 · 工日 / 月费
                  </h4>
                  <ul className="space-y-2">
                    {timeLines.map((line) => (
                      <PricingDetailRow key={line.id} line={line} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-ink-20 py-10 text-center text-sm text-ink-60">
              暂无取费基数
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-all duration-300",
          acceptingOrders
            ? "animate-accepting-glow border-emerald-300/90 bg-emerald-50/90"
            : "border-ink-20 bg-white",
        )}
      >
        <Label
          htmlFor="accepting-orders"
          className={cn(
            "flex cursor-pointer items-center gap-1.5 text-xs transition-colors",
            acceptingOrders
              ? "font-semibold text-emerald-800"
              : "font-medium text-ink-60",
          )}
        >
          {acceptingOrders ? (
            <span
              className="inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-accepting-dot"
              aria-hidden
            />
          ) : null}
          {acceptingOrders ? "接单中" : "暂停接单"}
        </Label>
        <Switch
          id="accepting-orders"
          checked={acceptingOrders}
          onCheckedChange={toggleAccepting}
          className={cn(
            acceptingOrders &&
              "data-[state=checked]:bg-emerald-600 data-[state=checked]:shadow-[0_0_10px_rgba(16,185,129,0.45)]",
          )}
        />
      </div>
    </div>
  );
}

function CustomPercentHint({
  line,
}: {
  line: {
    customPercent?: number;
    timeCustomPercents?: Partial<
      Record<"remoteDaily" | "remoteMonthly" | "onsiteDaily" | "onsiteMonthly", number>
    >;
  };
}) {
  if (line.timeCustomPercents) {
    const parts = TIME_RATE_SUB_KEYS.filter(
      (key) =>
        line.timeCustomPercents?.[key] != null &&
        line.timeCustomPercents[key] !== 100,
    ).map((key) => {
      const meta = TIME_RATE_SUB_META[key];
      return `${meta.group}${meta.unit} ${line.timeCustomPercents![key]}%`;
    });
    if (parts.length === 0) return null;
    return (
      <div className="mt-0.5 text-[9px] leading-snug text-brand/80">
        系数 {parts.join(" · ")}
      </div>
    );
  }

  if (line.customPercent != null && line.customPercent !== 100) {
    return (
      <div className="mt-0.5 text-[9px] text-brand/80">系数 {line.customPercent}%</div>
    );
  }
  return null;
}

function PricingDetailRow({
  line,
}: {
  line: {
    phase: string;
    trackLabel: string;
    amountLabel: string;
    subLabel?: string;
    hint?: string;
    customPercent?: number;
    appliedTimeRates?: {
      remoteDaily: number;
      remoteMonthly: number;
      onsiteDaily: number;
      onsiteMonthly: number;
    };
    timeCustomPercents?: Partial<
      Record<"remoteDaily" | "remoteMonthly" | "onsiteDaily" | "onsiteMonthly", number>
    >;
  };
}) {
  return (
    <li className={cn("rounded-xl border border-ink-20 p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="brand" className="text-[10px]">
            {line.phase}
          </Badge>
          <span className="text-sm font-medium text-ink">{line.trackLabel}</span>
        </div>
        <span className="text-base font-semibold tabular-nums text-brand">
          {line.amountLabel}
        </span>
      </div>
      <CustomPercentHint line={line} />
      {line.appliedTimeRates ? (
        <ul className="mt-2 space-y-1 text-xs text-ink-60">
          <li>
            线上 {formatCurrency(line.appliedTimeRates.remoteDaily)}/工日 ·{" "}
            {formatCurrency(line.appliedTimeRates.remoteMonthly)}/月
          </li>
          <li>
            驻场 {formatCurrency(line.appliedTimeRates.onsiteDaily)}/工日 ·{" "}
            {formatCurrency(line.appliedTimeRates.onsiteMonthly)}/月
          </li>
        </ul>
      ) : line.subLabel ? (
        <p className="mt-1 text-xs text-ink-60">{line.subLabel}</p>
      ) : null}
      {line.hint ? (
        <p className="mt-2 text-[11px] leading-relaxed text-ink-40">{line.hint}</p>
      ) : null}
    </li>
  );
}
