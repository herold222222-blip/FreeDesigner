"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CitySelector } from "@/components/domain/city-selector";
import {
  AdministrativeRegionSelector,
  getDefaultAdministrativeTriple,
  resolveAdministrativeTriple,
  type AdministrativeTriple,
} from "@/components/domain/administrative-region-selector";
import {
  CLIENT_LEVEL_META,
  DESIGNER_LEVEL_META,
  REGION_TIER_META,
  SPECIALTIES,
} from "@/lib/constants";
import type { Specialty } from "@/lib/types";
import {
  calculateAreaBasedFee,
  calculateSchemeAreaBasedFee,
  calculateTimeBasedFee,
  getLandscapeBaseFees,
  getLandscapeSchemeBaseFee,
  type AreaBasedFeeBreakdown,
  type SchemeAreaBasedFeeBreakdown,
  type TimeBasedFeeBreakdown,
} from "@/lib/fee-calculator";
import {
  inferSchemeDifficultyFromCostPerSqm,
  getSchemeDifficultyOptions,
} from "@/lib/landscape-scheme-difficulty";
import {
  LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES,
  LANDSCAPE_SCHEME_PAYMENT_STAGES,
} from "@/lib/constants";
import type { LandscapeSchemeDifficultyKey } from "@/lib/constants";
import type {
  ClientLevel,
  DesignerLevel,
  RegionTier,
} from "@/lib/types";
import { formatCurrency, cn } from "@/lib/utils";
import type { PlatformPricingConfig } from "@/lib/platform-pricing";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import {
  getCalculatorQuoteRemarks,
  resolveCalculatorQuoteRemarkVariant,
} from "@/lib/calculator-quote-remarks";
import {
  getHardscapeScopeNote,
  landscapeAreaDifficultyUI,
  landscapeTimeDifficultyUI,
} from "@/lib/landscape-area-difficulty";
import {
  Calculator,
  Clock,
  Coins,
  FileText,
  Layers,
  PieChart,
  Ruler,
  Sparkles,
} from "lucide-react";

const TRACK_LABEL: Record<"hardscape" | "softscape" | "drainage" | "electrical" | "structure", string> = {
  hardscape: "园建（Hardscape）",
  softscape: "绿化（Softscape）",
  drainage: "给排水（Drainage）",
  electrical: "电气（Electrical）",
  structure: "结构（Structure）",
};

/** 浅色底 Tab 列表上的触发器样式（避免 active 白底 + 白字） */
const LANDSCAPE_TAB_TRIGGER_CLASS = cn(
  "rounded-lg px-3 py-2 text-xs text-ink-60 sm:text-sm",
  "data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-sm",
);

type TaxOption = { value: string; label: string; coefficient: number };

type LandscapeSharedProps = {
  pricingConfig: PlatformPricingConfig;
  projectName: string;
  setProjectName: (v: string) => void;
  clientName: string;
  setClientName: (v: string) => void;
  contactName: string;
  setContactName: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  projectAdminTriple: AdministrativeTriple;
  setProjectAdminTriple: (v: AdministrativeTriple) => void;
  projectCity: string;
  area: number;
  setArea: (v: number) => void;
  landscapeCostWan: string;
  setLandscapeCostWan: (v: string) => void;
  projectType: string;
  setProjectType: (v: string) => void;
  designerLevel: DesignerLevel;
  setDesignerLevel: (v: DesignerLevel) => void;
  designerCity: string;
  setDesignerCity: (v: string) => void;
  designerRegion: RegionTier;
  setDesignerRegion: (v: RegionTier) => void;
  clientLevel: ClientLevel;
  setClientLevel: (v: ClientLevel) => void;
  buildType: "new" | "renovation";
  setBuildType: (v: "new" | "renovation") => void;
  tax: TaxOption;
  setTax: (v: TaxOption) => void;
  scopeScheme: boolean;
};

