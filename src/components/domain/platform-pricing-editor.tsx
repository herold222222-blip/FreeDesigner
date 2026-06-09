"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CLIENT_LEVEL_META,
  DESIGNER_LEVEL_META,
  REGION_TIER_META,
  SPECIALTIES,
} from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LANDSCAPE_TIME_TRACK_LABELS } from "@/lib/designer-rates";
import type { LandscapeAreaDifficultyOption } from "@/lib/landscape-area-difficulty";
import type {
  LandscapeSchemeDifficultyOption,
  PlatformPricingConfig,
} from "@/lib/platform-pricing";
import { cloneDefaultPricingConfig, normalizePricingConfig } from "@/lib/platform-pricing";
import {
  CALCULATOR_QUOTE_REMARK_VARIANT_LABELS,
  type CalculatorQuoteRemarkVariant,
  type CalculatorQuoteRemarkVariantConfig,
} from "@/lib/calculator-quote-remarks";
import type { ClientLevel, DesignerLevel, RegionTier, Specialty } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import { useSessionStore } from "@/store/session-store";
import { savePlatformPricingRequest } from "@/lib/api-client";

const TIME_TRACKS = Object.keys(LANDSCAPE_TIME_TRACK_LABELS) as (keyof typeof LANDSCAPE_TIME_TRACK_LABELS)[];

