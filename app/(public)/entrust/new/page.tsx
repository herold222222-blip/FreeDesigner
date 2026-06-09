"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdministrativeRegionSelector,
  getDefaultAdministrativeTriple,
  resolveAdministrativeTriple,
  type AdministrativeTriple,
} from "@/components/domain/administrative-region-selector";
import {
  SPECIALTIES,
  SPECIALTY_TRACKS,
  getProjectTypes,
} from "@/lib/constants";
import { getL2Options } from "@/lib/bounty-filters";
import {
  getL3OptionsForL2s,
  pruneL3ForL2s,
} from "@/lib/bounty-tracks";
import { BountyTrackMultiSelect } from "@/components/domain/bounty-track-multi-select";
import { bountyLocationFromTriple } from "@/components/domain/bounty-filters-panel";
import {
  CUSTOMER_SERVICE_CONTACTS,
  formatCustomerServiceLine,
} from "@/lib/customer-service";
import {
  getHardscapeScopeNote,
  landscapeAreaDifficultyUI,
  landscapeTimeDifficultyUI,
} from "@/lib/landscape-area-difficulty";
import type { Specialty } from "@/lib/types";
import {
  ArrowLeft,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Coins,
  FileText,
  Megaphone,
  Paperclip,
  Phone,
  PlusCircle,
  Ruler,
  Sparkles,
  TimerReset,
  Users,
  X,
} from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";
import { useClient } from "@/lib/use-data";
import { createBountyRequest, createOrderRequest } from "@/lib/api-client";
import {
  buildBountyCreateBody,
  buildRegularEntrustDescription,
  buildRegularEntrustOrderBody,
} from "@/lib/entrust-submit";
import {
  canClientPublishEntrust,
  clientPublishBlockedMessage,
} from "@/lib/client-publish-guard";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import { formatCurrency, cn } from "@/lib/utils";
import { PreferredDesignersField } from "@/components/domain/preferred-designers-field";
import {
  BountySubjectFiltersEditor,
  EMPTY_BOUNTY_SUBJECT_FILTERS,
  packBountySubjectFilters,
} from "@/components/domain/bounty-subject-filters-editor";
import { parseDesignerCodesInput } from "@/lib/designer-code";
import { PlatformTimeBillingStandardCard } from "@/components/domain/platform-time-billing-standard-card";

type EntrustMode = "regular" | "bounty";
type BillingMode = "area" | "daily" | "monthly";

const TRACK_OPTIONS = [
  { value: "hardscape", label: "园建（Hardscape）" },
  { value: "softscape", label: "绿化（Softscape）" },
  { value: "drainage", label: "给排水（Drainage）" },
  { value: "electrical", label: "电气（Electrical）" },
] as const;

type TrackKey = (typeof TRACK_OPTIONS)[number]["value"];

export default function NewEntrustPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-20 text-center text-ink-60">
          加载发布委托表单...
        </div>
      }
    >
      <NewEntrustInner />
    </Suspense>
  );
}

function NewEntrustInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialMode = (params.get("mode") as EntrustMode) || "regular";
  const identityId = useRoleStore((s) => s.identityId);
  const role = useRoleStore((s) => s.role);
  const { data: client, loading: clientLoading } = useClient(
    role === "client" ? identityId : null,
  );

  const [mode, setMode] = useState<EntrustMode>(initialMode);

  useEffect(() => {
    const m = params.get("mode");
    if (m === "bounty") setMode("bounty");
    else setMode("regular");
  }, [params]);

  if (
    role === "client" &&
    !clientLoading &&
    client &&
    !canClientPublishEntrust(client)
  ) {
    return (
      <div className="container-page py-10">
        <Link
          href="/client"
          className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 返回工作台
        </Link>
        <Card className="mx-auto max-w-lg space-y-4 p-8 text-center">
          <Badge variant="amber">企业认证审核中</Badge>
          <h1 className="text-xl font-semibold text-ink">暂不可发布委托</h1>
          <p className="text-sm leading-relaxed text-ink-60">
            {clientPublishBlockedMessage(client)}
          </p>
          <Button asChild variant="brand">
            <Link href="/client">返回委托人工作台</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page py-10">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回首页
      </Link>

      <div className="mb-8">
        <Badge variant="muted" className="mb-2 gap-1">
          <Sparkles className="h-3 w-3 text-brand" /> v1.1 全新统一委托入口
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          发布委托项目
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-60">
          一处入口，两种模式：选择 <strong className="text-ink">常规委托</strong>{" "}
          按平台标准定价直接生成报价单； 选择{" "}
          <strong className="text-ink">悬赏委托</strong>{" "}
          自定义预算让设计师主动报名。
        </p>
      </div>

      {/* 模式切换：抬高叠层，避免下方双列 sticky 侧栏在部分浏览器下向上命中抢占 */}
      <div className="relative z-[3] mb-6 grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={mode === "regular"}
          onClick={() => setMode("regular")}
          accent="brand"
          icon={ClipboardList}
          title="常规委托"
          description="按平台规则取费，所有等级设计师可参与"
          tags={["按面积 / 按天 / 按月", "自动计算报价单", "支持加购审图与项目管理"]}
        />
        <ModeCard
          active={mode === "bounty"}
          onClick={() => setMode("bounty")}
          accent="amber"
          icon={Megaphone}
          title="悬赏委托"
          description="自行定价，仅中级以上设计师可参与"
          tags={["确定悬赏金额", "公开发布让设计师报名", "选定后自动生成订单与合同"]}
        />
      </div>

      {/* 备选：直接电话委托 */}
      <Card className="relative z-[3] mb-6 flex flex-wrap items-center justify-between gap-3 bg-ink-20/30 p-4">
        <div className="flex items-center gap-3 text-sm text-ink-60">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
            <Phone className="h-4 w-4 text-brand" />
          </div>
          <div>
            <div className="font-semibold text-ink">不熟悉规则？</div>
            <div className="text-xs">
              直接拨打客服电话，由我们协助你下单（建筑：4006-8021231-1 ·
              景观：4006-801231-2 · 室内：4006-801231-3）
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="tel:4006801231">立即来电</a>
        </Button>
      </Card>

      {mode === "regular" ? <RegularEntrustForm /> : <BountyEntrustForm />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 模式选择卡片                                                         */
/* ------------------------------------------------------------------ */

function ModeCard({
  active,
  onClick,
  accent,
  icon: Icon,
  title,
  description,
  tags,
}: {
  active: boolean;
  onClick: () => void;
  accent: "brand" | "amber";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tags: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col rounded-3xl border p-6 text-left transition-all cursor-pointer",
        active
          ? accent === "brand"
            ? "border-brand bg-brand/5 shadow-md"
            : "border-amber-400 bg-amber-50 shadow-md"
          : "border-ink-20 bg-white hover:border-ink/40",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl",
            active
              ? accent === "brand"
                ? "bg-brand text-white"
                : "bg-amber-500 text-white"
              : "bg-ink-20/50 text-ink",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-semibold text-ink">{title}</div>
          <div className="text-xs text-ink-60">{description}</div>
        </div>
        {active ? (
          <CheckCircle2
            className={cn(
              "ml-auto h-5 w-5",
              accent === "brand" ? "text-brand" : "text-amber-600",
            )}
          />
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Badge key={t} variant="outline" className="text-[10px]">
            {t}
          </Badge>
        ))}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 常规委托表单                                                          */
/* ------------------------------------------------------------------ */

function RegularEntrustForm() {
  const router = useRouter();
  const push = useSessionStore((s) => s.pushNotification);
  const role = useRoleStore((s) => s.role);
  const identityId = useRoleStore((s) => s.identityId);
  const setRole = useRoleStore((s) => s.setRole);
  const [submitting, setSubmitting] = useState(false);
  const pricingConfig = usePlatformPricingStore((s) => s.config);
  const landscapeDifficulty = pricingConfig.landscapeDifficulty;
  const projectTypesLandscape = Object.keys(pricingConfig.landscapeProjectTypeCoefficient);

  // 项目信息
  const [title, setTitle] = useState("");
  const [committerName, setCommitterName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [preferredDesignerInput, setPreferredDesignerInput] = useState("");
  const [projectAdminTriple, setProjectAdminTriple] = useState<AdministrativeTriple>(
    () => getDefaultAdministrativeTriple(),
  );
  const projectSiteResolution = useMemo(
    () => resolveAdministrativeTriple(projectAdminTriple),
    [projectAdminTriple],
  );
  const projectCity = projectSiteResolution?.fullLabel ?? "";

  const [specialty, setSpecialty] = useState<Specialty>("landscape");
  const [projectType, setProjectType] = useState("高层住宅");

  // 计费方式
  const [billingMode, setBillingMode] = useState<BillingMode>("area");
  const [area, setArea] = useState(8000);
  const [budget, setBudget] = useState<number | "">("");
  const [days, setDays] = useState(10);
  const [months, setMonths] = useState(1);
  const [serviceMode, setServiceMode] = useState<"remote" | "onsite">("remote");
  const [withDrawing, setWithDrawing] = useState(false);
  const [trackKey, setTrackKey] = useState<TrackKey | "">("");
  const [areaDifficulty, setAreaDifficulty] = useState<
    Partial<Record<TrackKey, number>>
  >({});
  const [timeDifficulty, setTimeDifficulty] = useState<number | null>(null);

  // 三级专业（按面积时，默认不勾选）
  const [tracks, setTracks] = useState<TrackKey[]>([]);
  const [subjectFilters, setSubjectFilters] = useState(EMPTY_BOUNTY_SUBJECT_FILTERS);
  const [buildType, setBuildType] = useState<"new" | "renovation">("new");

  // 增值服务
  const [withAudit, setWithAudit] = useState(false);
  const [withPM, setWithPM] = useState(false);

  // 描述与附件
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<string[]>(["项目任务书.pdf"]);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);

  const [tax, setTax] = useState(pricingConfig.taxOptions[0]!);

  useEffect(() => {
    if (role === "guest") setRole("client");
  }, [role, setRole]);

  useEffect(() => {
    if (!pricingConfig.taxOptions.some((item) => item.value === tax.value)) {
      setTax(pricingConfig.taxOptions[0]!);
    }
  }, [pricingConfig.taxOptions, tax.value]);

  useEffect(() => {
    setAreaDifficulty((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of tracks) {
        const ui = landscapeAreaDifficultyUI(t, landscapeDifficulty);
        if (ui.kind === "fixed") {
          if (next[t] !== ui.value) {
            next[t] = ui.value;
            changed = true;
          }
          continue;
        }
        if (next[t] != null) {
          const allowed = ui.options.map((o) => o.value);
          if (!allowed.includes(next[t]!)) {
            delete next[t];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [tracks, landscapeDifficulty]);

  useEffect(() => {
    if (!trackKey) {
      setTimeDifficulty(null);
      return;
    }
    const ui = landscapeTimeDifficultyUI(trackKey, landscapeDifficulty);
    if (ui.kind === "fixed") {
      setTimeDifficulty(ui.value);
      return;
    }
    setTimeDifficulty((prev) => {
      if (prev == null) return null;
      const allowed = ui.options.map((o) => o.value);
      return allowed.includes(prev) ? prev : null;
    });
  }, [trackKey, landscapeDifficulty]);

  const timeDiffUiEntrust = trackKey
    ? landscapeTimeDifficultyUI(trackKey, landscapeDifficulty)
    : null;

  const basicInfoComplete =
    !!title.trim() &&
    !!contactName.trim() &&
    !!contactPhone.trim() &&
    !!projectSiteResolution &&
    !!projectType.trim();

  const billingComplete =
    billingMode === "area"
      ? area > 0 && tracks.length > 0
      : !!trackKey &&
        (billingMode === "daily" ? days >= 0.5 : months >= 1);

  const descriptionComplete = !!description.trim();

  const canSubmit =
    basicInfoComplete && !!specialty && billingComplete && descriptionComplete;

  const submitHint = (() => {
    const missing: string[] = [];
    if (!basicInfoComplete) missing.push("项目基础信息");
    if (!specialty) missing.push("设计专业");
    if (!billingComplete) missing.push("计费方式");
    if (!descriptionComplete) missing.push("项目描述");
    if (!missing.length) return null;
    return `请完善必填项：${missing.join("、")}`;
  })();

  const toggleTrack = (t: TrackKey) =>
    setTracks((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSubmitQuote = async () => {
    if (!canSubmit || quoteSubmitted || submitting) {
      if (!canSubmit) {
        push({
          title: submitHint ?? "请完善必填项",
          variant: "destructive",
        });
      }
      return;
    }
    if (role === "guest" || !identityId) {
      push({
        title: "请先登录",
        description: "发布常规委托需使用委托人账号登录。",
        variant: "destructive",
      });
      router.push("/login?redirect=/entrust/new");
      return;
    }
    setSubmitting(true);
    try {
      const fullDescription = buildRegularEntrustDescription({
        description,
        contactName,
        contactPhone,
        projectCity,
        committerName,
        billingMode,
        area,
        days,
        months,
        tracks,
        trackKey: trackKey || undefined,
        withAudit,
        withPM,
      });
      const body = buildRegularEntrustOrderBody({
        title,
        specialty,
        projectType,
        billingMode,
        serviceMode: serviceMode === "remote" ? "online" : "onsite",
        description: fullDescription,
        area,
        budget,
        withAudit,
        withPM,
      });
      const order = await createOrderRequest(body);
      setQuoteSubmitted(true);
      push({
        title: "常规委托已提交",
        description: `订单 ${order.code} 已进入匹配，平台将确认费用并委派设计师。`,
        variant: "success",
      });
      router.push("/client/orders");
    } catch (e) {
      push({
        title: "提交失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative isolate z-0">
      <div className="relative z-[2] min-w-0 space-y-4">
        {/* 项目基本信息 */}
        <Card className="p-6">
          <SectionTitle icon={FileText} title="项目基础信息（必填）" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldFull label="项目名称" required>
              <Input
                placeholder="例如：杭州未来社区中心庭院"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FieldFull>
            <Field label="委托方名称">
              <Input
                placeholder="如已入驻则自动填充"
                value={committerName}
                onChange={(e) => setCommitterName(e.target.value)}
              />
            </Field>
            <Field label="联系人" required>
              <Input
                placeholder="可与委托方一致或另行输入"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </Field>
            <Field label="联系方式（手机号）" required>
              <Input
                placeholder="将通过短信验证"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </Field>
            <FieldFull label="项目所在地" required>
              <div className="relative z-[5] space-y-1">
                <AdministrativeRegionSelector
                  triple={projectAdminTriple}
                  onTripleChange={setProjectAdminTriple}
                />
              </div>
            </FieldFull>
            <Field label="项目类型" required>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
              >
                {(specialty === "landscape"
                  ? projectTypesLandscape
                  : getProjectTypes(specialty)
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
                    {specialty === "landscape" && pricingConfig.landscapeProjectTypeCoefficient[t]
                      ? `（${Math.round(pricingConfig.landscapeProjectTypeCoefficient[t] * 100)}%）`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
            <FieldFull label="">
              <PreferredDesignersField
                value={preferredDesignerInput}
                onChange={setPreferredDesignerInput}
              />
            </FieldFull>
          </div>
        </Card>

        {/* 一级专业选择 */}
        <Card className="p-6">
          <SectionTitle icon={Sparkles} title="设计专业（必填）" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {SPECIALTIES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setSpecialty(s.value);
                  setProjectType(
                    s.value === "landscape"
                      ? "高层住宅"
                      : getProjectTypes(s.value)[0] ?? "",
                  );
                }}
                className={cn(
                  "rounded-xl border p-3 text-left text-sm transition-all",
                  specialty === s.value
                    ? "border-ink bg-ink text-white"
                    : "border-ink-20 hover:border-ink/40",
                )}
              >
                <div className="font-semibold">{s.label}</div>
              </button>
            ))}
          </div>
          {specialty !== "landscape" ? (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800">
              ⚠ 当前 v1.1 仅景观专业开放在线计费报价。
              其他专业暂以悬赏委托或电话咨询方式下单。
            </div>
          ) : null}
        </Card>

        {/* 计费方式 */}
        <Card className="p-6">
          <SectionTitle icon={Calculator} title="计费方式（必填）" />
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { v: "area", l: "按面积报价（出图 / 扩初 / 竣工）", icon: Ruler },
              { v: "daily", l: "按天计费（远程 / 驻场）", icon: Calendar },
              { v: "monthly", l: "按月雇佣（远程 / 驻场）", icon: TimerReset },
            ].map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.v}
                  type="button"
                  onClick={() => setBillingMode(b.v as BillingMode)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                    billingMode === b.v
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-ink-20 text-ink-60 hover:border-ink/40",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {b.l}
                </button>
              );
            })}
          </div>

          {billingMode !== "area" && specialty === "landscape" ? (
            <div className="mb-4">
              <PlatformTimeBillingStandardCard
                unit={billingMode === "daily" ? "day" : "month"}
                config={pricingConfig}
                highlightTrack={trackKey}
                showOnsiteDrawingNote={serviceMode === "onsite" && withDrawing}
              />
            </div>
          ) : null}

          {billingMode === "area" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="景观面积（㎡）">
                <Input
                  type="number"
                  value={area}
                  onChange={(e) => setArea(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="景观造价（万元，选填）">
                <Input
                  type="number"
                  value={budget}
                  onChange={(e) =>
                    setBudget(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </Field>
              <FieldFull label="三级专业与各专业难度系数（文档 3.1.1.2.6）">
                <div className="space-y-3">
                  {TRACK_OPTIONS.map((spec) => {
                    const tk = spec.value as TrackKey;
                    const checked = tracks.includes(tk);
                    const ui = landscapeAreaDifficultyUI(tk, landscapeDifficulty);
                    return (
                      <div
                        key={tk}
                        className={cn(
                          "rounded-xl border p-3 transition-colors",
                          checked ? "border-ink bg-ink-20/25" : "border-ink-20",
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <label className="flex cursor-pointer items-start gap-2 text-sm font-medium text-ink">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleTrack(tk)}
                                className="mt-0.5 h-4 w-4 shrink-0"
                              />
                              <span>{spec.label}</span>
                            </label>
                            {tk === "hardscape" ? (
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
                                    setAreaDifficulty((prev) => ({
                                      ...prev,
                                      [tk]: opt.value,
                                    }))
                                  }
                                  className={cn(
                                    "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                                    areaDifficulty[tk] === opt.value
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
                              {tk === "drainage"
                                ? "选项说明 · 给排水"
                                : `难度说明 · ${spec.label.split("（")[0]?.trim()}`}
                            </div>
                            <div
                              className={cn(
                                "grid gap-2",
                                ui.options.length === 2 ?
                                  "sm:grid-cols-2"
                                : "sm:grid-cols-2",
                              )}
                            >
                              {ui.options.map((opt) => (
                                <div
                                  key={opt.value}
                                  className={cn(
                                    "rounded-lg border px-2.5 py-2 text-[11px] leading-snug",
                                    areaDifficulty[tk] === opt.value
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
                <p className="mt-3 rounded-xl bg-amber-50/80 p-2.5 text-[11px] leading-relaxed text-amber-900">
                  勾选园建并同时勾选任一其他三级专业时，自动套用园建协调附加系数{" "}
                  <span className="font-semibold">1.1</span>
                  （与计算器一致）。
                </p>
              </FieldFull>
              <Field label="建造类型">
                <div className="flex gap-2">
                  {[
                    { v: "new" as const, l: "新建（100%）" },
                    { v: "renovation" as const, l: "改扩建（110%）" },
                  ].map((b) => (
                    <button
                      key={b.v}
                      type="button"
                      onClick={() => setBuildType(b.v)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        buildType === b.v
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {b.l}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="税率">
                <div className="flex flex-wrap gap-2">
                  {pricingConfig.taxOptions.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTax(t)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        tax.value === t.value
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={billingMode === "daily" ? "天数" : "月数"}>
                <Input
                  type="number"
                  value={billingMode === "daily" ? days : months}
                  onChange={(e) =>
                    billingMode === "daily"
                      ? setDays(Number(e.target.value) || 0)
                      : setMonths(Number(e.target.value) || 0)
                  }
                />
                <div className="mt-1 text-[11px] text-ink-40">
                  {billingMode === "daily"
                    ? "最小 0.5 天"
                    : "最小 1 月，多余按 月费/20 折算"}
                </div>
              </Field>
              <Field label="服务模式">
                <div className="flex gap-2">
                  {[
                    { v: "remote" as const, l: "远程（100%）" },
                    { v: "onsite" as const, l: "驻场" },
                  ].map((m) => (
                    <button
                      key={m.v}
                      type="button"
                      onClick={() => setServiceMode(m.v)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        serviceMode === m.v
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {m.l}
                    </button>
                  ))}
                </div>
                {serviceMode === "onsite" ? (
                  <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-60">
                    <input
                      type="checkbox"
                      checked={withDrawing}
                      onChange={(e) => setWithDrawing(e.target.checked)}
                    />
                    驻场含绘图（额外 +10%）
                  </label>
                ) : null}
              </Field>
              <Field label="三级专业">
                <select
                  value={trackKey}
                  onChange={(e) =>
                    setTrackKey(e.target.value as TrackKey | "")
                  }
                  className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
                >
                  <option value="">请选择三级专业</option>
                  {TRACK_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              {trackKey && timeDiffUiEntrust ? (
              <FieldFull
                label={`难度系数 · ${
                  TRACK_OPTIONS.find((s) => s.value === trackKey)?.label ??
                  "专业分支"
                }（按时间 · 文档 3.1.1.2.6）`}
              >
                {trackKey === "hardscape" ?
                  <p className="mb-3 text-[11px] leading-relaxed text-ink-60">
                    {getHardscapeScopeNote(landscapeDifficulty)}
                  </p>
                : null}
                {timeDiffUiEntrust.kind === "select" ?
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {timeDiffUiEntrust.options.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setTimeDifficulty(opt.value)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-[11px] transition-colors",
                            timeDifficulty === opt.value ?
                              "border-brand bg-brand text-white"
                            : "border-ink-20 text-ink-60 hover:border-brand/60",
                          )}
                        >
                          {opt.label} {Math.round(opt.value * 100)}%
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {timeDiffUiEntrust.options.map((opt) => (
                        <div
                          key={opt.value}
                          className={cn(
                            "rounded-lg border px-2.5 py-2 text-[11px] leading-snug",
                            timeDifficulty === opt.value ?
                              "border-brand/40 bg-brand/5"
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
                : <div className="space-y-2">
                    <Badge variant="brand" className="tabular-nums text-xs font-semibold">
                      固定 {Math.round(timeDiffUiEntrust.value * 100)}%
                    </Badge>
                    <p className="text-[11px] leading-relaxed text-ink-60">
                      {timeDiffUiEntrust.note}
                    </p>
                  </div>
                }
              </FieldFull>
              ) : null}
              <Field label="税率">
                <div className="flex flex-wrap gap-2">
                  {pricingConfig.taxOptions.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTax(t)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        tax.value === t.value
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Users} title="设计主体筛选（选填）" />
          <BountySubjectFiltersEditor
            value={subjectFilters}
            onChange={setSubjectFilters}
          />
        </Card>

        {/* 描述 + 附件 */}
        <Card className="p-6">
          <SectionTitle icon={FileText} title="项目描述与附件（必填）" />
          <FieldFull label="项目描述" required>
            <Textarea
              rows={5}
              placeholder="请描述项目背景、规模、交付深度、关键节点等"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FieldFull>
          <div className="mt-4">
            <Label>项目附件</Label>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {attachments.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-ink-20 bg-ink-20/20 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 text-sm text-ink">
                    <Paperclip className="h-3.5 w-3.5 text-ink-60" />
                    {a}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments(attachments.filter((_, j) => j !== i))
                    }
                    className="text-ink-40 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setAttachments([
                    ...attachments,
                    `附件_${attachments.length + 1}.pdf`,
                  ])
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink-20 p-2.5 text-sm text-ink-60 hover:border-ink/40 hover:text-ink"
              >
                <Paperclip className="h-3.5 w-3.5" /> 上传附件
              </button>
            </div>
          </div>
        </Card>

        {/* 增值服务 */}
        <Card className="p-6">
          <SectionTitle icon={Sparkles} title="v1.1 增值服务（可选）" />
          <div className="grid gap-3 md:grid-cols-2">
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                withAudit
                  ? "border-amber-400 bg-amber-50"
                  : "border-ink-20 hover:border-amber-300",
              )}
            >
              <input
                type="checkbox"
                checked={withAudit}
                onChange={(e) => setWithAudit(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="amber">第三方审图</Badge>
                  <span className="text-xs text-ink-60">+8% 设计费</span>
                </div>
                <p className="mt-1.5 text-xs text-ink-60">
                  独立审图师审核图纸并出具审图文档，对设计师专业水平五档评级。
                </p>
              </div>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                withPM
                  ? "border-violet-400 bg-violet-50"
                  : "border-ink-20 hover:border-violet-300",
              )}
            >
              <input
                type="checkbox"
                checked={withPM}
                onChange={(e) => setWithPM(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="violet">项目管理</Badge>
                  <span className="text-xs text-ink-60">+20% 设计费</span>
                </div>
                <p className="mt-1.5 text-xs text-ink-60">
                  项目经理对外沟通、对内协调各专业，出具会议纪要并把控进度。
                </p>
              </div>
            </label>
          </div>
        </Card>

        {quoteSubmitted ? (
          <Card className="space-y-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="space-y-3 text-sm leading-relaxed text-ink-80">
                <p className="font-semibold text-ink">感谢提交</p>
                <p>
                  我们的客服会在 1 小时内跟您联系确认报价。另外您也可以直接拨打我们的服务电话：
                </p>
                <ul className="space-y-2 text-xs text-ink-60">
                  {CUSTOMER_SERVICE_CONTACTS.map((c) => (
                    <li key={c.id}>
                      <a
                        href={`tel:4006801231,${c.extension}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {formatCustomerServiceLine(c)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="space-y-4 p-6">
            <SectionTitle icon={Coins} title="人工报价" />
            <p className="text-xs leading-relaxed text-ink-60">
              填写完整项目信息后提交，客服将根据您的需求核算报价并在 1 小时内联系确认，本页不显示实时报价。
            </p>
            <Button
              variant="brand"
              size="lg"
              className="w-full sm:w-auto sm:min-w-[200px]"
              disabled={!canSubmit || submitting}
              onClick={handleSubmitQuote}
            >
              <ClipboardList className="h-4 w-4" />{" "}
              {submitting ? "提交中..." : "提交委托"}
            </Button>
            {submitHint ? (
              <div className="text-[11px] text-rose-500">{submitHint}</div>
            ) : null}
            <div className="flex items-start gap-1.5 text-[11px] text-ink-60">
              <Phone className="mt-0.5 h-3 w-3 shrink-0 text-brand" />
              也可直接拨打业务热线咨询报价。
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 悬赏委托表单                                                          */
/* ------------------------------------------------------------------ */

function BountyEntrustForm() {
  const router = useRouter();
  const push = useSessionStore((s) => s.pushNotification);
  const role = useRoleStore((s) => s.role);
  const identityId = useRoleStore((s) => s.identityId);
  const setRole = useRoleStore((s) => s.setRole);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [committerName, setCommitterName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [preferredDesignerInput, setPreferredDesignerInput] = useState("");
  const [bountyAdminTriple, setBountyAdminTriple] = useState<AdministrativeTriple>(() =>
    getDefaultAdministrativeTriple(),
  );
  const bountySiteResolution = useMemo(
    () => resolveAdministrativeTriple(bountyAdminTriple),
    [bountyAdminTriple],
  );
  const projectCity = bountySiteResolution?.fullLabel ?? "";

  const [specialty, setSpecialty] = useState<Specialty>("landscape");
  const [trackL2, setTrackL2] = useState<string[]>(["construction_doc"]);
  const [trackL3, setTrackL3] = useState<string[]>(["ls_drainage"]);
  const [locationPublishMode, setLocationPublishMode] = useState<
    "province" | "city"
  >("city");
  const [projectType, setProjectType] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState(50000);
  const [deadline, setDeadline] = useState("");
  const [reqs, setReqs] = useState<string[]>(["有相关项目实战案例"]);
  const [reqInput, setReqInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>(["项目任务书.pdf"]);
  const [subjectFilters, setSubjectFilters] = useState(EMPTY_BOUNTY_SUBJECT_FILTERS);

  useEffect(() => {
    if (role === "guest") setRole("client");
  }, [role, setRole]);

  const addReq = () => {
    if (!reqInput.trim()) return;
    setReqs([...reqs, reqInput.trim()]);
    setReqInput("");
  };

  const l2Options = useMemo(() => getL2Options(specialty), [specialty]);
  const l3Options = useMemo(
    () => getL3OptionsForL2s(specialty, trackL2),
    [specialty, trackL2],
  );

  const canSubmit =
    title.trim() &&
    contactName.trim() &&
    contactPhone.trim() &&
    description.trim() &&
    deadline &&
    reward >= 1000 &&
    trackL2.length > 0 &&
    trackL3.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) {
      if (!canSubmit) {
        push({
          title: "请完善必填项（项目名称、联系人、电话、描述、成果提交时间）",
          variant: "destructive",
        });
      }
      return;
    }
    if (role === "guest" || !identityId) {
      push({
        title: "请先登录",
        description: "发布悬赏需使用委托人账号登录。",
        variant: "destructive",
      });
      router.push("/login?redirect=/entrust/new?mode=bounty");
      return;
    }
    const location = bountyLocationFromTriple(
      bountyAdminTriple,
      locationPublishMode,
    );
    setSubmitting(true);
    try {
      const bounty = await createBountyRequest(
        buildBountyCreateBody({
          title,
          specialty,
          primaryTrack: { l1: specialty, l2: trackL2, l3: trackL3 },
          projectType,
          location,
          description,
          reward,
          deadline,
          requirements: reqs,
          attachments: attachments.map((name) => ({ name })),
          preferredDesignerCodes: parseDesignerCodesInput(preferredDesignerInput),
          subjectFilters: packBountySubjectFilters(subjectFilters),
          contactName,
          contactPhone,
          projectCity,
        }),
      );
      push({
        title: "悬赏委托发布成功",
        description: `编号 ${bounty.code}，符合专业的设计师将能看到并报名。`,
        variant: "success",
      });
      router.push(`/client/bounties/${bounty.id}`);
    } catch (e) {
      push({
        title: "发布失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative isolate z-0">
      <div className="relative z-[2] min-w-0 space-y-4">
        <Card className="p-6">
          <SectionTitle icon={FileText} title="项目基础信息" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldFull label="项目名称" required>
              <Input
                placeholder="例如：苏州相城区 8 万㎡ 城市公园方案征集"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FieldFull>
            <Field label="委托方名称">
              <Input
                placeholder="如已入驻则自动填充"
                value={committerName}
                onChange={(e) => setCommitterName(e.target.value)}
              />
            </Field>
            <Field label="联系人" required>
              <Input
                placeholder="可与委托方一致或另行输入"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </Field>
            <Field label="联系方式（手机号）" required>
              <Input
                placeholder="将通过短信验证"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </Field>
            <FieldFull label="项目所在地" required>
              <div className="relative z-[5] space-y-3">
                <div className="flex rounded-full border border-ink-20 p-0.5 text-xs w-fit">
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1",
                      locationPublishMode === "province"
                        ? "bg-ink text-white"
                        : "text-ink-60",
                    )}
                    onClick={() => setLocationPublishMode("province")}
                  >
                    仅公布到省份
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1",
                      locationPublishMode === "city"
                        ? "bg-ink text-white"
                        : "text-ink-60",
                    )}
                    onClick={() => setLocationPublishMode("city")}
                  >
                    精确到城市
                  </button>
                </div>
                <AdministrativeRegionSelector
                  triple={bountyAdminTriple}
                  onTripleChange={setBountyAdminTriple}
                />
              </div>
            </FieldFull>
            <FieldFull label="">
              <PreferredDesignersField
                value={preferredDesignerInput}
                onChange={setPreferredDesignerInput}
              />
            </FieldFull>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Sparkles} title="专业与项目类型" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="所属专业" required>
              <Select
                value={specialty}
                onValueChange={(v) => {
                  const s = v as Specialty;
                  setSpecialty(s);
                  setProjectType("");
                  const l1 = SPECIALTY_TRACKS.find((t) => t.value === s);
                  const l2 = l1?.l2[0]?.value ?? "";
                  const l3 = l1?.l2[0]?.l3[0]?.value ?? "";
                  setTrackL2(l2 ? [l2] : []);
                  setTrackL3(l3 ? [l3] : []);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="项目类型">
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目类型" />
                </SelectTrigger>
                <SelectContent>
                  {getProjectTypes(specialty).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <FieldFull label="二级专业（可多选）" required>
              <BountyTrackMultiSelect
                options={l2Options.map((o) => ({ value: o.value, label: o.label }))}
                value={trackL2}
                onChange={(next) => {
                  setTrackL2(next);
                  setTrackL3((prev) => pruneL3ForL2s(specialty, next, prev));
                }}
              />
            </FieldFull>
            <FieldFull label="三级专业（可多选）" required>
              <BountyTrackMultiSelect
                options={l3Options}
                value={trackL3}
                onChange={setTrackL3}
                showGroup={trackL2.length > 1}
              />
              <p className="mt-1.5 text-xs text-ink-40">
                设计师报名时将选择其中一个三级专业承接。
              </p>
            </FieldFull>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Users} title="设计主体筛选（选填）" />
          <BountySubjectFiltersEditor
            value={subjectFilters}
            onChange={setSubjectFilters}
          />
        </Card>

        <Card className="p-6">
          <SectionTitle icon={FileText} title="项目描述与服务要求" />
          <FieldFull label="项目详细描述" required>
            <Textarea
              rows={5}
              placeholder="请描述项目背景、规模、设计深度、关键节点、汇报时间等"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FieldFull>
          <div className="mt-4">
            <Label>服务要求（可逐条添加）</Label>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="例如：5 年以上市政公园经验"
                value={reqInput}
                onChange={(e) => setReqInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReq();
                  }
                }}
              />
              <Button variant="outline" onClick={addReq}>
                <PlusCircle className="h-4 w-4" /> 添加
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {reqs.map((r, i) => (
                <Badge
                  key={i}
                  variant="muted"
                  className="cursor-pointer gap-1 pr-1"
                  onClick={() => setReqs(reqs.filter((_, j) => j !== i))}
                >
                  {r}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Coins} title="悬赏预算与成果提交时间" />
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldFull label="悬赏金额（¥）" required>
              <Input
                type="number"
                step={1000}
                min={1000}
                value={reward}
                onChange={(e) => setReward(Number(e.target.value || 0))}
              />
              <p className="mt-1.5 text-xs text-ink-40">
                悬赏须填写确定费用，选定设计师后转入平台托管。
              </p>
            </FieldFull>
            <Field label="成果提交时间" required>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-ink-40">
                设计师须在此日期前提交设计成果。
              </p>
            </Field>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle icon={Paperclip} title="项目附件" />
          <div className="grid gap-2 md:grid-cols-2">
            {attachments.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border border-ink-20 bg-ink-20/20 px-3 py-2.5"
              >
                <div className="flex items-center gap-2 text-sm text-ink">
                  <Paperclip className="h-3.5 w-3.5 text-ink-60" />
                  {a}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments(attachments.filter((_, j) => j !== i))
                  }
                  className="text-ink-40 hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setAttachments([
                  ...attachments,
                  `附件_${attachments.length + 1}.pdf`,
                ])
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink-20 p-2.5 text-sm text-ink-60 hover:border-ink/40 hover:text-ink"
            >
              <Paperclip className="h-3.5 w-3.5" /> 上传附件
            </button>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="mb-1 text-xs uppercase tracking-wider text-ink-40">
            悬赏预算预览
          </div>
          <div className="text-3xl font-bold tracking-tight text-amber-600">
            {formatCurrency(reward)}
          </div>
          <p className="text-xs text-ink-60">选定设计师后金额转入平台托管</p>

          <div className="space-y-2 text-[11px] text-ink-60">
            <div className="flex items-start gap-1.5">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              发布后所有符合专业的设计师可在悬赏大厅自主报名。
            </div>
            <div className="flex items-start gap-1.5">
              <Coins className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
              选定中标设计师后系统自动生成正式订单与电子合同。
            </div>
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-amber-800">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
              悬赏委托仅中级以上设计师可参与；次级 / 灰名单委托人无法发布。
            </div>
          </div>

          <Button
            variant="brand"
            size="lg"
            className="w-full sm:w-auto sm:min-w-[240px]"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            <Megaphone className="h-4 w-4" />{" "}
            {submitting ? "发布中..." : "立即发布悬赏委托"}
          </Button>
          {!canSubmit ? (
            <div className="text-[11px] text-rose-500">
              请填写项目名称、联系人、电话、描述、成果提交时间
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 小组件                                                                */
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function FieldFull({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <Label>
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