function LandscapeSharedProjectPanel({ shared }: { shared: LandscapeSharedProps }) {
  const {
    pricingConfig,
    projectName,
    setProjectName,
    clientName,
    setClientName,
    contactName,
    setContactName,
    contactPhone,
    setContactPhone,
    projectAdminTriple,
    setProjectAdminTriple,
    projectCity,
    area,
    setArea,
    landscapeCostWan,
    setLandscapeCostWan,
    projectType,
    setProjectType,
    designerLevel,
    setDesignerLevel,
    designerCity,
    setDesignerCity,
    designerRegion,
    setDesignerRegion,
    clientLevel,
    setClientLevel,
    buildType,
    setBuildType,
    tax,
    setTax,
    scopeScheme,
  } = shared;

  const projectTypes = Object.keys(pricingConfig.landscapeProjectTypeCoefficient);
  const constructionTier = getLandscapeBaseFees(area || 1, pricingConfig).tier;
  const schemeTier = getLandscapeSchemeBaseFee(area || 1, pricingConfig).tier;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <SectionTitle icon={FileText} title="项目基本信息（施工图 / 方案共用）" />
        <p className="mb-4 text-[11px] text-ink-40">
          以下信息只需填写一次，切换「施工图」或「方案」计算器时自动沿用。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              项目名称 <span className="text-rose-500">*</span>
            </Label>
            <Input
              placeholder="例如：杭州未来社区中心庭院"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>委托方名称</Label>
            <Input
              placeholder="已入驻则默认，未入驻手动输入"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>联系人</Label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>联系方式</Label>
            <Input
              placeholder="验证手机号"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              项目所在地 <span className="text-rose-500">*</span>
            </Label>
            <AdministrativeRegionSelector
              triple={projectAdminTriple}
              onTripleChange={setProjectAdminTriple}
            />
            {projectCity ? (
              <div className="text-[11px] text-ink-40">完整地址：{projectCity}</div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>项目类型</Label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm text-ink"
            >
              {projectTypes.map((t) => (
                <option key={t} value={t}>
                  {t}（{Math.round(pricingConfig.landscapeProjectTypeCoefficient[t] * 100)}%）
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>景观面积（㎡）</Label>
            <Input
              type="number"
              value={area}
              onChange={(e) => setArea(Number(e.target.value) || 0)}
            />
            <div className="flex flex-wrap gap-2 text-[11px] text-ink-40">
              <span>
                施工图阶梯：<span className="font-medium text-ink">{constructionTier.label}</span>
              </span>
              <span>·</span>
              <span>
                方案阶梯：<span className="font-medium text-ink">{schemeTier.label}</span>
              </span>
            </div>
          </div>
          {scopeScheme ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>景观造价（万元，选填）</Label>
              <Input
                type="number"
                placeholder="用于方案难度系数自动推断"
                value={landscapeCostWan}
                onChange={(e) => setLandscapeCostWan(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle icon={Sparkles} title="主体系数（共用）" />
        <div className="grid gap-5 sm:grid-cols-2">
          <CoeffSelector
            label="设计师等级"
            options={Object.entries(DESIGNER_LEVEL_META).map(([k, v]) => ({
              value: k as DesignerLevel,
              label: `${v.label}（${Math.round(pricingConfig.designerLevelCoefficient[k as DesignerLevel] * 100)}%）`,
            }))}
            value={designerLevel}
            onChange={(v) => setDesignerLevel(v as DesignerLevel)}
          />
          <div className="space-y-1.5">
            <Label>设计师所在城市</Label>
            <CitySelector
              value={designerCity}
              onChange={(c, tier) => {
                setDesignerCity(c);
                setDesignerRegion(tier);
              }}
              placeholder="请选择设计师所在城市"
            />
            <div className="text-[11px] text-ink-40">
              {REGION_TIER_META[designerRegion].label} · 系数{" "}
              {Math.round(pricingConfig.regionTierCoefficient[designerRegion] * 100)}%
            </div>
          </div>
          <CoeffSelector
            label="客户等级"
            options={Object.entries(CLIENT_LEVEL_META).map(([k, v]) => ({
              value: k as ClientLevel,
              label: `${v.label}（${Math.round(pricingConfig.clientLevelCoefficient[k as ClientLevel] * 100)}%）`,
            }))}
            value={clientLevel}
            onChange={(v) => setClientLevel(v as ClientLevel)}
          />
          <div className="space-y-1.5">
            <Label>建造类型</Label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setBuildType("new")} className={pillCls(buildType === "new")}>
                新建（100%）
              </button>
              <button
                onClick={() => setBuildType("renovation")}
                className={pillCls(buildType === "renovation")}
              >
                改扩建（110%）
              </button>
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>税率</Label>
            <div className="flex flex-wrap gap-2">
              {pricingConfig.taxOptions.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTax(t)}
                  className={pillCls(tax.value === t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function CalculatorPage() {
  const [activeSpecialty, setActiveSpecialty] = useState<Specialty>("landscape");

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge variant="muted" className="mb-2 gap-1">
            <Sparkles className="h-3 w-3 text-brand" /> v1.1 新增
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">费用计算器</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink-60">
            按一级专业分别试算报价。当前仅景观设计已开放按面积 / 按时间两种模式；其余专业页面预留，规则上线后在此切换即可。
          </p>
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
                  已开放
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {SPECIALTIES.map((s) => (
          <TabsContent key={s.value} value={s.value} className="mt-0 space-y-6">
            {s.value === "landscape" ? (
              <>
                <p className="text-sm text-ink-60">
                  {s.description} · 可单独试算施工图或方案设计费，也可同时勾选两项查看合计总价（7.2.2）。
                </p>
                <LandscapeCalculator />
              </>
            ) : (
              <SpecialtyCalculatorPlaceholder
                label={s.label}
                description={s.description}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SpecialtyCalculatorPlaceholder({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <Card className="flex min-h-[360px] flex-col items-center justify-center border-dashed p-12 text-center">
      <Badge variant="muted" className="mb-3">
        待开放
      </Badge>
      <p className="text-base font-semibold text-ink">{label} · 费用试算</p>
      {description ? (
        <p className="mt-2 max-w-lg text-sm text-ink-60">{description}</p>
      ) : null}
      <p className="mt-4 max-w-md text-sm text-ink-40">
        该专业的计费规则与参数尚未接入计算器。请先在「景观设计」分页体验按面积 / 按时间报价；其他专业规则确定后将在此分页展示。
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* 景观：施工图 / 方案 / 合计                                            */
/* ------------------------------------------------------------------ */

type LandscapeStageTab = "construction_doc" | "scheme" | "combined";

function LandscapeCalculator() {
  const pricingConfig = usePlatformPricingStore((s) => s.config);
  const [scopeConstruction, setScopeConstruction] = useState(true);
  const [scopeScheme, setScopeScheme] = useState(false);
  const [stageTab, setStageTab] = useState<LandscapeStageTab>("construction_doc");
  const [constructionMode, setConstructionMode] = useState<"area" | "time">("area");

  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [projectAdminTriple, setProjectAdminTriple] = useState<AdministrativeTriple>(
    () => getDefaultAdministrativeTriple(),
  );
  const projectCity =
    resolveAdministrativeTriple(projectAdminTriple)?.fullLabel ?? "";
  const [area, setArea] = useState(8000);
  const [landscapeCostWan, setLandscapeCostWan] = useState("");
  const [projectType, setProjectType] = useState("高层住宅");
  const [designerLevel, setDesignerLevel] = useState<DesignerLevel>("mid_v1");
  const [designerCity, setDesignerCity] = useState("成都");
  const [designerRegion, setDesignerRegion] = useState<RegionTier>("tier2");
  const [clientLevel, setClientLevel] = useState<ClientLevel>("normal");
  const [buildType, setBuildType] = useState<"new" | "renovation">("new");
  const [tax, setTax] = useState<TaxOption>(pricingConfig.taxOptions[0]!);

  const [areaTracks, setAreaTracks] = useState<
    ("hardscape" | "softscape" | "drainage" | "electrical")[]
  >(["hardscape", "softscape", "drainage", "electrical"]);
  const [areaDifficulty, setAreaDifficulty] = useState<Record<string, number>>({
    hardscape: 1.0,
    softscape: 1.0,
    drainage: 1.0,
    electrical: 1.0,
  });
  const [timeUnit, setTimeUnit] = useState<"day" | "month">("day");
  const [timeQuantity, setTimeQuantity] = useState(10);
  const [timeMode, setTimeMode] = useState<"remote" | "onsite">("remote");
  const [timeWithDrawing, setTimeWithDrawing] = useState(false);
  const [timeTrack, setTimeTrack] = useState<
    "hardscape" | "softscape" | "drainage" | "electrical" | "structure"
  >("hardscape");
  const [timeDifficulty, setTimeDifficulty] = useState(1.0);
  const [schemeDifficulty, setSchemeDifficulty] =
    useState<LandscapeSchemeDifficultyKey>("medium");
  const [schemeDifficultyMode, setSchemeDifficultyMode] = useState<"auto" | "manual">(
    "manual",
  );

  useEffect(() => {
    if (!pricingConfig.taxOptions.some((item) => item.value === tax.value)) {
      setTax(pricingConfig.taxOptions[0]!);
    }
  }, [pricingConfig.taxOptions, tax.value]);

  const shared: LandscapeSharedProps = {
    pricingConfig,
    projectName,
    setProjectName,
    clientName,
    setClientName,
    contactName,
    setContactName,
    contactPhone,
    setContactPhone,
    projectAdminTriple,
    setProjectAdminTriple,
    projectCity,
    area,
    setArea,
    landscapeCostWan,
    setLandscapeCostWan,
    projectType,
    setProjectType,
    designerLevel,
    setDesignerLevel,
    designerCity,
    setDesignerCity,
    designerRegion,
    setDesignerRegion,
    clientLevel,
    setClientLevel,
    buildType,
    setBuildType,
    tax,
    setTax,
    scopeScheme,
  };

  const showCombined = scopeConstruction || scopeScheme;

  const constructionAreaLive = useMemo(
    () =>
      calculateAreaBasedFee(
        {
          area,
          projectType,
          designerLevel,
          designerRegion,
          clientLevel,
          selectedTracks: areaTracks,
          difficulty: areaDifficulty,
          buildType,
          taxCoefficient: tax.coefficient,
        },
        pricingConfig,
      ),
    [
      area,
      projectType,
      designerLevel,
      designerRegion,
      clientLevel,
      areaTracks,
      areaDifficulty,
      buildType,
      tax.coefficient,
      pricingConfig,
    ],
  );

  const constructionTimeLive = useMemo(
    () =>
      calculateTimeBasedFee(
        {
          unit: timeUnit,
          quantity: timeQuantity,
          mode: timeMode,
          track: timeTrack,
          designerLevel,
          designerRegion,
          clientLevel,
          withDrawing: timeWithDrawing,
          difficulty: timeDifficulty,
          taxCoefficient: tax.coefficient,
        },
        pricingConfig,
      ),
    [
      timeUnit,
      timeQuantity,
      timeMode,
      timeTrack,
      designerLevel,
      designerRegion,
      clientLevel,
      timeWithDrawing,
      timeDifficulty,
      tax.coefficient,
      pricingConfig,
    ],
  );

  const schemeLive = useMemo(
    () =>
      calculateSchemeAreaBasedFee(
        {
          area,
          projectType,
          designerLevel,
          designerRegion,
          clientLevel,
          schemeDifficulty,
          buildType,
          taxCoefficient: tax.coefficient,
        },
        pricingConfig,
      ),
    [
      area,
      projectType,
      designerLevel,
      designerRegion,
      clientLevel,
      schemeDifficulty,
      buildType,
      tax.coefficient,
      pricingConfig,
    ],
  );

  const toggleScope = (which: "construction" | "scheme", next: boolean) => {
    if (which === "construction") {
      if (!next && !scopeScheme) return;
      setScopeConstruction(next);
      if (!next && stageTab === "construction_doc") setStageTab("scheme");
    } else {
      if (!next && !scopeConstruction) return;
      setScopeScheme(next);
      if (!next && (stageTab === "scheme" || stageTab === "combined")) {
        setStageTab("construction_doc");
      }
    }
  };

  useEffect(() => {
    if (!scopeConstruction && scopeScheme && stageTab === "construction_doc") {
      setStageTab("scheme");
    }
    if (scopeConstruction && !scopeScheme && stageTab === "scheme") {
      setStageTab("construction_doc");
    }
  }, [scopeConstruction, scopeScheme, stageTab]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <Label className="mb-3 block text-sm font-semibold text-ink">计费范围（可多选）</Label>
        <div className="flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={scopeConstruction}
              onChange={(e) => toggleScope("construction", e.target.checked)}
            />
            施工图设计费
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={scopeScheme}
              onChange={(e) => toggleScope("scheme", e.target.checked)}
            />
            方案设计费
          </label>
        </div>
        <p className="mt-2 text-[11px] text-ink-40">
          勾选任一项或两项均可；在「费用合计」分页查看税后总价与付款阶段。
        </p>
      </Card>

      <LandscapeSharedProjectPanel shared={shared} />

      <Tabs
        value={stageTab}
        onValueChange={(v) => setStageTab(v as LandscapeStageTab)}
        className="space-y-6"
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-ink-20 bg-ink-20/20 p-1">
          {scopeConstruction ? (
            <TabsTrigger value="construction_doc" className={LANDSCAPE_TAB_TRIGGER_CLASS}>
              施工图设计费计算器
            </TabsTrigger>
          ) : null}
          {scopeScheme ? (
            <TabsTrigger value="scheme" className={LANDSCAPE_TAB_TRIGGER_CLASS}>
              方案设计费计算器
            </TabsTrigger>
          ) : null}
          {showCombined ? (
            <TabsTrigger value="combined" className={cn(LANDSCAPE_TAB_TRIGGER_CLASS, "gap-1.5")}>
              <Layers className="h-3.5 w-3.5" /> 费用合计
            </TabsTrigger>
          ) : null}
        </TabsList>

        {scopeConstruction ? (
          <TabsContent value="construction_doc" className="mt-0 space-y-4">
            <p className="text-sm text-ink-60">
              景观施工图（园建 / 绿化 / 给排水 / 电气）：按面积含审图费、项目管理费；按时间为日 / 月费率。
            </p>
            <Tabs
              value={constructionMode}
              onValueChange={(v) => setConstructionMode(v as "area" | "time")}
              className="space-y-6"
            >
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-ink-20 bg-ink-20/20 p-1">
                <TabsTrigger value="area" className={cn(LANDSCAPE_TAB_TRIGGER_CLASS, "gap-2")}>
                  <Ruler className="h-4 w-4" /> 按面积报价
                </TabsTrigger>
                <TabsTrigger value="time" className={cn(LANDSCAPE_TAB_TRIGGER_CLASS, "gap-2")}>
                  <Clock className="h-4 w-4" /> 按时间报价
                </TabsTrigger>
              </TabsList>
              <TabsContent value="area" className="mt-0">
                <AreaBasedCalculator
                  shared={shared}
                  tracks={areaTracks}
                  setTracks={setAreaTracks}
                  difficulty={areaDifficulty}
                  setDifficulty={setAreaDifficulty}
                />
              </TabsContent>
              <TabsContent value="time" className="mt-0">
                <TimeBasedCalculator
                  shared={shared}
                  unit={timeUnit}
                  setUnit={setTimeUnit}
                  quantity={timeQuantity}
                  setQuantity={setTimeQuantity}
                  mode={timeMode}
                  setMode={setTimeMode}
                  withDrawing={timeWithDrawing}
                  setWithDrawing={setTimeWithDrawing}
                  track={timeTrack}
                  setTrack={setTimeTrack}
                  difficulty={timeDifficulty}
                  setDifficulty={setTimeDifficulty}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        ) : null}

        {scopeScheme ? (
          <TabsContent value="scheme" className="mt-0">
            <SchemeAreaBasedCalculator
              shared={shared}
              schemeDifficulty={schemeDifficulty}
              setSchemeDifficulty={setSchemeDifficulty}
              difficultyMode={schemeDifficultyMode}
              setDifficultyMode={setSchemeDifficultyMode}
            />
          </TabsContent>
        ) : null}

        {showCombined ? (
          <TabsContent value="combined" className="mt-0">
            <CombinedLandscapeSummary
              shared={shared}
              constructionMode={constructionMode}
              constructionArea={scopeConstruction ? constructionAreaLive : null}
              constructionTime={scopeConstruction ? constructionTimeLive : null}
              scheme={scopeScheme ? schemeLive : null}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function CombinedLandscapeSummary({
  shared,
  constructionMode,
  constructionArea,
  constructionTime,
  scheme,
}: {
  shared: LandscapeSharedProps;
  constructionMode: "area" | "time";
  constructionArea: AreaBasedFeeBreakdown | null;
  constructionTime: TimeBasedFeeBreakdown | null;
  scheme: SchemeAreaBasedFeeBreakdown | null;
}) {
  const {
    projectName,
    projectCity,
    clientName,
    contactName,
    contactPhone,
    area,
    projectType,
    designerLevel,
    designerCity,
    tax,
  } = shared;

  const construction =
    constructionMode === "area" ? constructionArea : constructionTime;
  const constructionLabel =
    constructionMode === "area" ? "施工图设计费（按面积）" : "施工图设计费（按时间）";
  const constructionTotal = construction?.total ?? 0;
  const schemeTotal = scheme?.total ?? 0;
  const grandTotal = constructionTotal + schemeTotal;
  const remarkVariant = resolveCalculatorQuoteRemarkVariant(!!construction, !!scheme);
  const quoteRemarks = remarkVariant
    ? getCalculatorQuoteRemarks(
        remarkVariant,
        tax.label,
        shared.pricingConfig.calculatorQuoteRemarks,
      )
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="p-4">
        <div className="mb-2 text-xs font-semibold text-ink">委托方与项目</div>
        <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          <CompactInfo label="项目" value={projectName || "—"} />
          <CompactInfo label="委托方" value={clientName || "—"} />
          <CompactInfo label="联系人" value={contactName || "—"} />
          <CompactInfo label="电话" value={contactPhone || "—"} />
          <CompactInfo label="项目地" value={projectCity || "—"} />
          <CompactInfo
            label="面积 / 类型"
            value={`${area > 0 ? `${area.toLocaleString()} ㎡` : "—"} · ${projectType}`}
          />
          <CompactInfo
            label="设计师"
            value={`${DESIGNER_LEVEL_META[designerLevel].label} · ${designerCity || "—"}`}
          />
          <CompactInfo label="税率" value={tax.label} />
        </dl>
      </Card>

      <Card className="p-5">
        <SectionTitle icon={Layers} title="费用合计（税后）" />
        <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-5 text-center">
          <div className="text-[11px] uppercase tracking-wider text-brand">合计总价</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-brand">
            {formatCurrency(grandTotal)}
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {construction ? (
            <div className="flex justify-between rounded-lg bg-ink-20/25 px-3 py-2">
              <span className="text-ink-60">{constructionLabel}</span>
              <span className="font-semibold text-ink">
                {formatCurrency(constructionTotal)}
              </span>
            </div>
          ) : null}
          {scheme ? (
            <div className="flex justify-between rounded-lg bg-ink-20/25 px-3 py-2">
              <span className="text-ink-60">方案设计费（按面积）</span>
              <span className="font-semibold text-ink">
                {formatCurrency(schemeTotal)}
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      {construction ? (
        <PaymentStagesCard
          title="施工图 · 付款阶段"
          total={constructionTotal}
          stages={LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES}
          compact
        />
      ) : null}

      {scheme ? (
        <PaymentStagesCard
          title="方案 · 付款阶段"
          total={schemeTotal}
          stages={LANDSCAPE_SCHEME_PAYMENT_STAGES}
          compact
        />
      ) : null}

      {quoteRemarks ? <CombinedQuoteRemarksCard remarks={quoteRemarks} /> : null}
    </div>
  );
}

function CombinedQuoteRemarksCard({
  remarks,
}: {
  remarks: ReturnType<typeof getCalculatorQuoteRemarks>;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 text-xs font-semibold text-ink">备注（委托人可见）</div>
      <ol className="list-decimal space-y-3 pl-4 text-[11px] leading-relaxed text-ink-60">
        <li>{remarks.modificationClause}</li>
        <li>{remarks.taxLine}</li>
        <li>
          <span className="font-medium text-ink">{remarks.excludedHeading}</span>
          <ol className="mt-2 list-none space-y-1.5 pl-0">
            {remarks.excludedItems.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span className="shrink-0 tabular-nums text-ink-40">{index + 1})</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </li>
      </ol>
    </Card>
  );
}

function CompactInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 gap-2">
      <dt className="shrink-0 text-ink-40">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-ink">{value}</dd>
    </div>
  );
}

function PaymentStagesCard({
  title,
  total,
  stages,
  compact,
}: {
  title: string;
  total: number;
  stages: readonly { name: string; ratio: number; note: string }[];
  compact?: boolean;
}) {
  return (
    <Card className={compact ? "p-4" : "p-6"}>
      <SectionTitle icon={FileText} title={title} />
      <ul className="space-y-1.5 text-sm">
        {stages.map((stage) => (
          <li
            key={stage.name}
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-ink-20",
              compact ? "px-2.5 py-2" : "px-3 py-2.5",
            )}
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium text-ink">
                {stage.name} · {Math.round(stage.ratio * 100)}%
              </span>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-60">{stage.note}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-brand">
              {formatCurrency(total * stage.ratio)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SchemeAreaBasedCalculator({
  shared,
  schemeDifficulty,
  setSchemeDifficulty,
  difficultyMode,
  setDifficultyMode,
}: {
  shared: LandscapeSharedProps;
  schemeDifficulty: LandscapeSchemeDifficultyKey;
  setSchemeDifficulty: (v: LandscapeSchemeDifficultyKey) => void;
  difficultyMode: "auto" | "manual";
  setDifficultyMode: (v: "auto" | "manual") => void;
}) {
  const {
    pricingConfig,
    projectName,
    projectCity,
    clientName,
    area,
    landscapeCostWan,
    projectType,
    designerLevel,
    designerRegion,
    clientLevel,
    buildType,
    tax,
  } = shared;

  const schemeDifficultyOptions = getSchemeDifficultyOptions(pricingConfig);

  useEffect(() => {
    if (difficultyMode !== "auto" || !landscapeCostWan.trim() || area <= 0) return;
    const wan = Number(landscapeCostWan);
    if (!Number.isFinite(wan) || wan <= 0) return;
    const costPerSqm = (wan * 10000) / area;
    setSchemeDifficulty(inferSchemeDifficultyFromCostPerSqm(costPerSqm, pricingConfig));
  }, [landscapeCostWan, area, difficultyMode, pricingConfig, setSchemeDifficulty]);

  const { tier } = getLandscapeSchemeBaseFee(area || 1, pricingConfig);

  const result = useMemo(
    () =>
      calculateSchemeAreaBasedFee(
        {
          area,
          projectType,
          designerLevel,
          designerRegion,
          clientLevel,
          schemeDifficulty,
          buildType,
          taxCoefficient: tax.coefficient,
        },
        pricingConfig,
      ),
    [
      area,
      projectType,
      designerLevel,
      designerRegion,
      clientLevel,
      schemeDifficulty,
      buildType,
      tax,
      pricingConfig,
    ],
  );

  const activeDifficulty = schemeDifficultyOptions.find((o) => o.key === schemeDifficulty);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
      <div className="space-y-4">
        <Card className="p-6">
          <SectionTitle icon={Sparkles} title="方案难度系数（7.2.2 · 单独选项）" />
          <p className="mb-4 text-[11px] text-ink-40">
            按景观单方造价分档；参与计算出图费。方案基数阶梯：{tier.label}。
          </p>

          <div className="mb-4 space-y-1.5">
            <Label>确定方式</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDifficultyMode("auto")}
                className={pillCls(difficultyMode === "auto")}
              >
                按景观造价自动推断
              </button>
              <button
                type="button"
                onClick={() => setDifficultyMode("manual")}
                className={pillCls(difficultyMode === "manual")}
              >
                手动选择档位
              </button>
            </div>
          </div>

          {difficultyMode === "auto" ? (
            <div className="mb-4 rounded-xl border border-ink-20 bg-ink-20/20 p-4 text-sm">
              {landscapeCostWan.trim() && area > 0 ? (
                <>
                  <div className="text-ink-60">
                    单方造价约{" "}
                    <span className="font-semibold text-ink">
                      {formatCurrency((Number(landscapeCostWan) * 10000) / area)}/㎡
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-ink-60">推断档位：</span>
                    <Badge variant="brand" className="tabular-nums">
                      {activeDifficulty?.label} · {Math.round((activeDifficulty?.coefficient ?? 1) * 100)}%
                    </Badge>
                  </div>
                  {activeDifficulty ? (
                    <p className="mt-2 text-[11px] text-ink-60">{activeDifficulty.remark}</p>
                  ) : null}
                </>
              ) : (
                <p className="text-[11px] text-amber-800">
                  请在上方共用信息中填写「景观面积」与「景观造价（万元）」后，系统将自动匹配难度档位。
                </p>
              )}
            </div>
          ) : (
            <div className="mb-4 space-y-1.5">
              <Label>
                方案难度系数 <span className="text-rose-500">*</span>
              </Label>
              <select
                value={schemeDifficulty}
                onChange={(e) =>
                  setSchemeDifficulty(e.target.value as LandscapeSchemeDifficultyKey)
                }
                className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm text-ink"
              >
                {schemeDifficultyOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}（{Math.round(opt.coefficient * 100)}%）— {opt.remark}
                  </option>
                ))}
              </select>
              {activeDifficulty ? (
                <p className="text-[11px] text-ink-60">
                  当前选用：<span className="font-medium text-ink">{activeDifficulty.label}</span>
                  ，系数 {Math.round(activeDifficulty.coefficient * 100)}% · {activeDifficulty.remark}
                </p>
              ) : null}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {schemeDifficultyOptions.map((opt) => (
              <div
                key={opt.key}
                className={cn(
                  "rounded-lg border px-3 py-2 text-[11px] leading-snug",
                  schemeDifficulty === opt.key
                    ? "border-brand/40 bg-brand/5"
                    : "border-ink-20/80 bg-white/60",
                )}
              >
                <span className="font-semibold text-ink">
                  {opt.label} · {Math.round(opt.coefficient * 100)}%
                </span>
                <span className="mt-1 block text-ink-60">{opt.remark}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-2 p-5 text-[11px] leading-relaxed text-ink-60">
          <p className="font-semibold text-ink">通用备注（委托人可见）</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>本规定自 2026 年 1 月 1 日起执行。报价含普票，专票需额外支付对应费率 + 1% 费用。</li>
            <li>含无限次电话及线上沟通，不含现场服务、打图、见面汇报及差旅。</li>
            <li>报价不含策划、测绘、概算、施工图等。</li>
            <li>方案确认后改动超过总图纸工作量 20% 需额外收费。</li>
          </ul>
          <p className="pt-2 font-semibold text-ink">设计师须知</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>中途停止服务，平台扣除 5% 对应设计费。</li>
            <li>见习设计师两阶段款项在最后成果确认后一并支付。</li>
          </ul>
        </Card>
      </div>

      <Card className="space-y-5 p-6 lg:sticky lg:top-20">
        <SectionTitle icon={Coins} title="报价结果（平台管理员视角）" />
        {projectName || projectCity ? (
          <div className="rounded-xl border border-ink-20 bg-ink-20/20 p-3 text-xs text-ink-60">
            <div className="font-semibold text-ink">{projectName || "（未填项目名称）"}</div>
            {clientName ? <div className="mt-0.5">委托方：{clientName}</div> : null}
            <div className="mt-0.5">项目地：{projectCity || "—"}</div>
          </div>
        ) : null}
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-5">
          <div className="text-[11px] uppercase tracking-wider text-brand">含税合计</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-brand">
            {formatCurrency(result.total)}
          </div>
          <div className="mt-1 text-[11px] text-ink-60">
            税前 {formatCurrency(result.subtotal)} × 税率 {tax.coefficient.toFixed(2)}
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          <Row label={`方案设计费基数（${tier.label}）`} value={result.baseFee} />
          <Row label="出图费" value={result.drawingFee} bold />
          <Row
            label={`平台管理费（含商务费 ${formatCurrency(result.businessFee)}）`}
            value={result.platformFee}
          />
        </div>
        <div className="rounded-xl bg-ink-20/30 p-3 text-[11px]">
          <div className="font-semibold text-ink">应用系数明细</div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-ink-60">
            <CoefRow label="项目区域" v={result.coefficients.region} />
            <CoefRow label="项目类型" v={result.coefficients.projectType} />
            <CoefRow label="设计师等级" v={result.coefficients.designerLevel} />
            <CoefRow label="设计师区域" v={result.coefficients.designerRegion} />
            <CoefRow label="客户等级" v={result.coefficients.clientLevel} />
            <CoefRow label="方案难度" v={result.coefficients.schemeDifficulty} />
            <CoefRow label="建造类型" v={result.coefficients.build} />
            <CoefRow label="税率" v={result.coefficients.tax} />
          </div>
        </div>
        <Button
          variant="brand"
          className="w-full"
          size="lg"
          disabled={!projectName.trim() || !projectCity.trim()}
        >
          <Calculator className="h-4 w-4" /> 生成报价单（mock）
        </Button>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 施工图 · 按面积                                                       */
/* ------------------------------------------------------------------ */

function AreaBasedCalculator({
  shared,
  tracks,
  setTracks,
  difficulty,
  setDifficulty,
}: {
  shared: LandscapeSharedProps;
  tracks: ("hardscape" | "softscape" | "drainage" | "electrical")[];
  setTracks: Dispatch<
    SetStateAction<("hardscape" | "softscape" | "drainage" | "electrical")[]>
  >;
  difficulty: Record<string, number>;
  setDifficulty: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  const {
    pricingConfig,
    projectName,
    projectCity,
    designerCity,
    area,
    projectType,
    designerLevel,
    designerRegion,
    clientLevel,
    buildType,
    tax,
  } = shared;

  const landscapeDifficulty = pricingConfig.landscapeDifficulty;

  useEffect(() => {
    setDifficulty((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const t of ["hardscape", "softscape", "drainage", "electrical"] as const) {
        const ui = landscapeAreaDifficultyUI(t, landscapeDifficulty);
        if (ui.kind === "fixed") {
          if (next[t] !== ui.value) {
            next[t] = ui.value;
            changed = true;
          }
          continue;
        }
        const allowed = ui.options.map((o) => o.value);
        if (!allowed.includes(next[t]!)) {
          next[t] = ui.options[0]?.value ?? 1;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tracks, landscapeDifficulty]);

  const result = useMemo(
    () =>
      calculateAreaBasedFee({
        area,
        projectType,
        designerLevel,
        designerRegion,
        clientLevel,
        selectedTracks: tracks,
        difficulty,
        buildType,
        taxCoefficient: tax.coefficient,
      }, pricingConfig),
    [area, projectType, designerLevel, designerRegion, clientLevel, tracks, difficulty, buildType, tax, pricingConfig],
  );

  const { tier } = getLandscapeBaseFees(area || 1, pricingConfig);

  const toggleTrack = (t: "hardscape" | "softscape" | "drainage" | "electrical") =>
    setTracks((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
      <div className="space-y-4">
        <Card className="p-6">
          <SectionTitle icon={Ruler} title="施工图 · 按面积专项" />
          <p className="mb-3 text-[11px] text-ink-40">
            当前施工图阶梯：<span className="font-medium text-ink">{tier.label}</span> ·
            {tier.isUnitPrice ? "单位价 元/㎡" : "一口价"}。按面积时项目区域系数固定 100%，设计师区域系数取自上方共用信息。
          </p>
          <SectionTitle icon={PieChart} title="选择三级专业 + 难度（文档 3.1.1.2.6）" />
          <div className="space-y-3">
            {(["hardscape", "softscape", "drainage", "electrical"] as const).map((t) => {
              const checked = tracks.includes(t);
              const ui = landscapeAreaDifficultyUI(t, landscapeDifficulty);
              return (
                <div
                  key={t}
                  className={cn(
                    "rounded-xl border p-3 transition-colors",
                    checked ? "border-ink bg-ink-20/20" : "border-ink-20",
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-ink">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTrack(t)}
                          className="mt-0.5 h-4 w-4 shrink-0"
                        />
                        <span>{TRACK_LABEL[t]}</span>
                      </label>
                      {t === "hardscape" ? (
                        <p className="pl-6 text-[11px] leading-relaxed text-ink-60">
                          {getHardscapeScopeNote(landscapeDifficulty)}
                        </p>
                      ) : null}
                    </div>
                    {checked && ui.kind === "select" ? (
                      <div className="flex flex-shrink-0 flex-wrap gap-1.5 sm:justify-end">
                        {ui.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setDifficulty((prev) => ({ ...prev, [t]: opt.value }))
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                              difficulty[t] === opt.value
                                ? "border-brand bg-brand text-white"
                                : "border-ink-20 text-ink-60 hover:border-brand/60",
                            )}
                          >
                            {opt.label} {Math.round(opt.value * 100)}%
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {checked && ui.kind === "fixed" ? (
                      <Badge
                        variant="brand"
                        className="h-fit shrink-0 tabular-nums text-xs font-semibold"
                      >
                        固定 {Math.round(ui.value * 100)}%
                      </Badge>
                    ) : null}
                  </div>
                  {checked && ui.kind === "select" ? (
                    <div className="mt-3 border-t border-dashed border-ink-20/70 pt-3">
                      <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-ink-40">
                        {t === "drainage"
                          ? "选项说明 · 给排水"
                          : `各档难度说明 · ${TRACK_LABEL[t].split("（")[0]?.trim()}`}
                      </div>
                      <div
                        className={cn(
                          "grid gap-2",
                          ui.options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2",
                        )}
                      >
                        {ui.options.map((opt) => (
                          <div
                            key={opt.value}
                            className={cn(
                              "rounded-lg border px-2.5 py-2 text-[11px] leading-snug",
                              difficulty[t] === opt.value
                                ? "border-brand/40 bg-brand/5"
                                : "border-ink-20/80 bg-white/60",
                            )}
                          >
                            <span className="font-semibold text-ink">
                              {opt.label} · {Math.round(opt.value * 100)}%
                            </span>
                            <span className="mt-1 block text-ink-60">{opt.remark}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {checked && ui.kind === "fixed" ? (
                    <div className="mt-3 border-t border-dashed border-ink-20/70 pt-3">
                      <p className="text-[11px] leading-relaxed text-ink-60">{ui.note}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
              园建协调附加系数：勾选园建 + 任一其他三级专业时自动加 10% 协调成本（系数 1.1）。
            </div>
            <div className="rounded-xl bg-amber-50/70 p-3 text-[11px] leading-relaxed text-amber-900">
              文档 3.1.1.2.6：给排水仅在「人工取水 · 100%」与「自动喷灌 ·
              130%」二者择一；电气专业不参与分档，固定按 100% 计。
            </div>
          </div>
        </Card>
      </div>

      {/* 输出 */}
      <Card className="space-y-5 p-6 lg:sticky lg:top-20">
        <SectionTitle icon={Coins} title="报价结果（平台管理员视角）" />

        {projectName || projectCity ? (
          <div className="rounded-xl border border-ink-20 bg-ink-20/20 p-3 text-xs text-ink-60">
            <div className="font-semibold text-ink">
              {projectName || "（未填项目名称）"}
            </div>
            <div className="mt-0.5">
              项目地：{projectCity || "—"} · 设计师：{designerCity || "—"}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-5">
          <div className="text-[11px] uppercase tracking-wider text-brand">
            含税合计
          </div>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-brand">
            {formatCurrency(result.total)}
          </div>
          <div className="mt-1 text-[11px] text-ink-60">
            税前 {formatCurrency(result.subtotal)} × 税率 {tax.coefficient.toFixed(2)}
          </div>
        </div>

        <div className="space-y-1.5 text-sm">
          {Object.entries(result.byTrack).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-ink-60">
                {TRACK_LABEL[k as keyof typeof TRACK_LABEL]}
              </span>
              <span className="font-semibold text-ink">{formatCurrency(v)}</span>
            </div>
          ))}
          <Row label="出图费小计" value={result.drawingFee} bold />
          <Row label={`审图费（出图 × 8%）`} value={result.auditFee} />
          <Row
            label={`项目管理费（出图 × 20%）`}
            value={result.projectManagementFee}
          />
          <Row
            label={`平台管理费（含商务费 ${formatCurrency(result.businessFee)}）`}
            value={result.platformFee}
          />
        </div>

        <div className="rounded-xl bg-ink-20/30 p-3 text-[11px]">
          <div className="font-semibold text-ink">应用系数明细</div>
          <div className="mt-2 grid grid-cols-2 gap-1 text-ink-60">
            <CoefRow label="项目类型" v={result.coefficients.projectType} />
            <CoefRow label="设计师等级" v={result.coefficients.designerLevel} />
            <CoefRow label="设计师区域" v={result.coefficients.designerRegion} />
            <CoefRow label="客户等级" v={result.coefficients.clientLevel} />
            <CoefRow label="园建协调" v={result.coefficients.coordinator} />
            <CoefRow label="建造类型" v={result.coefficients.build} />
            <CoefRow label="项目区域" v={result.coefficients.region} />
            <CoefRow label="税率" v={result.coefficients.tax} />
          </div>
        </div>

        <Button
          variant="brand"
          className="w-full"
          size="lg"
          disabled={!projectName.trim() || !projectCity.trim()}
        >
          <Calculator className="h-4 w-4" /> 生成报价单（mock）
        </Button>
        {!projectName.trim() || !projectCity.trim() ? (
          <div className="text-center text-[11px] text-rose-500">
            请填写项目名称与项目所在地后再生成报价单
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 按时间                                                               */
/* ------------------------------------------------------------------ */

function TimeBasedCalculator({
  shared,
  unit,
  setUnit,
  quantity,
  setQuantity,
  mode,
  setMode,
  withDrawing,
  setWithDrawing,
  track,
  setTrack,
  difficulty,
  setDifficulty,
}: {
  shared: LandscapeSharedProps;
  unit: "day" | "month";
  setUnit: (v: "day" | "month") => void;
  quantity: number;
  setQuantity: (v: number) => void;
  mode: "remote" | "onsite";
  setMode: (v: "remote" | "onsite") => void;
  withDrawing: boolean;
  setWithDrawing: (v: boolean) => void;
  track: "hardscape" | "softscape" | "drainage" | "electrical" | "structure";
  setTrack: (v: "hardscape" | "softscape" | "drainage" | "electrical" | "structure") => void;
  difficulty: number;
  setDifficulty: Dispatch<SetStateAction<number>>;
}) {
  const {
    pricingConfig,
    projectName,
    projectCity,
    designerCity,
    designerLevel,
    designerRegion,
    clientLevel,
    tax,
  } = shared;

  const landscapeDifficulty = pricingConfig.landscapeDifficulty;

  useEffect(() => {
    const ui = landscapeTimeDifficultyUI(track, landscapeDifficulty);
    if (ui.kind === "fixed") {
      setDifficulty(ui.value);
      return;
    }
    const allowed = ui.options.map((o) => o.value);
    setDifficulty((prev) => (allowed.includes(prev) ? prev : ui.options[0]?.value ?? 1));
  }, [track, landscapeDifficulty]);

  const result = useMemo(
    () =>
      calculateTimeBasedFee({
        unit,
        quantity,
        mode,
        track,
        designerLevel,
        designerRegion,
        clientLevel,
        withDrawing,
        difficulty,
        taxCoefficient: tax.coefficient,
      }, pricingConfig),
    [unit, quantity, mode, track, designerLevel, designerRegion, clientLevel, withDrawing, difficulty, tax, pricingConfig],
  );

  const timeUi = landscapeTimeDifficultyUI(track, landscapeDifficulty);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
      <div className="space-y-4">
        <Card className="p-6">
          <SectionTitle icon={Clock} title="施工图 · 按时间专项" />
          <p className="mb-4 text-[11px] text-ink-40">
            项目区域系数固定 100%；设计师区域系数取自上方共用信息。
          </p>
          <SectionTitle icon={Clock} title="计费方式" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>计费单位</Label>
              <div className="flex gap-2">
                <button onClick={() => setUnit("day")} className={pillCls(unit === "day")}>
                  按天
                </button>
                <button onClick={() => setUnit("month")} className={pillCls(unit === "month")}>
                  按月
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{unit === "day" ? "天数" : "月数"}</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
              />
              <div className="text-[11px] text-ink-40">
                {unit === "day" ? "最小 0.5 天" : "最小 1 个月，多余按 月费/20 折算"}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>服务模式</Label>
              <div className="flex gap-2">
                <button onClick={() => setMode("remote")} className={pillCls(mode === "remote")}>
                  远程（100%）
                </button>
                <button onClick={() => setMode("onsite")} className={pillCls(mode === "onsite")}>
                  驻场（{withDrawing ? "110%" : "100%"}）
                </button>
              </div>
              {mode === "onsite" ? (
                <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-60">
                  <input
                    type="checkbox"
                    checked={withDrawing}
                    onChange={(e) => setWithDrawing(e.target.checked)}
                  />
                  驻场含绘图（额外 +10%）
                </label>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>专业方向</Label>
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value as any)}
                className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
              >
                {Object.entries(TRACK_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>
                难度系数 · {TRACK_LABEL[track].split("（")[0]?.trim()}
                {track === "structure"
                  ? "（文档未单列，计算器暂按园建四档系数参考）"
                  : track === "hardscape"
                    ? " · 适用范围见按面积一侧园建说明"
                    : ""}
              </Label>
              {track === "hardscape" ? (
                <p className="text-[11px] leading-relaxed text-ink-60">
                  {getHardscapeScopeNote(landscapeDifficulty)}
                </p>
              ) : null}
              {timeUi.kind === "select" ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {timeUi.options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDifficulty(opt.value)}
                        className={pillCls(difficulty === opt.value)}
                      >
                        {opt.label} {Math.round(opt.value * 100)}%
                      </button>
                    ))}
                  </div>
                  <div
                    className={cn(
                      "mt-2 grid gap-2",
                      timeUi.options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2",
                    )}
                  >
                    {timeUi.options.map((opt) => (
                      <div
                        key={opt.value}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-[11px] leading-snug",
                          difficulty === opt.value
                            ? "border-brand/40 bg-brand/5"
                            : "border-ink-20/80 bg-white/60",
                        )}
                      >
                        <span className="font-semibold text-ink">
                          {opt.label} · {Math.round(opt.value * 100)}%
                        </span>
                        <span className="mt-1 block text-ink-60">{opt.remark}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Badge variant="brand" className="tabular-nums text-xs font-semibold">
                    固定 {Math.round(timeUi.value * 100)}%
                  </Badge>
                  <p className="text-[11px] leading-relaxed text-ink-60">{timeUi.note}</p>
                </div>
              )}
              <div className="text-[11px] text-ink-40">
                与文档 3.1.1.2.6 一致：给排水为人工取水 / 自动喷灌二选一；电气固定
                100%；园建、绿化为四档备注。
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-5 p-6 lg:sticky lg:top-20">
        <SectionTitle icon={Coins} title="报价结果" />
        {projectName || projectCity ? (
          <div className="rounded-xl border border-ink-20 bg-ink-20/20 p-3 text-xs text-ink-60">
            <div className="font-semibold text-ink">
              {projectName || "（未填项目名称）"}
            </div>
            <div className="mt-0.5">
              项目地：{projectCity || "—"} · 设计师：{designerCity || "—"}
            </div>
          </div>
        ) : null}
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-5">
          <div className="text-[11px] uppercase tracking-wider text-brand">含税合计</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight text-brand">
            {formatCurrency(result.total)}
          </div>
          <div className="mt-1 text-[11px] text-ink-60">
            税前 {formatCurrency(result.subtotal)} × 税率 {tax.coefficient.toFixed(2)}
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          <Row
            label={`基础费 (${formatCurrency(result.perUnit)} × ${quantity} × 系数)`}
            value={result.basicFee}
          />
          <Row
            label={`平台管理费（含商务费 ${formatCurrency(result.businessFee)}）`}
            value={result.platformFee}
          />
        </div>
        <Button
          variant="brand"
          className="w-full"
          size="lg"
          disabled={!projectName.trim() || !projectCity.trim()}
        >
          <Calculator className="h-4 w-4" /> 生成报价单（mock）
        </Button>
        {!projectName.trim() || !projectCity.trim() ? (
          <div className="text-center text-[11px] text-rose-500">
            请填写项目名称与项目所在地后再生成报价单
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 小组件                                                               */
/* ------------------------------------------------------------------ */

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
      <Icon className="h-4 w-4" />
      {title}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-t border-ink-20 pt-1.5 text-sm">
      <span className={bold ? "font-semibold text-ink" : "text-ink-60"}>{label}</span>
      <span className={bold ? "font-semibold text-ink" : "text-ink"}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function CoefRow({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-semibold text-ink">{Math.round(v * 100)}%</span>
    </div>
  );
}

function CoeffSelector<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function pillCls(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs transition-colors ${
    active ? "border-ink bg-ink text-white" : "border-ink-20 text-ink-60 hover:border-ink/40"
  }`;
}