export function PlatformPricingEditor() {
  const push = useSessionStore((s) => s.pushNotification);
  const { config, setConfig, resetConfig } = usePlatformPricingStore();
  const [draft, setDraft] = useState<PlatformPricingConfig>(() => normalizePricingConfig(config));

  useEffect(() => {
    setDraft(normalizePricingConfig(config));
  }, [config]);

  const [activeSpecialty, setActiveSpecialty] = useState<Specialty>("landscape");

  const patchDifficulty = (
    patch: Partial<PlatformPricingConfig["landscapeDifficulty"]>,
  ) =>
    setDraft((d) => ({
      ...d,
      landscapeDifficulty: { ...d.landscapeDifficulty, ...patch },
    }));

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await savePlatformPricingRequest(draft);
      const normalized = normalizePricingConfig(saved);
      setConfig(normalized);
      setDraft(normalized);
      push({
        title: "参数已保存",
        description: "已写入数据库，计算器与委托报价将按新参数生效。",
        variant: "success",
      });
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

  const restore = async () => {
    if (saving) return;
    const next = cloneDefaultPricingConfig();
    setSaving(true);
    try {
      const saved = await savePlatformPricingRequest(next);
      const normalized = normalizePricingConfig(saved);
      resetConfig();
      setConfig(normalized);
      setDraft(normalized);
      push({
        title: "已恢复默认",
        description: "全部费率与系数已回到系统默认值并同步至数据库。",
        variant: "success",
      });
    } catch (e) {
      push({
        title: "恢复失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">参数中心</h2>
          <p className="mt-1 text-sm text-ink-60">
            按一级专业分别维护取费参数；当前仅景观设计已配置，其余专业预留页面。保存后全局生效。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={restore}>
            恢复默认
          </Button>
          <Button variant="brand" onClick={save}>
            保存配置
          </Button>
        </div>
      </div>

      <Tabs
        value={activeSpecialty}
        onValueChange={(v) => setActiveSpecialty(v as Specialty)}
        className="space-y-6"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-ink-20 bg-ink-20/20 p-1">
          {SPECIALTIES.map((s) => (
            <TabsTrigger
              key={s.value}
              value={s.value}
              className={cn(
                "rounded-lg px-3 py-2 text-xs sm:text-sm",
                "data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm",
              )}
            >
              {s.label}
              {s.value === "landscape" ? (
                <Badge variant="brand" className="ml-1.5 hidden px-1.5 py-0 text-[10px] sm:inline-flex">
                  已配置
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {SPECIALTIES.map((s) => (
          <TabsContent key={s.value} value={s.value} className="mt-0 space-y-6">
            {s.value === "landscape" ? (
              <LandscapePricingParamsContent
                draft={draft}
                setDraft={setDraft}
                patchDifficulty={patchDifficulty}
              />
            ) : (
              <SpecialtyParamsPlaceholder label={s.label} description={s.description} />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex justify-end gap-2 pb-4">
        <Button variant="outline" onClick={restore}>
          恢复默认
        </Button>
        <Button variant="brand" onClick={save}>
          保存配置
        </Button>
      </div>
    </div>
  );
}

function SpecialtyParamsPlaceholder({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <Card className="flex min-h-[360px] flex-col items-center justify-center border-dashed p-12 text-center">
      <Badge variant="muted" className="mb-3">
        待配置
      </Badge>
      <p className="text-base font-semibold text-ink">{label}</p>
      {description ? (
        <p className="mt-2 max-w-lg text-sm text-ink-60">{description}</p>
      ) : null}
      <p className="mt-4 max-w-md text-sm text-ink-40">
        该专业的计费参数（基数、费率、难度系数、项目类型等）尚未上线。请先在「景观设计」分页维护当前已开放的规则。
      </p>
    </Card>
  );
}

type LandscapePricingStage = "construction_doc" | "scheme" | "quote_remarks";

function LandscapePricingParamsContent({
  draft,
  setDraft,
  patchDifficulty,
}: {
  draft: PlatformPricingConfig;
  setDraft: React.Dispatch<React.SetStateAction<PlatformPricingConfig>>;
  patchDifficulty: (patch: Partial<PlatformPricingConfig["landscapeDifficulty"]>) => void;
}) {
  const [landscapeStage, setLandscapeStage] = useState<LandscapePricingStage>("construction_doc");

  return (
    <Tabs
      value={landscapeStage}
      onValueChange={(v) => setLandscapeStage(v as LandscapePricingStage)}
      className="space-y-6"
    >
      <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-xl border border-ink-20 bg-white p-1 sm:w-fit">
        <TabsTrigger value="construction_doc" className="rounded-lg px-4 py-2 text-sm">
          施工图设计费率参数
        </TabsTrigger>
        <TabsTrigger value="scheme" className="rounded-lg px-4 py-2 text-sm">
          方案设计费率参数
        </TabsTrigger>
        <TabsTrigger value="quote_remarks" className="rounded-lg px-4 py-2 text-sm">
          费用合计备注
        </TabsTrigger>
      </TabsList>

      <TabsContent value="construction_doc" className="mt-0 space-y-6">
        <p className="text-xs text-ink-60">
          以下为景观<strong className="text-ink">施工图</strong>板块取费规则，与当前公开计算器、常规委托景观报价一致。
        </p>
      <Card className="p-6">
        <SectionTitle title="平台服务费率" desc="按出图费或基础服务费的比例收取" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PercentRateField
            label="审图服务"
            value={draft.auditServiceRate}
            onChange={(v) => setDraft((d) => ({ ...d, auditServiceRate: v }))}
          />
          <PercentRateField
            label="项目管理"
            value={draft.projectManagementRate}
            onChange={(v) => setDraft((d) => ({ ...d, projectManagementRate: v }))}
          />
          <PercentRateField
            label="平台管理费"
            value={draft.platformManagementRate}
            onChange={(v) => setDraft((d) => ({ ...d, platformManagementRate: v }))}
          />
          <PercentRateField
            label="商务费"
            hint="相对出图费/服务费"
            value={draft.businessFeeRate}
            onChange={(v) => setDraft((d) => ({ ...d, businessFeeRate: v }))}
          />
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle title="附加系数" desc="在基础公式上乘以的调节系数" />
        <div className="grid gap-4 sm:grid-cols-3">
          <CoeffField
            label="园建协调（园建+其他专业）"
            value={draft.gardenCoordinationCoefficient}
            onChange={(v) => setDraft((d) => ({ ...d, gardenCoordinationCoefficient: v }))}
          />
          <CoeffField
            label="改扩建项目"
            value={draft.renovationCoefficient}
            onChange={(v) => setDraft((d) => ({ ...d, renovationCoefficient: v }))}
          />
          <CoeffField
            label="驻场含绘图"
            value={draft.onsiteWithDrawingCoefficient}
            onChange={(v) => setDraft((d) => ({ ...d, onsiteWithDrawingCoefficient: v }))}
          />
        </div>
      </Card>

      <Card className="p-6 space-y-8">
        <SectionTitle
          title="三级专业难度系数"
          desc="文档 3.1.1.2.6 · 按面积 / 按时间报价时展示给委托人的档位、系数与说明"
        />
        <DifficultyTrackEditor
          title="园建（Hardscape）"
          scopeNote={draft.landscapeDifficulty.hardscapeScopeNote}
          onScopeNoteChange={(v) => patchDifficulty({ hardscapeScopeNote: v })}
          options={draft.landscapeDifficulty.hardscape}
          onChange={(hardscape) => patchDifficulty({ hardscape })}
        />
        <DifficultyTrackEditor
          title="绿化（Softscape）"
          options={draft.landscapeDifficulty.softscape}
          onChange={(softscape) => patchDifficulty({ softscape })}
        />
        <DifficultyTrackEditor
          title="给排水（Drainage）"
          options={draft.landscapeDifficulty.drainage}
          onChange={(drainage) => patchDifficulty({ drainage })}
        />
        <div className="space-y-3 rounded-xl border border-ink-20 p-4">
          <h4 className="text-sm font-semibold text-ink">电气（Electrical）</h4>
          <p className="text-xs text-ink-60">固定系数，无多档选择</p>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <CoeffField
              label="难度系数"
              value={draft.landscapeDifficulty.electrical.coefficient}
              onChange={(v) =>
                patchDifficulty({
                  electrical: { ...draft.landscapeDifficulty.electrical, coefficient: v },
                })
              }
            />
            <div>
              <Label className="text-ink-60">展示说明</Label>
              <Textarea
                className="mt-2 min-h-[72px] text-sm"
                value={draft.landscapeDifficulty.electrical.note}
                onChange={(e) =>
                  patchDifficulty({
                    electrical: {
                      ...draft.landscapeDifficulty.electrical,
                      note: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-ink-40">
          按时间报价中的「结构」专业未在文档中单列档位，计算器沿用园建难度档位。
        </p>
      </Card>

      <Card className="p-6">
        <SectionTitle title="设计师等级系数" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(DESIGNER_LEVEL_META) as DesignerLevel[]).map((key) => (
            <CoeffField
              key={key}
              label={DESIGNER_LEVEL_META[key].label}
              value={draft.designerLevelCoefficient[key]}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  designerLevelCoefficient: { ...d.designerLevelCoefficient, [key]: v },
                }))
              }
            />
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle title="客户等级系数" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CLIENT_LEVEL_META) as ClientLevel[]).map((key) => (
            <CoeffField
              key={key}
              label={CLIENT_LEVEL_META[key].label}
              value={draft.clientLevelCoefficient[key]}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  clientLevelCoefficient: { ...d.clientLevelCoefficient, [key]: v },
                }))
              }
            />
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle
          title="地区梯队系数"
          desc="设计师所在地按城市名录匹配梯队；系数可在此调整"
        />
        <div className="space-y-4">
          {(Object.keys(REGION_TIER_META) as RegionTier[]).map((key) => {
            const meta = REGION_TIER_META[key];
            return (
              <div key={key} className="rounded-xl border border-ink-20 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-ink">{meta.label}</h4>
                    <p className="mt-1 text-[11px] text-ink-40">
                      {meta.cities.length > 0
                        ? `共 ${meta.cities.length} 个城市`
                        : "其余未名录城市"}
                    </p>
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-ink-20/25 p-3">
                      {meta.cities.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {meta.cities.map((city) => (
                            <span
                              key={city}
                              className="rounded-md border border-ink-20/80 bg-white px-2 py-0.5 text-[11px] text-ink-60"
                            >
                              {city}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] leading-relaxed text-ink-60">
                          未列入第一至第五梯队名录的其余城市，默认归入第六梯队。
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="w-full shrink-0 sm:w-36">
                    <CoeffField
                      label="梯队系数"
                      value={draft.regionTierCoefficient[key]}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          regionTierCoefficient: { ...d.regionTierCoefficient, [key]: v },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle title="税率系数" />
        <div className="grid gap-4 sm:grid-cols-3">
          {draft.taxOptions.map((opt, index) => (
            <CoeffField
              key={opt.value}
              label={opt.label}
              value={opt.coefficient}
              onChange={(v) =>
                setDraft((d) => {
                  const taxOptions = [...d.taxOptions];
                  taxOptions[index] = { ...taxOptions[index]!, coefficient: v };
                  return { ...d, taxOptions };
                })
              }
            />
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle
          title="景观施工图 · 面积阶梯基数"
          desc="≤10000㎡ 为一口价（元）；更大面积为单价（元/㎡）"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-ink-20 text-left text-xs uppercase tracking-wider text-ink-40">
                <th className="px-2 py-2">面积区间</th>
                <th className="px-2 py-2">园建</th>
                <th className="px-2 py-2">绿化</th>
                <th className="px-2 py-2">给排水</th>
                <th className="px-2 py-2">电气</th>
              </tr>
            </thead>
            <tbody>
              {draft.landscapePricingTiers.map((tier, ti) => (
                <tr key={tier.label} className="border-b border-ink-20/60 last:border-0">
                  <td className="px-2 py-2 font-medium text-ink">
                    {tier.label}
                    <span className="ml-1 text-[10px] font-normal text-ink-40">
                      {tier.isUnitPrice ? "元/㎡" : "一口价"}
                    </span>
                  </td>
                  {(["hardscape", "softscape", "drainage", "electrical"] as const).map((track) => (
                    <td key={track} className="px-2 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9"
                        value={tier.pricing[track]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDraft((d) => {
                            const landscapePricingTiers = [...d.landscapePricingTiers];
                            const row = { ...landscapePricingTiers[ti]! };
                            row.pricing = { ...row.pricing, [track]: val };
                            landscapePricingTiers[ti] = row;
                            return { ...d, landscapePricingTiers };
                          });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle title="景观 · 按天单价（元/天）" />
        <TimeRateGrid
          draft={draft}
          unit="day"
          onChange={(next) => setDraft((d) => ({ ...d, landscapeDailyRate: next }))}
        />
      </Card>

      <Card className="p-6">
        <SectionTitle title="景观 · 按月单价（元/月）" />
        <TimeRateGrid
          draft={draft}
          unit="month"
          onChange={(next) => setDraft((d) => ({ ...d, landscapeMonthlyRate: next }))}
        />
      </Card>

      <Card className="p-6">
        <SectionTitle title="景观项目类型系数" desc={`共 ${Object.keys(draft.landscapeProjectTypeCoefficient).length} 类`} />
        <div className="max-h-80 overflow-y-auto rounded-xl border border-ink-20">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-20/30 text-xs uppercase tracking-wider text-ink-40">
              <tr>
                <th className="px-3 py-2 text-left">项目类型</th>
                <th className="min-w-[7.5rem] whitespace-nowrap px-3 py-2 text-left">系数</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(draft.landscapeProjectTypeCoefficient).map(([name, coeff]) => (
                <tr key={name} className="border-t border-ink-20/60">
                  <td className="px-3 py-2 text-ink">{name}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <CoeffInput
                      value={coeff}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          landscapeProjectTypeCoefficient: {
                            ...d.landscapeProjectTypeCoefficient,
                            [name]: v,
                          },
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      </TabsContent>

      <TabsContent value="scheme" className="mt-0 space-y-6">
        <p className="text-xs text-ink-60">
          以下为景观<strong className="text-ink">方案设计费</strong>取费规则，与公开计算器「方案设计费计算器」一致。
          平台管理费、商务费、改扩建系数、设计师/客户/地区/项目类型系数与「施工图设计费率参数」共用，修改任一分页保存后均生效。
        </p>

        <Card className="p-6">
          <SectionTitle
            title="平台服务费率（方案共用）"
            desc="方案出图费按相同比例计提平台管理费与商务费"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <PercentRateField
              label="平台管理费"
              value={draft.platformManagementRate}
              onChange={(v) => setDraft((d) => ({ ...d, platformManagementRate: v }))}
            />
            <PercentRateField
              label="商务费"
              hint="相对方案出图费"
              value={draft.businessFeeRate}
              onChange={(v) => setDraft((d) => ({ ...d, businessFeeRate: v }))}
            />
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle
            title="景观方案 · 面积阶梯基数"
            desc="文档 7.2.2 §4 · ≤10000㎡ 为一口价（元）；更大面积为单价（元/㎡）"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-ink-20 text-left text-xs uppercase tracking-wider text-ink-40">
                  <th className="px-2 py-2">面积区间</th>
                  <th className="px-2 py-2">计费方式</th>
                  <th className="px-2 py-2">基数金额</th>
                </tr>
              </thead>
              <tbody>
                {draft.landscapeSchemePricingTiers.map((tier, ti) => (
                  <tr key={tier.label} className="border-b border-ink-20/60 last:border-0">
                    <td className="px-2 py-2 font-medium text-ink">{tier.label}</td>
                    <td className="px-2 py-2 text-ink-60">
                      {tier.isUnitPrice ? "元/㎡" : "一口价"}
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        className="h-9 max-w-[160px]"
                        value={tier.amount}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setDraft((d) => {
                            const landscapeSchemePricingTiers = [
                              ...d.landscapeSchemePricingTiers,
                            ];
                            landscapeSchemePricingTiers[ti] = {
                              ...landscapeSchemePricingTiers[ti]!,
                              amount: val,
                            };
                            return { ...d, landscapeSchemePricingTiers };
                          });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <SchemeDifficultyEditor
            options={draft.landscapeSchemeDifficulty}
            onChange={(landscapeSchemeDifficulty) =>
              setDraft((d) => ({ ...d, landscapeSchemeDifficulty }))
            }
          />
        </Card>

        <Card className="p-6">
          <SectionTitle title="改扩建项目系数" desc="方案按面积计费时，改扩建项目乘以该系数" />
          <div className="max-w-xs">
            <CoeffField
              label="改扩建"
              value={draft.renovationCoefficient}
              onChange={(v) => setDraft((d) => ({ ...d, renovationCoefficient: v }))}
            />
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="quote_remarks" className="mt-0 space-y-6">
        <p className="text-xs text-ink-60">
          费用计算器「费用合计」分页在付款阶段下方展示的备注文案。按计费范围分三套；第 2 条模板中可用{" "}
          <code className="rounded bg-ink-20/50 px-1">{"{tax}"}</code> 插入委托人所选税率。
        </p>
        <CalculatorQuoteRemarksEditor
          value={draft.calculatorQuoteRemarks}
          onChange={(calculatorQuoteRemarks) =>
            setDraft((d) => ({ ...d, calculatorQuoteRemarks }))
          }
        />
      </TabsContent>
    </Tabs>
  );
}

function CalculatorQuoteRemarksEditor({
  value,
  onChange,
}: {
  value: PlatformPricingConfig["calculatorQuoteRemarks"];
  onChange: (next: PlatformPricingConfig["calculatorQuoteRemarks"]) => void;
}) {
  const [activeVariant, setActiveVariant] =
    useState<CalculatorQuoteRemarkVariant>("construction");

  const patchVariant = (
    variant: CalculatorQuoteRemarkVariant,
    patch: Partial<CalculatorQuoteRemarkVariantConfig>,
  ) => {
    onChange({
      ...value,
      [variant]: { ...value[variant], ...patch },
    });
  };

  const patchExcludedItem = (variant: CalculatorQuoteRemarkVariant, index: number, text: string) => {
    const items = [...value[variant].excludedItems];
    items[index] = text;
    patchVariant(variant, { excludedItems: items });
  };

  const addExcludedItem = (variant: CalculatorQuoteRemarkVariant) => {
    patchVariant(variant, {
      excludedItems: [...value[variant].excludedItems, "新备注条目，请编辑"],
    });
  };

  const removeExcludedItem = (variant: CalculatorQuoteRemarkVariant, index: number) => {
    if (value[variant].excludedItems.length <= 1) return;
    patchVariant(variant, {
      excludedItems: value[variant].excludedItems.filter((_, i) => i !== index),
    });
  };

  const current = value[activeVariant];

  return (
    <div className="space-y-4">
      <Tabs
        value={activeVariant}
        onValueChange={(v) => setActiveVariant(v as CalculatorQuoteRemarkVariant)}
      >
        <TabsList className="flex h-auto w-full flex-wrap gap-1 rounded-xl border border-ink-20 bg-ink-20/20 p-1">
          {(Object.keys(CALCULATOR_QUOTE_REMARK_VARIANT_LABELS) as CalculatorQuoteRemarkVariant[]).map(
            (key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-ink sm:text-sm"
              >
                {CALCULATOR_QUOTE_REMARK_VARIANT_LABELS[key]}
              </TabsTrigger>
            ),
          )}
        </TabsList>
      </Tabs>

      <Card className="space-y-5 p-6">
        <SectionTitle
          title={CALCULATOR_QUOTE_REMARK_VARIANT_LABELS[activeVariant]}
          desc="对应费用计算器合计页备注"
        />
        <div className="space-y-2">
          <Label>第 1 条 · 修改与增项条款</Label>
          <Textarea
            className="min-h-[88px] text-sm"
            value={current.modificationClause}
            onChange={(e) =>
              patchVariant(activeVariant, { modificationClause: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>第 2 条 · 税费说明模板</Label>
          <Input
            className="text-sm"
            value={current.taxLineTemplate}
            onChange={(e) => patchVariant(activeVariant, { taxLineTemplate: e.target.value })}
          />
          <p className="text-[11px] text-ink-40">
            示例：设计费包含的税费：{"{tax}"}。保存后计算器将替换为委托人所选税率。
          </p>
        </div>
        <div className="space-y-2">
          <Label>第 3 条 · 不含项标题</Label>
          <Input
            className="text-sm"
            value={current.excludedHeading}
            onChange={(e) => patchVariant(activeVariant, { excludedHeading: e.target.value })}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>第 3 条 · 不含项列表</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => addExcludedItem(activeVariant)}>
              添加条目
            </Button>
          </div>
          <div className="space-y-2">
            {current.excludedItems.map((item, index) => (
              <div key={`${activeVariant}-${index}`} className="flex gap-2">
                <span className="mt-2.5 w-6 shrink-0 text-right text-xs tabular-nums text-ink-40">
                  {index + 1})
                </span>
                <Textarea
                  className="min-h-[56px] flex-1 text-sm"
                  value={item}
                  onChange={(e) => patchExcludedItem(activeVariant, index, e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-rose-600"
                  onClick={() => removeExcludedItem(activeVariant, index)}
                >
                  删除
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function SchemeDifficultyEditor({
  options,
  onChange,
}: {
  options: LandscapeSchemeDifficultyOption[];
  onChange: (opts: LandscapeSchemeDifficultyOption[]) => void;
}) {
  const updateRow = (index: number, patch: Partial<LandscapeSchemeDifficultyOption>) => {
    onChange(options.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        title="方案难度系数"
        desc="文档 7.2.2 · 按景观单方造价（元/㎡）分档；计算器支持自动推断或手动选择"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink-20 text-left text-xs uppercase tracking-wider text-ink-40">
              <th className="w-20 px-2 py-2">档位</th>
              <th className="w-28 px-2 py-2">显示名称</th>
              <th className="min-w-[7.5rem] whitespace-nowrap px-2 py-2">系数</th>
              <th className="min-w-[6rem] px-2 py-2">造价下限</th>
              <th className="min-w-[6rem] px-2 py-2">造价上限</th>
              <th className="px-2 py-2">说明（委托人可见）</th>
            </tr>
          </thead>
          <tbody>
            {options.map((opt, index) => (
              <tr key={opt.key} className="border-b border-ink-20/60 align-top last:border-0">
                <td className="px-2 py-2 text-xs text-ink-40">{opt.key}</td>
                <td className="px-2 py-2">
                  <Input
                    className="h-9"
                    value={opt.label}
                    onChange={(e) => updateRow(index, { label: e.target.value })}
                  />
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <CoeffInput
                    value={opt.coefficient}
                    onChange={(v) => updateRow(index, { coefficient: v })}
                  />
                </td>
                <td className="px-2 py-2">
                  {opt.key !== "very_low" ? (
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      className="h-9"
                      placeholder="—"
                      value={opt.minCostPerSqm ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateRow(
                          index,
                          raw === ""
                            ? { minCostPerSqm: undefined }
                            : { minCostPerSqm: Number(raw) },
                        );
                      }}
                    />
                  ) : (
                    <span className="text-xs text-ink-40">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {opt.key !== "ultra_high" ? (
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      className="h-9"
                      placeholder="—"
                      value={opt.maxCostPerSqm ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateRow(
                          index,
                          raw === ""
                            ? { maxCostPerSqm: undefined }
                            : { maxCostPerSqm: Number(raw) },
                        );
                      }}
                    />
                  ) : (
                    <span className="text-xs text-ink-40">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Textarea
                    className="min-h-[60px] text-xs"
                    value={opt.remark}
                    onChange={(e) => updateRow(index, { remark: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-40">
        自动推断规则：单方造价 ≥ 超高档下限按「超高」计；其余档位按造价区间匹配；「极低」为低于其上限的剩余区间。
      </p>
    </div>
  );
}

function DifficultyTrackEditor({
  title,
  options,
  onChange,
  scopeNote,
  onScopeNoteChange,
}: {
  title: string;
  options: LandscapeAreaDifficultyOption[];
  onChange: (opts: LandscapeAreaDifficultyOption[]) => void;
  scopeNote?: string;
  onScopeNoteChange?: (v: string) => void;
}) {
  const updateRow = (index: number, patch: Partial<LandscapeAreaDifficultyOption>) => {
    const next = options.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...options,
      { label: "新档位", value: 1, remark: "请填写难度说明" },
    ]);
  };

  const removeRow = (index: number) => {
    if (options.length <= 1) return;
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 rounded-xl border border-ink-20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          添加档位
        </Button>
      </div>
      {scopeNote !== undefined && onScopeNoteChange ? (
        <div>
          <Label className="text-ink-60">适用范围说明</Label>
          <Textarea
            className="mt-2 min-h-[64px] text-sm"
            value={scopeNote}
            onChange={(e) => onScopeNoteChange(e.target.value)}
          />
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-ink-20 text-left text-xs uppercase tracking-wider text-ink-40">
              <th className="w-28 px-2 py-2">档位名称</th>
              <th className="min-w-[7.5rem] whitespace-nowrap px-2 py-2">系数</th>
              <th className="px-2 py-2">难度说明（委托人可见）</th>
              <th className="w-16 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {options.map((opt, index) => (
              <tr key={`${title}-${index}`} className="border-b border-ink-20/60 align-top last:border-0">
                <td className="px-2 py-2">
                  <Input
                    className="h-9"
                    value={opt.label}
                    onChange={(e) => updateRow(index, { label: e.target.value })}
                  />
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  <CoeffInput
                    value={opt.value}
                    onChange={(v) => updateRow(index, { value: v })}
                  />
                </td>
                <td className="px-2 py-2">
                  <Textarea
                    className="min-h-[60px] text-xs"
                    value={opt.remark}
                    onChange={(e) => updateRow(index, { remark: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-ink-40"
                    disabled={options.length <= 1}
                    onClick={() => removeRow(index)}
                  >
                    删除
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {desc ? <p className="mt-0.5 text-xs text-ink-60">{desc}</p> : null}
    </div>
  );
}

function PercentRateField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-ink-60">{label}</Label>
      {hint ? <p className="text-[10px] text-ink-40">{hint}</p> : null}
      <div className="mt-2 inline-flex min-w-[5.75rem] items-center gap-1.5">
        <Input
          type="number"
          step="0.1"
          min={0}
          className="h-10 w-[4.5rem] min-w-[4.5rem] shrink-0 px-2 tabular-nums"
          value={roundPercent(value)}
          onChange={(e) => onChange(parsePercent(e.target.value))}
        />
        <span className="shrink-0 text-sm text-ink-40">%</span>
      </div>
    </div>
  );
}

function CoeffField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-ink-60">{label}</Label>
      <div className="mt-2">
        <CoeffInput value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function CoeffInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex min-w-[5.75rem] shrink-0 items-center gap-1.5">
      <Input
        type="number"
        step="1"
        min={0}
        className="h-9 w-[4.25rem] min-w-[4.25rem] shrink-0 px-2 tabular-nums sm:h-10 sm:w-[4.5rem] sm:min-w-[4.5rem]"
        value={roundPercent(value)}
        onChange={(e) => onChange(parsePercent(e.target.value))}
      />
      <span className="shrink-0 text-sm text-ink-40">%</span>
    </div>
  );
}

function TimeRateGrid({
  draft,
  unit,
  onChange,
}: {
  draft: PlatformPricingConfig;
  unit: "day" | "month";
  onChange: (next: PlatformPricingConfig["landscapeDailyRate"]) => void;
}) {
  const rates = unit === "day" ? draft.landscapeDailyRate : draft.landscapeMonthlyRate;

  const update = (
    mode: "remote" | "onsite",
    track: (typeof TIME_TRACKS)[number],
    val: number,
  ) => {
    onChange({
      ...rates,
      [mode]: { ...rates[mode], [track]: val },
    });
  };

  return (
    <div className="space-y-4">
      {(["remote", "onsite"] as const).map((mode) => (
        <div key={mode}>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-40">
            {mode === "remote" ? "远程" : "驻场"}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {TIME_TRACKS.map((track) => (
              <div key={track}>
                <Label className="text-[11px] text-ink-60">{LANDSCAPE_TIME_TRACK_LABELS[track]}</Label>
                <Input
                  type="number"
                  step="1"
                  min={0}
                  className="mt-1 h-9"
                  value={rates[mode][track]}
                  onChange={(e) => update(mode, track, Number(e.target.value) || 0)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function roundPercent(decimal: number) {
  return Math.round(decimal * 1000) / 10;
}

function parsePercent(input: string) {
  const n = Number(input);
  return Number.isFinite(n) ? n / 100 : 0;
}
