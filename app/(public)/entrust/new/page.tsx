"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import {
  MAX_ATTACHMENT_LABEL,
  findOversizedAttachment,
  oversizedAttachmentMessage,
} from "@/lib/attachment-limits";
import { getL2Options } from "@/lib/bounty-filters";
import {
  getL2Labels,
  getL3Label,
  getL3OptionsForL2s,
  landscapeL3SelectionConflict,
  pruneL3ForL2s,
  reconcileLandscapeL2Selection,
  reconcileLandscapeL3Selection,
} from "@/lib/bounty-tracks";
import { BountyTrackMultiSelect } from "@/components/domain/bounty-track-multi-select";
import {
  LANDSCAPE_TIME_TRACK_LABELS,
  landscapeTimeTrackFromL3,
  type LandscapeTimeRateTrack,
} from "@/lib/designer-rates";
import { bountyLocationFromTriple } from "@/components/domain/bounty-filters-panel";
import {
  CUSTOMER_SERVICE_CONTACTS,
  formatCustomerServiceLine,
} from "@/lib/customer-service";
import {
  difficultyOptionKey,
  filterTimeDifficultyOptionsByServiceMode,
  getHardscapeScopeNote,
  hasLandscapeTimeDifficultySelect,
  landscapeAreaDifficultyUI,
  landscapeTimeDifficultyUI,
  resolveTimeDifficultyDisplay,
} from "@/lib/landscape-area-difficulty";
import type { BountyAttachment, Specialty } from "@/lib/types";
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
import { GuestAccessGate } from "@/components/domain/guest-access-gate";

type EntrustMode = "regular" | "bounty";
type BillingMode = "area" | "daily" | "monthly";

const headingLabelClass =
  "text-sm font-semibold normal-case tracking-normal text-ink";

const TRACK_OPTIONS = [
  { value: "hardscape", label: "园建（Hardscape）" },
  { value: "softscape", label: "绿化（Softscape）" },
  { value: "drainage", label: "给排水（Drainage）" },
  { value: "electrical", label: "电气（Electrical）" },
] as const;

type TrackKey = (typeof TRACK_OPTIONS)[number]["value"];

