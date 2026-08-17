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
import {
  buildCompositeLineFormulas,
  getDesignerPlatformPricingBases,
  type DesignerPricingBaseLine,
  type DesignerPricingBaseSnapshot,
  type DesignerPricingFactors,
} from "@/lib/designer-pricing-base";
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
import { useDesigner, invalidateApiPath } from "@/lib/use-data";
import { updateDesignerProfileRequest } from "@/lib/api-client";
import {
  designerCanAcceptOrders,
  portfolioReadinessHint,
} from "@/lib/designer-portfolio-readiness";
import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

function previewLines(snapshot: DesignerPricingBaseSnapshot) {
  if (!snapshot.available) return [];
  const areaLines = snapshot.lines.filter(
    (l) => l.phase === "施工图" || l.phase === "方案",
  );
  const timeLines = snapshot.lines.filter((l) => l.phase === "按时间");
  return [...areaLines, ...timeLines].slice(0, 2);
}

function platformBillingStorageKey(designerId: string) {
  return `lz-accept-platform-billing:${designerId}`;
}

export function DesignerPricingBaseSidebarCard() {
  const identityId = useRoleStore((s) => s.identityId) || "";
  const { data: designer } = useDesigner(identityId);
  const pricingConfig = usePlatformPricingStore((s) => s.config);
  const savedByDesigner = useDesignerRateSettingsStore((s) => s.byDesigner);
  const push = useSessionStore((s) => s.pushNotification);
  const [open, setOpen] = useState(false);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [acceptPlatformBilling, setAcceptPlatformBilling] = useState(true);
  const [acceptingBusy, setAcceptingBusy] = useState(false);

  useEffect(() => {
    if (designer) setAcceptingOrders(designer.acceptingOrders !== false);
  }, [designer?.id, designer?.acceptingOrders]);

  useEffect(() => {
    if (!designer?.id) return;
    try {
      const raw = localStorage.getItem(platformBillingStorageKey(designer.id));
      if (raw === "0") setAcceptPlatformBilling(false);
      else if (raw === "1") setAcceptPlatformBilling(true);
    } catch {
      /* ignore */
    }
  }, [designer?.id]);

  const bases = useMemo(() => {
    if (!designer) return null;
    return getDesignerPlatformPricingBases(designer, pricingConfig);
  }, [designer, pricingConfig]);

  const customSnapshot = useMemo(() => {
    if (!designer || !bases) return null;
    const platform = bases.designerComposite;
    const saved = savedByDesigner[designer.id] ?? designer.ratePercents ?? {};
    const percents = mergePercentsWithDefaults(platform, saved);
    return applyRateSettingsToSnapshot(platform, percents);
  }, [designer, bases, savedByDesigner]);

  const isCustom = useMemo(() => {
    if (!designer) return false;
    const saved = savedByDesigner[designer.id] ?? designer.ratePercents ?? {};
    return hasCustomRateSettings(saved);
  }, [designer, savedByDesigner]);

  if (!designer || !bases || !customSnapshot) return null;

  const { platformInitial, designerComposite, factors } = bases;
  const activeSnapshot = acceptPlatformBilling
    ? designerComposite
    : customSnapshot;
  const canAccept = designerCanAcceptOrders(designer);

  const toggleAccepting = async (next: boolean) => {
    if (acceptingBusy) return;
    if (next && !canAccept) {
      push({
        title: "暂不可开启接单",
        description:
          portfolioReadinessHint(designer) ||
          "请先在作品管理中按项目类型上传至少 1 个案例。",
        variant: "destructive",
      });
      return;
    }
    const prev = acceptingOrders;
    setAcceptingOrders(next);
    setAcceptingBusy(true);
    try {
      await updateDesignerProfileRequest(designer.id, {
        acceptingOrders: next,
      });
      invalidateApiPath(`/api/designers/${designer.id}`);
      invalidateApiPath("/api/designers");
      push({
        title: next ? "已开启接单" : "已关闭接单",
        description: next
          ? "主页将显示为可接单状态，委托人可发起定向委托。"
          : "主页将显示暂停接单，定向委托入口暂不可用。",
        variant: next ? "success" : "default",
      });
    } catch (e) {
      setAcceptingOrders(prev);
      push({
        title: "接单状态更新失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setAcceptingBusy(false);
    }
  };

  const togglePlatformBilling = (next: boolean) => {
    setAcceptPlatformBilling(next);
    try {
      localStorage.setItem(
        platformBillingStorageKey(designer.id),
        next ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
    push({
      title: next ? "已开启平台计费派单" : "已关闭平台计费派单",
      description: next
        ? "侧栏展示乐自由平台取费基数（初始基数 + 您的综合基数）。"
        : "侧栏展示您的自定义费率（我的费率设置）。",
      variant: next ? "success" : "default",
    });
  };

  const cardTitle = acceptPlatformBilling
    ? "乐自由的平台取费基数"
    : "自定义费率（我的费率设置）";

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
                  {cardTitle}
                </div>
                {!acceptPlatformBilling && isCustom ? (
                  <Badge variant="brand" className="h-4 px-1 text-[9px]">
                    已自定义
                  </Badge>
                ) : null}
              </div>
              <div className="mt-0.5 text-[10px] leading-snug text-ink-50">
                {activeSnapshot.available ? (
                  <>
                    以{activeSnapshot.exampleTitle}为例 ·{" "}
                    {activeSnapshot.subjectLabel} · {activeSnapshot.specialtyLabel}
                  </>
                ) : (
                  <>仅景观专业已接入 · 当前为{activeSnapshot.specialtyLabel}</>
                )}
              </div>
            </div>
          </div>

          {activeSnapshot.available ? (
            acceptPlatformBilling ? (
              <div className="space-y-2">
                <PricingPreviewBlock
                  title="平台初始基数"
                  note="未叠加个人系数"
                  lines={previewLines(platformInitial)}
                />
                <PricingPreviewBlock
                  title="我的综合基数"
                  note={`等级×地区×项目类型 · 约 ${Math.round(factors.sharedMult * 100)}%`}
                  lines={previewLines(designerComposite)}
                  emphasize
                />
              </div>
            ) : (
              <ul className="space-y-1.5">
                {previewLines(customSnapshot).map((line) => (
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
            )
          ) : (
            <div className="rounded-lg border border-dashed border-ink-20/80 bg-white/50 px-3 py-4 text-center">
              <p className="text-xs font-medium text-ink-60">暂无</p>
              <p className="mt-1 text-[10px] leading-snug text-ink-40">
                {activeSnapshot.specialtyLabel}
                取费基数规则筹备中，请持续关注平台更新。
              </p>
            </div>
          )}

          {activeSnapshot.available ? (
            <DialogTrigger asChild>
              <button
                type="button"
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-ink-20/60 bg-white py-1.5 text-[10px] font-medium text-ink-60 transition-colors hover:border-brand/40 hover:text-brand"
              >
                查看更多基数详情
                <ChevronRight className="h-3 w-3" />
              </button>
            </DialogTrigger>
          ) : null}

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

        <DialogContent
          className={cn(
            "max-h-[85vh] overflow-y-auto",
            acceptPlatformBilling ? "max-w-3xl" : "max-w-lg",
          )}
        >
          <DialogHeader>
            <DialogTitle>
              {acceptPlatformBilling ? "平台取费基数详情" : "自定义费率详情"}
            </DialogTitle>
            <p className="text-sm text-ink-60">
              {activeSnapshot.subjectLabel} · {activeSnapshot.specialtyLabel} ·
              仅展示与当前设计主体相关的专业
            </p>
            {activeSnapshot.available ? (
              <p className="text-xs text-ink-40">
                示例：{activeSnapshot.exampleTitle}
                {acceptPlatformBilling
                  ? ` · ${designerComposite.multiplierNote}`
                  : isCustom
                    ? " · 已应用自定义费率系数"
                    : ` · ${designerComposite.multiplierNote}`}
              </p>
            ) : null}
          </DialogHeader>

          {activeSnapshot.available ? (
            acceptPlatformBilling ? (
              <PricingComparisonDetail
                platformInitial={platformInitial}
                designerComposite={designerComposite}
                factors={factors}
              />
            ) : (
              <DetailSection
                title="我的费率（相对综合基数的自定义系数）"
                note={
                  isCustom
                    ? "已按「我的费率设置」调整"
                    : "当前未调整系数，与综合基数一致"
                }
                lines={customSnapshot.lines}
              />
            )
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
          disabled={acceptingBusy}
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

function PricingPreviewBlock({
  title,
  note,
  lines,
  emphasize,
}: {
  title: string;
  note: string;
  lines: DesignerPricingBaseLine[];
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5",
        emphasize
          ? "border-brand/35 bg-white/90"
          : "border-white/80 bg-white/60",
      )}
    >
      <div className="mb-1 space-y-0.5">
        <div className="text-[10px] font-semibold text-ink">{title}</div>
        <div className="text-[9px] leading-snug text-ink-40">{note}</div>
      </div>
      <ul className="space-y-1">
        {lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-1">
            <span className="truncate text-[10px] text-ink-60">
              {line.phase}
              {line.trackLabel ? ` · ${line.trackLabel}` : ""}
            </span>
            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-brand">
              {line.amountLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailSection({
  title,
  note,
  lines,
}: {
  title: string;
  note: string;
  lines: DesignerPricingBaseLine[];
}) {
  const areaLines = lines.filter((l) => l.phase === "施工图" || l.phase === "方案");
  const timeLines = lines.filter((l) => l.phase === "按时间");
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-ink-40">{note}</p>
      </div>
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
    </div>
  );
}

function PricingComparisonDetail({
  platformInitial,
  designerComposite,
  factors,
}: {
  platformInitial: DesignerPricingBaseSnapshot;
  designerComposite: DesignerPricingBaseSnapshot;
  factors: DesignerPricingFactors;
}) {
  const initialById = new Map(platformInitial.lines.map((l) => [l.id, l]));
  const pairs = designerComposite.lines
    .map((composite) => {
      const initial = initialById.get(composite.id);
      if (!initial) return null;
      return { initial, composite };
    })
    .filter(Boolean) as {
    initial: DesignerPricingBaseLine;
    composite: DesignerPricingBaseLine;
  }[];

  const areaPairs = pairs.filter(
    (p) => p.composite.phase === "施工图" || p.composite.phase === "方案",
  );
  const timePairs = pairs.filter((p) => p.composite.phase === "按时间");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2.5">
          <div className="text-sm font-semibold text-ink">平台初始基数</div>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-40">
            {platformInitial.multiplierNote}
          </p>
        </div>
        <div className="rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5">
          <div className="text-sm font-semibold text-ink">我的综合基数</div>
          <p className="mt-0.5 text-[11px] leading-snug text-ink-40">
            {designerComposite.multiplierNote}
          </p>
        </div>
      </div>

      {areaPairs.length > 0 ? (
        <ComparisonGroup title="按面积 · 各专业设计单价（元/㎡）" pairs={areaPairs} factors={factors} />
      ) : null}
      {timePairs.length > 0 ? (
        <ComparisonGroup title="按时间 · 工日 / 月费" pairs={timePairs} factors={factors} />
      ) : null}
    </div>
  );
}

function ComparisonGroup({
  title,
  pairs,
  factors,
}: {
  title: string;
  pairs: { initial: DesignerPricingBaseLine; composite: DesignerPricingBaseLine }[];
  factors: DesignerPricingFactors;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-40">
        {title}
      </h4>
      <ul className="space-y-2">
        {pairs.map(({ initial, composite }) => {
          const formulas = buildCompositeLineFormulas(initial, composite, factors);
          return (
            <li
              key={composite.id}
              className="overflow-hidden rounded-xl border border-ink-20"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-ink-20/70 bg-ink-20/10 px-3 py-2">
                <Badge variant="brand" className="text-[10px]">
                  {composite.phase}
                </Badge>
                <span className="text-sm font-medium text-ink">
                  {composite.trackLabel}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <div className="border-b border-ink-20/60 p-3 sm:border-b-0 sm:border-r">
                  <div className="text-[11px] font-medium text-ink-40">平台初始</div>
                  <div className="mt-1 text-base font-semibold tabular-nums text-ink">
                    {initial.amountLabel}
                  </div>
                  {initial.timeBundle ? (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-ink-50">
                      <li>
                        线上 {formatCurrency(initial.timeBundle.remoteDaily)}/工日 ·{" "}
                        {formatCurrency(initial.timeBundle.remoteMonthly)}/月
                      </li>
                      <li>
                        驻场 {formatCurrency(initial.timeBundle.onsiteDaily)}/工日 ·{" "}
                        {formatCurrency(initial.timeBundle.onsiteMonthly)}/月
                      </li>
                    </ul>
                  ) : initial.subLabel ? (
                    <p className="mt-1 text-[11px] text-ink-50">{initial.subLabel}</p>
                  ) : null}
                </div>
                <div className="bg-brand/[0.03] p-3">
                  <div className="text-[11px] font-medium text-brand/80">我的综合</div>
                  <div className="mt-1 text-base font-semibold tabular-nums text-brand">
                    {composite.amountLabel}
                  </div>
                  {composite.timeBundle ? (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-ink-50">
                      <li>
                        线上 {formatCurrency(composite.timeBundle.remoteDaily)}/工日 ·{" "}
                        {formatCurrency(composite.timeBundle.remoteMonthly)}/月
                      </li>
                      <li>
                        驻场 {formatCurrency(composite.timeBundle.onsiteDaily)}/工日 ·{" "}
                        {formatCurrency(composite.timeBundle.onsiteMonthly)}/月
                      </li>
                    </ul>
                  ) : composite.subLabel ? (
                    <p className="mt-1 text-[11px] text-ink-50">{composite.subLabel}</p>
                  ) : null}
                  <div className="mt-2 space-y-1 rounded-lg border border-brand/15 bg-white/80 px-2.5 py-2">
                    <div className="text-[10px] font-semibold text-ink-50">计算公式</div>
                    {formulas.map((formula) => (
                      <p
                        key={formula}
                        className="text-[11px] leading-relaxed text-ink-60"
                      >
                        {formula}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
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