export default function NewEntrustPage() {
  return (
    <GuestAccessGate intent="publish">
      <Suspense
        fallback={
          <div className="container-page py-20 text-center text-ink-60">
            加载发布委托表单...
          </div>
        }
      >
        <NewEntrustInner />
      </Suspense>
    </GuestAccessGate>
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
  const [projectAdminTriple, setProjectAdminTriple] = useState<AdministrativeTriple>({
    provinceCode: "",
    cityCode: "",
    countyCode: null,
  });
  const projectSiteResolution = useMemo(
    () => resolveAdministrativeTriple(projectAdminTriple),
    [projectAdminTriple],
  );
  const projectCity = projectSiteResolution?.fullLabel ?? "";

  const [specialty, setSpecialty] = useState<Specialty>("landscape");
  const [projectType, setProjectType] = useState("");

  // 计费方式
  const [billingMode, setBillingMode] = useState<BillingMode | null>(null);
  const [area, setArea] = useState<number | "">("");
  const [budget, setBudget] = useState<number | "">("");
  const [serviceMode, setServiceMode] = useState<"remote" | "onsite">("remote");
  const [withDrawing, setWithDrawing] = useState(false);
  const [areaDifficulty, setAreaDifficulty] = useState<
    Partial<Record<TrackKey, number>>
  >({});
  /** 一级专业下的二级多选；按天/按月时再选三级并填天数 */
  const [selectedL2, setSelectedL2] = useState<string[]>([]);
  const [timeL3, setTimeL3] = useState<string[]>([]);
  const [daysByL3, setDaysByL3] = useState<Record<string, number>>({});
  const [monthsByL3, setMonthsByL3] = useState<Record<string, number>>({});
  /** pending = 不确定待系统评估；estimate = 自行预估工时；未选则无默认 */
  const [timeQtyModeByL3, setTimeQtyModeByL3] = useState<
    Record<string, "pending" | "estimate">
  >({});
  /** 按时间难度选中项 key（difficultyOptionKey），避免给排水等同系数档位无法区分 */
  const [timeDifficultyByTrack, setTimeDifficultyByTrack] = useState<
    Partial<Record<LandscapeTimeRateTrack, string>>
  >({});

  // 三级专业（按面积时，默认不勾选）
  const [tracks, setTracks] = useState<TrackKey[]>([]);
  const [subjectFilters, setSubjectFilters] = useState(EMPTY_BOUNTY_SUBJECT_FILTERS);
  const [buildType, setBuildType] = useState<"new" | "renovation" | null>(null);

  const l2Options = useMemo(() => getL2Options(specialty), [specialty]);
  const timeL3Options = useMemo(
    () => getL3OptionsForL2s(specialty, selectedL2),
    [specialty, selectedL2],
  );
  const timePricingTracks = useMemo(() => {
    const set = new Set<LandscapeTimeRateTrack>();
    for (const l3 of timeL3) {
      const tk = landscapeTimeTrackFromL3(l3);
      if (tk) set.add(tk);
    }
    return [...set];
  }, [timeL3]);

  // 增值服务
  const [withAudit, setWithAudit] = useState(false);
  const [withPM, setWithPM] = useState(false);

  // 描述与附件
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<BountyAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);

  const formatAttachmentSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAttachmentFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const oversized = findOversizedAttachment(list);
    if (oversized) {
      push({
        title: "附件过大",
        description: oversizedAttachmentMessage(oversized.name),
        variant: "destructive",
      });
      return;
    }
    setUploadingAttachment(true);
    Promise.all(
      list.map(
        (file) =>
          new Promise<BountyAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== "string") {
                reject(new Error("读取失败"));
                return;
              }
              resolve({
                name: file.name,
                url: reader.result,
                size: file.size,
              });
            };
            reader.onerror = () => reject(new Error("读取失败"));
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((items) => {
        setAttachments((prev) => [...prev, ...items]);
      })
      .catch(() => {
        push({
          title: "附件上传失败",
          description: "请重新选择文件后再试。",
          variant: "destructive",
        });
      })
      .finally(() => {
        setUploadingAttachment(false);
        if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      });
  };

  const [tax, setTax] = useState<{
    value: string;
    label: string;
    coefficient: number;
  } | null>(null);

  useEffect(() => {
    if (!tax) return;
    if (!pricingConfig.taxOptions.some((item) => item.value === tax.value)) {
      setTax(null);
    }
  }, [pricingConfig.taxOptions, tax]);

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
    setTimeDifficultyByTrack((prev) => {
      const next: Partial<Record<LandscapeTimeRateTrack, string>> = {};
      let changed = false;
      for (const tk of timePricingTracks) {
        if (!hasLandscapeTimeDifficultySelect(tk)) continue;
        const ui = landscapeTimeDifficultyUI(tk, landscapeDifficulty);
        if (ui.kind !== "select" || !ui.options.length) continue;
        const allowed = filterTimeDifficultyOptionsByServiceMode(
          tk,
          ui.options,
          serviceMode,
        ).map(difficultyOptionKey);
        if (prev[tk] != null && allowed.includes(prev[tk]!)) {
          next[tk] = prev[tk];
        } else if (prev[tk] != null) {
          changed = true;
        }
      }
      if (Object.keys(prev).length !== Object.keys(next).length) changed = true;
      return changed ? next : prev;
    });
  }, [timePricingTracks, landscapeDifficulty, serviceMode]);

  const basicInfoComplete =
    !!title.trim() &&
    !!contactName.trim() &&
    !!contactPhone.trim() &&
    !!projectSiteResolution &&
    !!projectType.trim();

  const areaDifficultyComplete =
    billingMode !== "area" ||
    tracks.every((tk) => {
      const ui = landscapeAreaDifficultyUI(tk, landscapeDifficulty);
      if (ui.kind !== "select") return true;
      return areaDifficulty[tk] != null;
    });

  const timeDifficultyComplete =
    billingMode === "area" ||
    timePricingTracks.every((tk) => {
      if (!hasLandscapeTimeDifficultySelect(tk)) return true;
      const ui = landscapeTimeDifficultyUI(tk, landscapeDifficulty);
      if (ui.kind !== "select") return true;
      const options = filterTimeDifficultyOptionsByServiceMode(
        tk,
        ui.options,
        serviceMode,
      );
      if (!options.length) return true;
      const selected = timeDifficultyByTrack[tk];
      return (
        selected != null &&
        options.some((opt) => difficultyOptionKey(opt) === selected)
      );
    });

  const billingComplete =
    !!billingMode &&
    selectedL2.length > 0 &&
    !!tax &&
    (billingMode === "area"
      ? area > 0 && tracks.length > 0 && !!buildType && areaDifficultyComplete
      : timeL3.length > 0 &&
        timeDifficultyComplete &&
        timeL3.every((l3) => {
          const mode = timeQtyModeByL3[l3];
          if (mode === "pending") return true;
          if (mode === "estimate") {
            return billingMode === "daily"
              ? (daysByL3[l3] ?? 0) >= 0.5
              : (monthsByL3[l3] ?? 0) >= 1;
          }
          return false;
        }));

  const descriptionComplete = !!description.trim();

  const submitHint = (() => {
    const missing: string[] = [];
    if (!basicInfoComplete) missing.push("项目基础信息");
    if (!specialty) missing.push("设计专业");
    if (!billingComplete) {
      if (!billingMode) missing.push("计费方式");
      if (billingMode === "area" && !buildType) missing.push("建造类型");
      if (!tax) missing.push("税率");
      if (
        (billingMode === "area" && !areaDifficultyComplete) ||
        ((billingMode === "daily" || billingMode === "monthly") &&
          !timeDifficultyComplete)
      ) {
        missing.push("难度系数");
      }
      if (
        billingMode &&
        (selectedL2.length === 0 ||
          (billingMode === "area"
            ? !(area > 0 && tracks.length > 0)
            : timeL3.length === 0))
      ) {
        missing.push(billingMode === "area" ? "三级专业" : "三级专业工时");
      }
    }
    if (!descriptionComplete) missing.push("项目描述");
    if (!missing.length) return null;
    return `请完善必填项：${missing.join("、")}`;
  })();

  const toggleTrack = (t: TrackKey) =>
    setTracks((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const firstIncompleteFieldId = (): string | null => {
    if (!title.trim()) return "field-title";
    if (!contactName.trim()) return "field-contact-name";
    if (!contactPhone.trim()) return "field-contact-phone";
    if (!projectSiteResolution) return "field-project-site";
    if (!projectType.trim()) return "field-project-type";
    if (selectedL2.length === 0) return "field-l2";
    if (!billingMode) return "field-billing-mode";
    if (billingMode === "area") {
      if (!(area > 0)) return "field-area";
      if (tracks.length === 0 || !areaDifficultyComplete) return "field-tracks";
      if (!buildType) return "field-build-type";
      if (!tax) return "field-tax";
    } else {
      if (timeL3.length === 0) return "field-l3";
      const qtyMissing = timeL3.some((l3) => {
        const mode = timeQtyModeByL3[l3];
        if (mode === "pending") return false;
        if (mode === "estimate") {
          return billingMode === "daily"
            ? (daysByL3[l3] ?? 0) < 0.5
            : (monthsByL3[l3] ?? 0) < 1;
        }
        return true;
      });
      if (qtyMissing) return "field-time-qty";
      if (!timeDifficultyComplete) {
        const missing = timePricingTracks.find((tk) => {
          if (!hasLandscapeTimeDifficultySelect(tk)) return false;
          const ui = landscapeTimeDifficultyUI(tk, landscapeDifficulty);
          if (ui.kind !== "select") return false;
          const options = filterTimeDifficultyOptionsByServiceMode(
            tk,
            ui.options,
            serviceMode,
          );
          if (!options.length) return false;
          const selected = timeDifficultyByTrack[tk];
          return !(
            selected != null &&
            options.some((opt) => difficultyOptionKey(opt) === selected)
          );
        });
        return missing
          ? `field-time-difficulty-${missing}`
          : "field-l3";
      }
      if (!tax) return "field-tax";
    }
    if (!description.trim()) return "field-description";
    return null;
  };

  const scrollToField = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = el.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), textarea, select, button:not([disabled])",
    );
    focusable?.focus({ preventScroll: true });
  };

  const handleSubmitQuote = async () => {
    if (quoteSubmitted || submitting) return;
    const incomplete = firstIncompleteFieldId();
    if (incomplete) {
      scrollToField(incomplete);
      push({
        title: submitHint ?? "请完善必填项",
        variant: "destructive",
      });
      return;
    }
    if (!tax) return;
    if (!billingMode) return;
    if (billingMode === "area" && !buildType) return;
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
        tracks,
        timeL2Labels: getL2Labels(specialty, selectedL2),
        timeL3Units:
          billingMode === "area"
            ? undefined
            : timeL3.map((l3) => {
                const pending = timeQtyModeByL3[l3] === "pending";
                const track = landscapeTimeTrackFromL3(l3);
                const diff = resolveTimeDifficultyDisplay({
                  track: track ?? undefined,
                  difficultyKey: track
                    ? timeDifficultyByTrack[track]
                    : undefined,
                });
                return {
                  label: getL3Label(specialty, l3),
                  units: pending
                    ? billingMode === "daily"
                      ? 10
                      : 1
                    : billingMode === "daily"
                      ? (daysByL3[l3] ?? 0)
                      : (monthsByL3[l3] ?? 0),
                  unitLabel: billingMode === "daily" ? "工日" : "个月",
                  pending,
                  difficultyLabel: diff?.label,
                  difficulty: diff?.value,
                  remark: diff?.remark,
                };
              }),
        withAudit,
        withPM,
        buildType: billingMode === "area" ? buildType : undefined,
        taxLabel: tax.label,
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
        attachments,
        withDrawing: serviceMode === "onsite" ? withDrawing : false,
        taxCoefficient: tax.coefficient,
        timeQuoteLines:
          billingMode === "area"
            ? undefined
            : timeL3.map((l3) => {
                const track = landscapeTimeTrackFromL3(l3);
                const pending = timeQtyModeByL3[l3] === "pending";
                return {
                  l3,
                  l3Label: getL3Label(specialty, l3),
                  quantity: pending
                    ? billingMode === "daily"
                      ? 10
                      : 1
                    : billingMode === "daily"
                      ? (daysByL3[l3] ?? 0)
                      : (monthsByL3[l3] ?? 0),
                  difficultyKey: track
                    ? timeDifficultyByTrack[track]
                    : undefined,
                };
              }),
      });
      const order = await createOrderRequest(body);
      setQuoteSubmitted(true);
      if (order.status === "pending_quote") {
        push({
          title: "报价单已生成",
          description: `订单 ${order.code} 已生成见习/中级/高级/特级四档报价，请选卡后匹配设计师。`,
          variant: "success",
        });
        router.push(`/client/orders/${order.id}`);
      } else {
        push({
          title: "常规委托已提交",
          description: `订单 ${order.code} 已进入匹配，平台将确认费用并委派设计师。`,
          variant: "success",
        });
        router.push("/client/orders");
      }
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
            <FieldFull label="项目名称" required anchor="field-title">
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
            <Field label="联系人" required anchor="field-contact-name">
              <Input
                placeholder="可与委托方一致或另行输入"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </Field>
            <Field label="联系方式（手机号）" required anchor="field-contact-phone">
              <Input
                placeholder="将通过短信验证"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </Field>
            <FieldFull label="项目所在地" required anchor="field-project-site">
              <div className="relative z-[5] space-y-1">
                <AdministrativeRegionSelector
                  triple={projectAdminTriple}
                  onTripleChange={setProjectAdminTriple}
                />
              </div>
            </FieldFull>
            <Field label="项目类型" required anchor="field-project-type">
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
              >
                <option value="" disabled>
                  请选择项目类型
                </option>
                {(specialty === "landscape"
                  ? projectTypesLandscape
                  : getProjectTypes(specialty)
                ).map((t) => (
                  <option key={t} value={t}>
                    {t}
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

        {/* 一级 / 二级专业 */}
        <Card className="p-6">
          <SectionTitle icon={Sparkles} title="一级专业（必填）" />
          <div className="relative z-[6] grid grid-cols-2 gap-2 sm:grid-cols-5">
            {SPECIALTIES.map((s) => {
              const open = s.value === "landscape";
              return (
                <button
                  key={s.value}
                  type="button"
                  disabled={!open}
                  title={open ? undefined : "该专业暂未开放在线委托"}
                  onClick={() => {
                    if (!open) return;
                    setSpecialty(s.value);
                    setProjectType("");
                    setSelectedL2([]);
                    setTimeL3([]);
                    setDaysByL3({});
                    setMonthsByL3({});
                    setTimeDifficultyByTrack({});
                  }}
                  className={cn(
                    "rounded-xl border p-3 text-left text-sm transition-all",
                    !open &&
                      "cursor-not-allowed border-ink-20/60 bg-ink-20/40 text-ink-40",
                    open && specialty === s.value
                      ? "cursor-pointer border-ink bg-ink text-white"
                      : open
                        ? "cursor-pointer border-ink-20 bg-white text-ink hover:border-ink/40"
                        : null,
                  )}
                >
                  <div className="font-semibold">{s.label}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-800">
            当前仅景观设计开放在线计费委托。建筑设计、室内设计、效果图 / 动画、造价咨询暂未启用，请改用悬赏委托或电话咨询。
          </div>

          <div id="field-l2" className="mt-5 scroll-mt-24 space-y-2">
            <Label className={headingLabelClass}>
              二级专业（可多选）
              <span className="ml-1 text-rose-500">*</span>
            </Label>
            <BountyTrackMultiSelect
              options={l2Options.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              value={selectedL2}
              onChange={(next) => {
                const resolved =
                  specialty === "landscape"
                    ? reconcileLandscapeL2Selection(selectedL2, next)
                    : next;
                setSelectedL2(resolved);
                const pruned = pruneL3ForL2s(specialty, resolved, timeL3);
                setTimeL3(pruned);
                setDaysByL3((prev) => {
                  const keep: Record<string, number> = {};
                  for (const l3 of pruned) {
                    if (prev[l3] != null) keep[l3] = prev[l3];
                  }
                  return keep;
                });
                setMonthsByL3((prev) => {
                  const keep: Record<string, number> = {};
                  for (const l3 of pruned) {
                    if (prev[l3] != null) keep[l3] = prev[l3];
                  }
                  return keep;
                });
              }}
            />
            {specialty === "landscape" ? (
              <p className="text-xs text-ink-40">
                可选：景观方案设计、景观扩初设计、景观施工图设计。施工图已包含扩初，二者不可同时勾选。
              </p>
            ) : null}
          </div>
        </Card>

        {/* 计费方式 */}
        <Card className="p-6">
          <SectionTitle icon={Calculator} title="计费方式（必填）" />
          <div id="field-billing-mode" className="mb-4 flex scroll-mt-24 flex-wrap gap-2">
            {[
              { v: "area", l: "按面积报价", icon: Ruler },
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

          {(billingMode === "daily" || billingMode === "monthly") &&
          specialty === "landscape" ? (
            <div className="mb-4">
              <PlatformTimeBillingStandardCard
                unit={billingMode === "daily" ? "day" : "month"}
                config={pricingConfig}
                highlightTrack={
                  (timePricingTracks.find((t) =>
                    (
                      [
                        "hardscape",
                        "softscape",
                        "drainage",
                        "electrical",
                      ] as const
                    ).includes(t as TrackKey),
                  ) as TrackKey | undefined) ?? ""
                }
                showOnsiteDrawingNote={serviceMode === "onsite" && withDrawing}
              />
            </div>
          ) : null}

          {billingMode === "area" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="景观面积（㎡）" required anchor="field-area">
                <Input
                  type="number"
                  placeholder="请填写景观面积"
                  value={area}
                  onChange={(e) =>
                    setArea(e.target.value === "" ? "" : Number(e.target.value))
                  }
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
              <FieldFull label="三级专业与各专业难度系数（文档 3.1.1.2.6）" heading required anchor="field-tracks">
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
                            <div className="flex flex-shrink-0 flex-col items-start gap-1 sm:items-end">
                              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                                {ui.options.map((opt) => (
                                  <button
                                    key={difficultyOptionKey(opt)}
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
                              {areaDifficulty[tk] == null ? (
                                <span className="text-[10px] text-rose-500">
                                  请选择难度系数
                                </span>
                              ) : null}
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
              <Field label="建造类型" required heading anchor="field-build-type">
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
              <Field label="税率" required heading anchor="field-tax">
                <div className="flex flex-wrap gap-2">
                  {pricingConfig.taxOptions.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTax(t)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        tax?.value === t.value
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
          ) : billingMode === "daily" || billingMode === "monthly" ? (
            <div className="space-y-4">
              <Field label="服务模式" heading>
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

              <FieldFull label="三级专业（可多选）" required heading anchor="field-l3">
                <BountyTrackMultiSelect
                  options={timeL3Options}
                  value={timeL3}
                  showGroup={selectedL2.length > 1}
                  onChange={(next) => {
                    const resolved =
                      specialty === "landscape"
                        ? reconcileLandscapeL3Selection(timeL3, next)
                        : next;
                    const conflict =
                      specialty === "landscape"
                        ? landscapeL3SelectionConflict(timeL3, next)
                        : null;
                    if (conflict) {
                      push({
                        title: "不可同时选择",
                        description: conflict,
                        variant: "destructive",
                      });
                    }
                    setTimeL3(resolved);
                    setDaysByL3((prev) => {
                      const keep: Record<string, number> = {};
                      for (const l3 of resolved) {
                        keep[l3] = prev[l3] ?? 10;
                      }
                      return keep;
                    });
                    setMonthsByL3((prev) => {
                      const keep: Record<string, number> = {};
                      for (const l3 of resolved) {
                        keep[l3] = prev[l3] ?? 1;
                      }
                      return keep;
                    });
                    setTimeQtyModeByL3((prev) => {
                      const keep: Record<string, "pending" | "estimate"> = {};
                      for (const l3 of resolved) {
                        if (prev[l3]) keep[l3] = prev[l3];
                      }
                      return keep;
                    });
                  }}
                />
                <p className="mt-1.5 text-xs text-ink-40">
                  {selectedL2.length === 0
                    ? "请先在上方选择二级专业。"
                    : `每个勾选的三级专业需确认工时（可待系统评估，或自行填写预估${billingMode === "daily" ? "天数" : "月数"}）。`}
                </p>
              </FieldFull>

              {timeL3.length > 0 ? (
                <FieldFull
                  label={
                    billingMode === "daily"
                      ? "各三级专业天数（必填）"
                      : "各三级专业月数（必填）"
                  }
                  required
                  anchor="field-time-qty"
                >
                  <div className="space-y-2">
                    {timeL3.map((l3) => {
                      const opt = timeL3Options.find((o) => o.value === l3);
                      const label =
                        opt?.group ?
                          `${opt.group} · ${opt.label}`
                        : (opt?.label ?? getL3Label(specialty, l3));
                      const mode = timeQtyModeByL3[l3];
                      const estimateLabel =
                        billingMode === "daily" ? "预估天数" : "预估月数";
                      return (
                        <div
                          key={l3}
                          className="space-y-2.5 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2.5"
                        >
                          <div className="text-sm font-medium text-ink">
                            {label}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {(
                              [
                                { v: "pending" as const, l: "不确定，待系统评估" },
                                { v: "estimate" as const, l: estimateLabel },
                              ] as const
                            ).map((m) => (
                              <button
                                key={m.v}
                                type="button"
                                onClick={() => {
                                  setTimeQtyModeByL3((prev) => ({
                                    ...prev,
                                    [l3]: m.v,
                                  }));
                                  if (m.v === "estimate") {
                                    if (billingMode === "daily") {
                                      setDaysByL3((prev) => ({
                                        ...prev,
                                        [l3]: prev[l3] > 0 ? prev[l3] : 10,
                                      }));
                                    } else {
                                      setMonthsByL3((prev) => ({
                                        ...prev,
                                        [l3]: prev[l3] > 0 ? prev[l3] : 1,
                                      }));
                                    }
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
                                  min={billingMode === "daily" ? 0.5 : 1}
                                  step={billingMode === "daily" ? 0.5 : 1}
                                  className="h-9 w-28"
                                  value={
                                    billingMode === "daily"
                                      ? (daysByL3[l3] ?? "")
                                      : (monthsByL3[l3] ?? "")
                                  }
                                  onChange={(e) => {
                                    const n = Number(e.target.value) || 0;
                                    if (billingMode === "daily") {
                                      setDaysByL3((prev) => ({
                                        ...prev,
                                        [l3]: n,
                                      }));
                                    } else {
                                      setMonthsByL3((prev) => ({
                                        ...prev,
                                        [l3]: n,
                                      }));
                                    }
                                  }}
                                />
                                <span className="text-xs text-ink-40">
                                  {billingMode === "daily" ? "天" : "月"}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-ink-40">
                    {billingMode === "daily"
                      ? "每个专业最小 0.5 天"
                      : "每个专业最小 1 月，多余按 月费/20 折算"}
                    。委托人填写的
                    {billingMode === "daily" ? "天数" : "月数"}
                    仅为参考，以最终系统确认的数量为准。
                  </p>
                </FieldFull>
              ) : null}

              {specialty === "landscape"
                ? timePricingTracks
                    .filter(hasLandscapeTimeDifficultySelect)
                    .map((tk) => {
                      const ui = landscapeTimeDifficultyUI(
                        tk,
                        landscapeDifficulty,
                      );
                      if (ui.kind !== "select") return null;
                      const options = filterTimeDifficultyOptionsByServiceMode(
                        tk,
                        ui.options,
                        serviceMode,
                      );
                      if (!options.length) return null;
                      const selected = timeDifficultyByTrack[tk];
                      return (
                        <FieldFull
                          key={tk}
                          label={`难度系数 · ${LANDSCAPE_TIME_TRACK_LABELS[tk]}（按天 / 按月）`}
                          required
                          heading
                          anchor={`field-time-difficulty-${tk}`}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            {options.map((opt) => {
                              const key = difficultyOptionKey(opt);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() =>
                                    setTimeDifficultyByTrack((prev) => ({
                                      ...prev,
                                      [tk]: key,
                                    }))
                                  }
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-[11px] transition-colors",
                                    selected === key
                                      ? "border-brand bg-brand text-white"
                                      : "border-ink-20 text-ink-60 hover:border-brand/60",
                                  )}
                                >
                                  {opt.label} {Math.round(opt.value * 100)}%
                                </button>
                              );
                            })}
                          </div>
                          {selected == null ? (
                            <p className="mt-1.5 text-[10px] text-rose-500">
                              请选择难度系数
                            </p>
                          ) : null}
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {options.map((opt) => {
                              const key = difficultyOptionKey(opt);
                              return (
                                <div
                                  key={key}
                                  className={cn(
                                    "rounded-lg border px-2.5 py-2 text-[11px] leading-snug",
                                    selected === key
                                      ? "border-brand/40 bg-brand/5"
                                      : "border-ink-20/80 bg-white/60",
                                  )}
                                >
                                  <span className="font-semibold text-ink">
                                    {opt.label} · {Math.round(opt.value * 100)}%
                                  </span>
                                  <span className="mt-1 block text-ink-60">
                                    {opt.remark}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </FieldFull>
                      );
                    })
                : null}

              <Field label="税率" required heading anchor="field-tax">
                <div className="flex flex-wrap gap-2">
                  {pricingConfig.taxOptions.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTax(t)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition-colors",
                        tax?.value === t.value
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
            <p className="text-xs text-ink-40">
              请选择计费方式后继续填写面积或工时信息。
            </p>
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
          <FieldFull label="项目描述" required anchor="field-description">
            <Textarea
              rows={5}
              placeholder="请描述项目背景、规模、交付深度、关键节点等"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FieldFull>
          <div className="mt-4">
            <Label>项目附件</Label>
            <p className="mt-1 text-xs text-ink-40">
              请上传任务书、现状资料等真实文件（可选，单文件不超过 {MAX_ATTACHMENT_LABEL}）。
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {attachments.map((a, i) => (
                <div
                  key={`${a.name}-${i}`}
                  className="flex items-center justify-between rounded-xl border border-ink-20 bg-ink-20/20 px-3 py-2.5"
                >
                  <div className="min-w-0 flex items-center gap-2 text-sm text-ink">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-60" />
                    <span className="truncate">{a.name}</span>
                    {a.size ? (
                      <span className="shrink-0 text-xs text-ink-40">
                        {formatAttachmentSize(a.size)}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments(attachments.filter((_, j) => j !== i))
                    }
                    className="ml-2 shrink-0 text-ink-40 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={uploadingAttachment}
                onClick={() => attachmentInputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink-20 p-2.5 text-sm text-ink-60 hover:border-ink/40 hover:text-ink disabled:opacity-50"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {uploadingAttachment ? "上传中..." : "上传附件"}
              </button>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.zip,.rar,.jpg,.jpeg,.png,.webp"
                onChange={(e) => handleAttachmentFiles(e.target.files)}
              />
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
                  {billingMode === "daily" || billingMode === "monthly"
                    ? "系统已生成报价单，请前往订单详情确认；确认后将通知管理员分配设计师。"
                    : "我们的客服会在 1 小时内跟您联系确认报价。另外您也可以直接拨打我们的服务电话："}
                </p>
                {billingMode === "area" ? (
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
                ) : null}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="space-y-4 p-6">
            <SectionTitle
              icon={Coins}
              title={
                billingMode === "daily" || billingMode === "monthly"
                  ? "系统报价"
                  : "人工报价"
              }
            />
            <p className="text-xs leading-relaxed text-ink-60">
              {billingMode === "daily" || billingMode === "monthly"
                ? "提交后系统将按您选择服务内容自动生成多个对应不同设计师等级的报价单；您确认报价后，会自动匹配设计师供选择。"
                : "填写完整项目信息后提交，客服将根据您的需求核算报价并在 1 小时内联系确认，本页不显示实时报价。"}
            </p>
            <Button
              variant="brand"
              size="lg"
              className="w-full sm:w-auto sm:min-w-[200px]"
              disabled={submitting}
              onClick={handleSubmitQuote}
            >
              <ClipboardList className="h-4 w-4" />{" "}
              {submitting
                ? "提交中..."
                : billingMode === "daily" || billingMode === "monthly"
                  ? "提交并生成报价"
                  : "提交委托"}
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
  const [reward, setReward] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reqs, setReqs] = useState<string[]>(["有相关项目实战案例"]);
  const [reqInput, setReqInput] = useState("");
  const [attachments, setAttachments] = useState<BountyAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [subjectFilters, setSubjectFilters] = useState(EMPTY_BOUNTY_SUBJECT_FILTERS);

  const rewardAmount = Math.round(Number(reward));

  const addReq = () => {
    if (!reqInput.trim()) return;
    setReqs([...reqs, reqInput.trim()]);
    setReqInput("");
  };

  const formatAttachmentSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAttachmentFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const oversized = findOversizedAttachment(list);
    if (oversized) {
      push({
        title: "附件过大",
        description: oversizedAttachmentMessage(oversized.name),
        variant: "destructive",
      });
      return;
    }
    setUploadingAttachment(true);
    Promise.all(
      list.map(
        (file) =>
          new Promise<BountyAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== "string") {
                reject(new Error("读取失败"));
                return;
              }
              resolve({
                name: file.name,
                url: reader.result,
                size: file.size,
              });
            };
            reader.onerror = () => reject(new Error("读取失败"));
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((items) => {
        setAttachments((prev) => [...prev, ...items]);
      })
      .catch(() => {
        push({
          title: "附件上传失败",
          description: "请重新选择文件后再试。",
          variant: "destructive",
        });
      })
      .finally(() => {
        setUploadingAttachment(false);
        if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      });
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
    Number.isFinite(rewardAmount) &&
    rewardAmount >= 1000 &&
    trackL2.length > 0 &&
    trackL3.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) {
      if (!canSubmit) {
        push({
          title: "请完善必填项（项目名称、联系人、电话、描述、悬赏金额、成果提交时间）",
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
          reward: rewardAmount,
          deadline,
          requirements: reqs,
          attachments,
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
                  const resolved =
                    specialty === "landscape"
                      ? reconcileLandscapeL2Selection(trackL2, next)
                      : next;
                  setTrackL2(resolved);
                  setTrackL3((prev) => pruneL3ForL2s(specialty, resolved, prev));
                }}
              />
              {specialty === "landscape" ? (
                <p className="mt-1.5 text-xs text-ink-40">
                  施工图已包含扩初，二者不可同时勾选。
                </p>
              ) : null}
            </FieldFull>
            <FieldFull label="三级专业（可多选）" required>
              <BountyTrackMultiSelect
                options={l3Options}
                value={trackL3}
                showGroup={trackL2.length > 1}
                onChange={(next) => {
                  const resolved =
                    specialty === "landscape"
                      ? reconcileLandscapeL3Selection(trackL3, next)
                      : next;
                  const conflict =
                    specialty === "landscape"
                      ? landscapeL3SelectionConflict(trackL3, next)
                      : null;
                  if (conflict) {
                    push({
                      title: "不可同时选择",
                      description: conflict,
                      variant: "destructive",
                    });
                  }
                  setTrackL3(resolved);
                }}
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
                placeholder="请填写悬赏金额"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-ink-40">
                请自行填写确定费用（不少于 ¥1,000），选定设计师后转入平台托管。
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
          <p className="mb-3 text-xs text-ink-40">
            请上传任务书、现状资料等真实文件（可选，单文件不超过 {MAX_ATTACHMENT_LABEL}）。
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {attachments.map((a, i) => (
              <div
                key={`${a.name}-${i}`}
                className="flex items-center justify-between rounded-xl border border-ink-20 bg-ink-20/20 px-3 py-2.5"
              >
                <div className="min-w-0 flex items-center gap-2 text-sm text-ink">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-60" />
                  <span className="truncate">{a.name}</span>
                  {a.size ? (
                    <span className="shrink-0 text-xs text-ink-40">
                      {formatAttachmentSize(a.size)}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments(attachments.filter((_, j) => j !== i))
                  }
                  className="ml-2 shrink-0 text-ink-40 hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={uploadingAttachment}
              onClick={() => attachmentInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink-20 p-2.5 text-sm text-ink-60 hover:border-ink/40 hover:text-ink disabled:opacity-50"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {uploadingAttachment ? "上传中..." : "上传附件"}
            </button>
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.zip,.rar,.jpg,.jpeg,.png,.webp"
              onChange={(e) => handleAttachmentFiles(e.target.files)}
            />
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="mb-1 text-xs uppercase tracking-wider text-ink-40">
            悬赏预算预览
          </div>
          <div className="text-3xl font-bold tracking-tight text-amber-600">
            {rewardAmount >= 1000 ? formatCurrency(rewardAmount) : "待填写"}
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
              请填写项目名称、联系人、电话、描述、悬赏金额（≥¥1,000）、成果提交时间
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
  heading,
  anchor,
  children,
}: {
  label: string;
  required?: boolean;
  heading?: boolean;
  anchor?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={anchor} className="space-y-1.5 scroll-mt-24">
      <Label className={heading ? headingLabelClass : undefined}>
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
  heading,
  anchor,
  children,
}: {
  label: string;
  required?: boolean;
  heading?: boolean;
  anchor?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={anchor} className="space-y-1.5 scroll-mt-24 sm:col-span-2">
      <Label className={heading ? headingLabelClass : undefined}>
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

