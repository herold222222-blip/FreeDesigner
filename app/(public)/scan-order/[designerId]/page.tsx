"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClient, useDesigner } from "@/lib/use-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AdministrativeRegionSelector,
  getDefaultAdministrativeTriple,
  resolveAdministrativeTriple,
  type AdministrativeTriple,
} from "@/components/domain/administrative-region-selector";
import { BountyTrackMultiSelect } from "@/components/domain/bounty-track-multi-select";
import { getL2Options } from "@/lib/bounty-filters";
import {
  getL2Labels,
  reconcileLandscapeL2Selection,
} from "@/lib/bounty-tracks";
import {
  MAX_ATTACHMENT_LABEL,
  findOversizedAttachment,
  oversizedAttachmentMessage,
} from "@/lib/attachment-limits";
import { LandscapeAreaDifficultyCards } from "@/components/domain/landscape-area-difficulty-cards";
import {
  getHardscapeScopeNote,
  landscapeAreaDifficultyUI,
} from "@/lib/landscape-area-difficulty";
import { buildRegularEntrustDescription } from "@/lib/entrust-submit";
import { formatDirectedPlatformFeeLabel, directedPlatformFeeRate, taxPointRateFromOption } from "@/lib/directed-platform-fee";
import { ScanPaymentStagesEditor } from "@/components/domain/scan-payment-stages-editor";
import { defaultBountyPaymentStageDrafts } from "@/lib/bounty-payment-stages";
import {
  dailyTimePaymentStageDrafts,
  monthlyRangePaymentStageDrafts,
  paymentStagesValid,
  type ScanPaymentStageDraft,
} from "@/lib/scan-order";
import {
  formatDailyBillingRule,
  formatMonthlyBillingRuleFull,
} from "@/lib/platform-commerce";
import {
  buildMonthlyRangeQuote,
  formatIsoDateLabel,
  formatMonthlyRangeSummary,
} from "@/lib/monthly-range-billing";
import { calculateAreaBasedFee } from "@/lib/fee-calculator";
import {
  designerAppliedTimeRates,
  designerLandscapeAreaTrackFactor,
} from "@/lib/designer-rate-settings";
import {
  inferDesignerLandscapeTimeTrack,
  type LandscapeTimeRateTrack,
} from "@/lib/designer-rates";
import { getProjectTypes, resolveDesignerRegionTier } from "@/lib/constants";
import type {
  BountyAttachment,
  HalfDaySlot,
  ServiceMode,
  Specialty,
} from "@/lib/types";
import { DesignerSchedulePicker } from "@/components/domain/designer-schedule-picker";
import { DesignerDateRangeCalendar } from "@/components/domain/designer-date-range-calendar";
import {
  formatMonthLabel,
  formatSelectedSlotsSummary,
  halfDaysToWorkDays,
  slotsToDateRange,
} from "@/lib/designer-schedule";
import { buildDesignerBookingCalendar } from "@/lib/designer-work-calendar";
import {
  ArrowLeft,
  CircleDollarSign,
  Clock,
  FileSignature,
  Paperclip,
  QrCode,
  Ruler,
  Wallet,
  X,
} from "lucide-react";
import { createDesignerSelfOrderRequest, createOrderRequest } from "@/lib/api-client";
import { cn, formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import { DesignerName } from "@/components/domain/designer-name";
import { maskDesignerPublicName } from "@/lib/designer-contact-privacy";
import { DesignerLevelBadge } from "@/components/domain/level-badges";
import { GuestAccessGate } from "@/components/domain/guest-access-gate";
import type { DesignerLevel } from "@/lib/types";

const TRACK_OPTIONS = [
  { value: "hardscape", label: "园建（Hardscape）" },
  { value: "softscape", label: "绿化（Softscape）" },
  { value: "drainage", label: "给排水（Drainage）" },
  { value: "electrical", label: "电气（Electrical）" },
] as const;

type TrackKey = (typeof TRACK_OPTIONS)[number]["value"];
type ScanBillingTab = "platform_area" | "designer_time" | "direct_amount";
type ScanTimeUnit = "daily" | "monthly";

function scanFieldClass(highlight: boolean) {
  return cn(
    "scroll-mt-24 rounded-xl transition-shadow",
    highlight && "bg-rose-50/80 p-2 ring-2 ring-rose-400 ring-offset-2",
  );
}

export default function ScanOrderPage({
  params,
}: {
  params: { designerId: string };
}) {
  return (
    <GuestAccessGate intent="browse">
      <ScanOrderForm designerId={params.designerId} />
    </GuestAccessGate>
  );
}

function ScanOrderForm({ designerId }: { designerId: string }) {
  const router = useRouter();
  const { data: designer, loading } = useDesigner(designerId);
  const role = useRoleStore((s) => s.role);
  const identityId = useRoleStore((s) => s.identityId);
  const { data: client } = useClient(role === "client" ? identityId : null);
  const push = useSessionStore((s) => s.pushNotification);
  const pricingConfig = usePlatformPricingStore((s) => s.config);
  const landscapeDifficulty = pricingConfig.landscapeDifficulty;

  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState("");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("online");
  const [onsiteAddress, setOnsiteAddress] = useState("");
  const [onsiteAdminTriple, setOnsiteAdminTriple] = useState<AdministrativeTriple>(
    getDefaultAdministrativeTriple(),
  );
  const [area, setArea] = useState<number | "">("");
  const [selectedL2, setSelectedL2] = useState<string[]>([]);
  const [tracks, setTracks] = useState<TrackKey[]>([]);
  const [areaDifficulty, setAreaDifficulty] = useState<
    Partial<Record<TrackKey, number>>
  >({});
  const [buildType, setBuildType] = useState<"new" | "renovation" | null>(null);
  const [billingTab, setBillingTab] = useState<ScanBillingTab>("platform_area");
  const [directAmount, setDirectAmount] = useState<number | "">("");
  const [timeUnit, setTimeUnit] = useState<ScanTimeUnit>("daily");
  const [selectedSlots, setSelectedSlots] = useState<HalfDaySlot[]>([]);
  const [monthlyFrom, setMonthlyFrom] = useState("");
  const [monthlyTo, setMonthlyTo] = useState("");
  const [timeTrack, setTimeTrack] = useState<LandscapeTimeRateTrack | null>(null);
  const [paymentStages, setPaymentStages] = useState<ScanPaymentStageDraft[]>(
    defaultBountyPaymentStageDrafts,
  );
  const [tax, setTax] = useState<{
    value: string;
    label: string;
    coefficient: number;
  } | null>(null);
  const [description, setDescription] = useState("");
  const [highlightField, setHighlightField] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<BountyAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [committerName, setCommitterName] = useState("");
  const [projectAdminTriple, setProjectAdminTriple] = useState<AdministrativeTriple>(
    getDefaultAdministrativeTriple(),
  );

  const specialty: Specialty = designer?.specialty ?? "landscape";
  const level: DesignerLevel = designer?.level ?? "mid_v1";
  const projectTypes =
    specialty === "landscape"
      ? Object.keys(pricingConfig.landscapeProjectTypeCoefficient)
      : getProjectTypes(specialty);

  const projectSiteResolution = useMemo(
    () => resolveAdministrativeTriple(projectAdminTriple),
    [projectAdminTriple],
  );
  const projectCity = projectSiteResolution?.fullLabel ?? "";
  const onsiteSiteResolution = useMemo(
    () => resolveAdministrativeTriple(onsiteAdminTriple),
    [onsiteAdminTriple],
  );
  const composedOnsiteAddress = [
    onsiteSiteResolution?.fullLabel,
    onsiteAddress.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (!client) return;
    setCommitterName(client.companyName || client.name || "");
    setContactName(client.contactName || client.name || "");
    setContactPhone(client.phone || "");
  }, [client]);

  const applyTimePaymentStages = (unit: ScanTimeUnit) => {
    setPaymentStages(
      unit === "monthly"
        ? monthlyRangePaymentStageDrafts(null, pricingConfig.commerce)
        : dailyTimePaymentStageDrafts(pricingConfig.commerce),
    );
  };

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
        }
      }
      return changed ? next : prev;
    });
  }, [tracks, landscapeDifficulty]);

  const l2Options = useMemo(() => getL2Options(specialty), [specialty]);

  const areaDifficultyComplete =
    tracks.length > 0 &&
    tracks.every((tk) => {
      const ui = landscapeAreaDifficultyUI(tk, landscapeDifficulty);
      if (ui.kind === "fixed") return true;
      return areaDifficulty[tk] != null;
    });

  const areaBillingComplete =
    typeof area === "number" &&
    area > 0 &&
    selectedL2.length > 0 &&
    tracks.length > 0 &&
    areaDifficultyComplete &&
    !!buildType &&
    !!tax;

  const directBillingComplete =
    typeof directAmount === "number" && directAmount > 0 && !!tax;

  const isSelfOrder = role === "designer" && identityId === designerId;

  const trackLabels = tracks.map(
    (t) => TRACK_OPTIONS.find((o) => o.value === t)?.label ?? t,
  );

  const directedFeeLabel = formatDirectedPlatformFeeLabel(
    taxPointRateFromOption(tax),
  );

  const designerAreaFee = useMemo(() => {
    if (billingTab !== "platform_area" || !designer) return null;
    if (
      typeof area !== "number" ||
      area <= 0 ||
      tracks.length === 0 ||
      !buildType ||
      !areaDifficultyComplete
    ) {
      return null;
    }
    const breakdown = calculateAreaBasedFee(
      {
        area,
        projectType,
        designerLevel: designer.level ?? "mid_v1",
        designerRegion: resolveDesignerRegionTier(designer),
        clientLevel: client?.level ?? "",
        selectedTracks: tracks,
        difficulty: areaDifficulty as Record<string, number>,
        buildType,
        taxCoefficient: 1,
      },
      pricingConfig,
    );
    const percents = designer.ratePercents ?? {};
    let drawingFee = 0;
    const byTrack: Record<string, number> = {};
    for (const track of tracks) {
      const factor = designerLandscapeAreaTrackFactor(
        track,
        selectedL2,
        percents,
      );
      const amount = Math.round((breakdown.byTrack[track] ?? 0) * factor);
      byTrack[track] = amount;
      drawingFee += amount;
    }
    const feeRate = directedPlatformFeeRate(taxPointRateFromOption(tax));
    const total = Math.round(drawingFee * (1 + feeRate));
    return { drawingFee, byTrack, total, feeRate };
  }, [
    billingTab,
    designer,
    area,
    tracks,
    buildType,
    areaDifficultyComplete,
    projectType,
    client?.level,
    areaDifficulty,
    pricingConfig,
    selectedL2,
    tax,
  ]);

  const resolvedTimeTrack: LandscapeTimeRateTrack =
    timeTrack ??
    (designer ? inferDesignerLandscapeTimeTrack(designer) : "hardscape");

  const bookingCalendar = useMemo(
    () =>
      designer
        ? buildDesignerBookingCalendar(designer)
        : { base: [], booking: [], events: [] },
    [designer],
  );
  const calendarToday = useMemo(() => new Date(), []);
  const timeQty = halfDaysToWorkDays(selectedSlots);

  const monthlyRangeQuote = useMemo(() => {
    if (billingTab !== "designer_time" || timeUnit !== "monthly" || !designer) {
      return null;
    }
    if (!monthlyFrom || !monthlyTo) return null;
    const rates = designerAppliedTimeRates(
      designer,
      resolvedTimeTrack,
      designer.ratePercents,
      pricingConfig,
    );
    const monthlyRate =
      serviceMode === "onsite" ? rates.onsiteMonthly : rates.remoteMonthly;
    return buildMonthlyRangeQuote(monthlyFrom, monthlyTo, monthlyRate);
  }, [
    billingTab,
    timeUnit,
    designer,
    monthlyFrom,
    monthlyTo,
    resolvedTimeTrack,
    pricingConfig,
    serviceMode,
  ]);

  const selectedMonths = monthlyRangeQuote?.segments.map((seg) => seg.monthKey) ?? [];

  const designerTimeFee = useMemo(() => {
    if (billingTab !== "designer_time" || !designer) return null;
    const rates = designerAppliedTimeRates(
      designer,
      resolvedTimeTrack,
      designer.ratePercents,
      pricingConfig,
    );
    const unit =
      serviceMode === "onsite"
        ? timeUnit === "monthly"
          ? rates.onsiteMonthly
          : rates.onsiteDaily
        : timeUnit === "monthly"
          ? rates.remoteMonthly
          : rates.remoteDaily;
    const drawingFee =
      timeUnit === "monthly"
        ? monthlyRangeQuote?.drawingFee ?? 0
        : Math.round(unit * timeQty);
    if (drawingFee <= 0) return null;
    const feeRate = directedPlatformFeeRate(taxPointRateFromOption(tax));
    const total = Math.round(drawingFee * (1 + feeRate));
    return {
      unit,
      drawingFee,
      total,
      feeRate,
      trackLabel: rates.trackLabel,
      quote: monthlyRangeQuote,
    };
  }, [
    billingTab,
    designer,
    timeQty,
    resolvedTimeTrack,
    pricingConfig,
    serviceMode,
    timeUnit,
    tax,
    monthlyRangeQuote,
  ]);

  const timeBillingComplete = !!designerTimeFee && !!tax && !!resolvedTimeTrack;

  useEffect(() => {
    if (billingTab !== "designer_time" || timeUnit !== "monthly") return;
    setPaymentStages(
      monthlyRangePaymentStageDrafts(monthlyRangeQuote, pricingConfig.commerce),
    );
  }, [billingTab, timeUnit, monthlyRangeQuote, pricingConfig.commerce]);

  const previewTotalAmount =
    billingTab === "direct_amount" && typeof directAmount === "number"
      ? directAmount
      : billingTab === "designer_time"
        ? designerTimeFee?.total
        : designerAreaFee?.total;

  const firstIncompleteFieldId = (): string | null => {
    if (!isSelfOrder) {
      if (!committerName.trim()) return "field-committer";
      if (!contactName.trim()) return "field-contact-name";
      if (!contactPhone.trim()) return "field-contact-phone";
    }
    if (title.trim().length <= 1) return "field-title";
    if (!projectSiteResolution) return "field-project-site";
    if (!projectType.trim()) return "field-project-type";
    if (serviceMode === "onsite") {
      if (!onsiteSiteResolution) return "field-onsite-region";
      if (onsiteAddress.trim().length <= 2) return "field-onsite-detail";
    }
    if (billingTab === "platform_area") {
      if (!(typeof area === "number" && area > 0)) return "field-area";
      if (selectedL2.length === 0) return "field-l2";
      if (tracks.length === 0 || !areaDifficultyComplete) return "field-tracks";
      if (!buildType) return "field-build-type";
      if (!tax) return "field-tax";
    } else if (billingTab === "designer_time") {
      if (!designerTimeFee) return "field-schedule";
      if (!tax) return "field-tax";
    } else {
      if (!(typeof directAmount === "number" && directAmount > 0)) {
        return "field-direct-amount";
      }
      if (!tax) return "field-tax";
    }
    if (!paymentStagesValid(paymentStages)) return "field-payment-stages";
    if (description.trim().length <= 4) return "field-description";
    if (isSelfOrder && !(previewTotalAmount && previewTotalAmount > 0)) {
      return billingTab === "designer_time"
        ? "field-schedule"
        : billingTab === "direct_amount"
          ? "field-direct-amount"
          : "field-area";
    }
    return null;
  };

  const canSubmit = !firstIncompleteFieldId();
  const shownHighlight =
    highlightField && highlightField === firstIncompleteFieldId()
      ? highlightField
      : null;

  const scrollToScanField = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const focusable = el.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), textarea, select, button:not([disabled])",
    );
    focusable?.focus({ preventScroll: true });
  };

  const toggleTrack = (t: TrackKey) =>
    setTracks((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );

  const handleL2Change = (next: string[]) => {
    const resolved =
      specialty === "landscape"
        ? reconcileLandscapeL2Selection(selectedL2, next)
        : next;
    setSelectedL2(resolved);
  };

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
              resolve({ name: file.name, url: reader.result, size: file.size });
            };
            reader.onerror = () => reject(new Error("读取失败"));
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((items) => setAttachments((prev) => [...prev, ...items]))
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

  const handleSubmit = async () => {
    if (submitting || !designer) return;
    const incomplete = firstIncompleteFieldId();
    if (incomplete) {
      setHighlightField(incomplete);
      scrollToScanField(incomplete);
      push({
        title: "请完善必填项",
        description: "已跳转到未填写的内容，补全后即可提交。",
        variant: "destructive",
      });
      return;
    }
    if (!isSelfOrder && (role === "guest" || !identityId)) {
      push({
        title: "请先登录",
        description: "扫码下单需使用委托人账号登录。",
        variant: "destructive",
      });
      router.push(`/login?redirect=/scan-order/${designer.id}`);
      return;
    }
    if (isSelfOrder && (role !== "designer" || identityId !== designer.id)) {
      push({
        title: "请先登录设计师账号",
        description: "自己下单需使用本设计师账号。",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const serviceModeLabel = serviceMode === "online" ? "线上远程" : "线下服务";
      const closingLine = isSelfOrder
        ? "设计师已填写订单，等待委托人确认后双方签约。"
        : "扫码下单已提交，等待设计师确认费用与付款阶段。";
      const contactBlock = [
        description.trim(),
        "",
        "--- 委托联系信息 ---",
        committerName ? `委托方：${committerName}` : null,
        contactName ? `联系人：${contactName}` : null,
        contactPhone ? `电话：${contactPhone}` : null,
        projectCity ? `项目城市：${projectCity}` : null,
        serviceMode === "onsite" && composedOnsiteAddress
          ? `驻场地址：${composedOnsiteAddress}`
          : null,
      ];
      const fullDescription =
        billingTab === "platform_area"
          ? buildRegularEntrustDescription({
              description,
              contactName,
              contactPhone,
              projectCity,
              committerName,
              billingMode: "area",
              area: typeof area === "number" ? area : undefined,
              tracks: trackLabels,
              timeL2Labels: getL2Labels(specialty, selectedL2),
              buildType,
              serviceModeLabel,
              taxLabel: tax?.label,
              closingLine: designerAreaFee
                ? `按设计师标准取费预估 ${formatCurrency(designerAreaFee.total)}（设计费 ${formatCurrency(designerAreaFee.drawingFee)}，含平台服务费 ${directedFeeLabel}）。${closingLine}`
                : closingLine,
            })
          : billingTab === "designer_time"
            ? [
                ...contactBlock,
                "",
                "--- 计费摘要 ---",
                "计费方式：按工时计费（设计师标准）",
                `专业档位：${designerTimeFee?.trackLabel ?? resolvedTimeTrack}`,
                `计费单位：${timeUnit === "monthly" ? "按月" : "按工日"}`,
                timeUnit === "monthly"
                  ? monthlyRangeQuote
                    ? `服务期：${formatMonthlyRangeSummary(monthlyRangeQuote)}`
                    : "服务期：未选"
                  : `已选日期：${
                      selectedSlots.length
                        ? formatSelectedSlotsSummary(selectedSlots)
                        : "未选"
                    }`,
                timeUnit === "monthly"
                  ? monthlyRangeQuote
                    ? `折算明细：${monthlyRangeQuote.segments
                        .map((seg) =>
                          seg.isFull
                            ? `${formatMonthLabel(seg.monthKey)}整月 ${formatCurrency(seg.amount)}`
                            : `${formatMonthLabel(seg.monthKey)} ${seg.workdays} 工作日 ${formatCurrency(seg.amount)}`,
                        )
                        .join("；")}`
                    : null
                  : `数量：${timeQty} 工日`,
                designerTimeFee
                  ? `单价：${formatCurrency(designerTimeFee.unit)} / ${timeUnit === "monthly" ? "月" : "工日"}`
                  : null,
                designerTimeFee
                  ? `按设计师标准取费预估 ${formatCurrency(designerTimeFee.total)}（设计费 ${formatCurrency(designerTimeFee.drawingFee)}，含平台服务费 ${directedFeeLabel}）`
                  : null,
                `服务方式：${serviceModeLabel}`,
                "",
                closingLine,
              ]
                .filter(Boolean)
                .join("\n")
            : [
                ...contactBlock,
                "",
                "--- 计费摘要 ---",
                "计费方式：直接输入费用金额",
                `委托人填写费用：${formatCurrency(
                  typeof directAmount === "number" ? directAmount : 0,
                )}`,
                `服务方式：${serviceModeLabel}`,
                `平台服务费：${directedFeeLabel}`,
                "",
                closingLine,
              ]
                .filter(Boolean)
                .join("\n");
      const payload = {
        designerId: designer.id,
        title: title.trim(),
        specialty,
        projectType,
        serviceMode,
        billingMode:
          billingTab === "designer_time" ? timeUnit : ("area" as const),
        orderSource: "scan" as const,
        totalAmount: isSelfOrder ? (previewTotalAmount ?? 0) : 0,
        description: fullDescription,
        projectAreaSqm:
          billingTab === "platform_area" && typeof area === "number"
            ? area
            : undefined,
        expectedDeliveryAt:
          billingTab === "designer_time" && timeUnit === "daily"
            ? slotsToDateRange(selectedSlots)?.to
            : billingTab === "designer_time" && timeUnit === "monthly"
              ? monthlyFrom || undefined
              : undefined,
        attachments: attachments.length ? attachments : undefined,
        selectedSlots:
          billingTab === "designer_time" && timeUnit === "daily"
            ? selectedSlots
            : [],
        selectedMonths:
          billingTab === "designer_time" && timeUnit === "monthly"
            ? selectedMonths
            : undefined,
        scheduleFrom:
          billingTab === "designer_time" && timeUnit === "daily"
            ? slotsToDateRange(selectedSlots)?.from
            : billingTab === "designer_time" && timeUnit === "monthly"
              ? monthlyFrom || undefined
              : undefined,
        scheduleTo:
          billingTab === "designer_time" && timeUnit === "daily"
            ? slotsToDateRange(selectedSlots)?.to
            : billingTab === "designer_time" && timeUnit === "monthly"
              ? monthlyTo || undefined
              : undefined,
        address: serviceMode === "onsite" ? composedOnsiteAddress : undefined,
        taxCoefficient: tax?.coefficient ?? 1,
        customStageRatios: paymentStages.map((s) => ({
          name: s.name.trim(),
          ratio: s.ratio,
          note: s.note?.trim() || undefined,
        })),
      };
      if (isSelfOrder) {
        const created = await createDesignerSelfOrderRequest(payload);
        push({
          title: "订单已生成",
          description: `请把确认链接发给委托人。订单号 ${created.code}。`,
          variant: "success",
        });
        router.push(`/designer/orders/${created.id}?selfShare=1`);
        return;
      }
      const order = await createOrderRequest(payload);
      push({
        title: "需求已提交",
        description: `已发送给 ${maskDesignerPublicName(designer.name)}，请等待对方确认费用与付款阶段。订单号 ${order.code}。`,
        variant: "success",
      });
      router.push(`/client/orders/${order.id}`);
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

  if (loading || !designer) {
    return (
      <div className="container-page py-20 text-center text-ink-60">
        正在加载设计师信息...
      </div>
    );
  }

  if (specialty !== "landscape") {
    return (
      <div className="container-page py-20">
        <Card className="mx-auto max-w-lg space-y-4 p-8 text-center">
          <h1 className="text-xl font-semibold text-ink">暂不支持该专业扫码下单</h1>
          <p className="text-sm text-ink-60">
            当前扫码下单仅开放景观设计按面积委托。您可返回设计师主页使用其他方式联系。
          </p>
          <Button asChild variant="brand">
            <Link href={`/designers/${designer.id}`}>返回设计师主页</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-page py-6 sm:py-10">
      <div className="mb-4 flex min-w-0 items-center gap-2 text-sm text-ink-60">
        <QrCode className="h-4 w-4 text-brand" />
        <span>
          {isSelfOrder
            ? "自己下单 · 填写后发给委托人确认"
            : "扫码下单 · 填写项目需求"}
        </span>
      </div>

      <Link
        href={`/designers/${designer.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 查看设计师主页
      </Link>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_300px] lg:gap-8">
        <div className="min-w-0 space-y-6">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage
                  src={designer.avatar}
                  alt={maskDesignerPublicName(designer.name)}
                />
                <AvatarFallback>
                  {maskDesignerPublicName(designer.name).slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-lg font-semibold text-ink sm:text-xl">
                  <DesignerName designer={designer} />
                </h1>
                <div className="mt-1 flex flex-wrap gap-2">
                  <DesignerLevelBadge level={level} />
                  <Badge variant="muted">{designer.tagline}</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4 sm:space-y-5 sm:p-6">
            <h2 className="text-base font-semibold text-ink sm:text-lg">1 · 填写委托方</h2>
            <p className="text-xs text-ink-60">
              {isSelfOrder
                ? "委托人确认链接后会绑定其账号；此处可先留空或填写已知联系人。"
                : "已登录委托人账号时将自动填充；联系人可与委托方名称相同或另行填写。"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                id="field-committer"
                className={cn(
                  "sm:col-span-2",
                  scanFieldClass(shownHighlight === "field-committer"),
                )}
              >
                <Label>
                  委托方名称 <span className="text-rose-500">*</span>
                </Label>
                <Input
                  className="mt-2"
                  placeholder="企业或个人名称，如已入驻则自动填充"
                  value={committerName}
                  onChange={(e) => setCommitterName(e.target.value)}
                />
              </div>
              <div
                id="field-contact-name"
                className={scanFieldClass(shownHighlight === "field-contact-name")}
              >
                <Label>联系人 *</Label>
                <Input
                  className="mt-2"
                  placeholder="可与委托方一致或另行输入"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div
                id="field-contact-phone"
                className={scanFieldClass(shownHighlight === "field-contact-phone")}
              >
                <Label>联系电话 *</Label>
                <Input
                  className="mt-2"
                  placeholder="手机号"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4 sm:space-y-5 sm:p-6">
            <h2 className="text-base font-semibold text-ink sm:text-lg">2 · 项目信息</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                id="field-title"
                className={cn("sm:col-span-2", scanFieldClass(shownHighlight === "field-title"))}
              >
                <Label>项目名称 *</Label>
                <Input
                  className="mt-2"
                  placeholder="如：徐汇复式住宅景观施工图"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div
                id="field-project-site"
                className={cn(
                  "sm:col-span-2",
                  scanFieldClass(shownHighlight === "field-project-site"),
                )}
              >
                <Label>项目所在地 *</Label>
                <div className="relative z-[5] mt-2">
                  <AdministrativeRegionSelector
                    triple={projectAdminTriple}
                    onTripleChange={setProjectAdminTriple}
                  />
                </div>
              </div>
              <div
                id="field-project-type"
                className={scanFieldClass(shownHighlight === "field-project-type")}
              >
                <Label>项目类型 *</Label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-base sm:text-sm"
                >
                  <option value="" disabled>
                    请选择
                  </option>
                  {projectTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>服务方式</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { v: "online" as const, l: "线上远程" },
                    { v: "onsite" as const, l: "线下服务" },
                  ].map((m) => (
                    <button
                      key={m.v}
                      type="button"
                      onClick={() => {
                        if (m.v === "onsite" && serviceMode !== "onsite") {
                          setOnsiteAdminTriple(projectAdminTriple);
                        }
                        setServiceMode(m.v);
                      }}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm transition-colors",
                        serviceMode === m.v
                          ? "border-brand bg-brand/5 text-brand"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {m.l}
                    </button>
                  ))}
                </div>
                {serviceMode === "onsite" ? (
                  <div className="mt-3 space-y-3">
                    <Label>
                      驻场地址 <span className="text-rose-500">*</span>
                    </Label>
                    <div
                      id="field-onsite-region"
                      className={scanFieldClass(
                        shownHighlight === "field-onsite-region",
                      )}
                    >
                      <AdministrativeRegionSelector
                        triple={onsiteAdminTriple}
                        onTripleChange={setOnsiteAdminTriple}
                        showRateCoefficient={false}
                        footerNote="先选省 / 市 / 区县，再填写路名与门牌号。"
                      />
                    </div>
                    <div
                      id="field-onsite-detail"
                      className={scanFieldClass(
                        shownHighlight === "field-onsite-detail",
                      )}
                    >
                      <Label>
                        具体地址 / 门牌号{" "}
                        <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        className="mt-2"
                        autoComplete="off"
                        placeholder="请填写路名、门牌号、楼层等"
                        value={onsiteAddress}
                        onChange={(e) => setOnsiteAddress(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4 sm:space-y-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink sm:text-lg">3 · 费用计算</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                {
                  v: "platform_area" as const,
                  l: "按面积计费（设计师标准）",
                  icon: Ruler,
                },
                {
                  v: "designer_time" as const,
                  l: "按工时计费（设计师标准）",
                  icon: Clock,
                },
                {
                  v: "direct_amount" as const,
                  l: "直接输入费用金额",
                  icon: Wallet,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.v}
                    type="button"
                    onClick={() => {
                      setBillingTab(tab.v);
                      if (tab.v === "designer_time") {
                        applyTimePaymentStages(timeUnit);
                      } else {
                        setPaymentStages(defaultBountyPaymentStageDrafts());
                      }
                    }}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-colors sm:gap-2 sm:px-4 sm:text-sm",
                      billingTab === tab.v
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-ink-20 text-ink-60 hover:border-ink/40",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.l}
                  </button>
                );
              })}
            </div>

            {billingTab === "platform_area" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                id="field-area"
                className={scanFieldClass(shownHighlight === "field-area")}
              >
                <Label>景观面积（㎡）*</Label>
                <Input
                  type="number"
                  className="mt-2"
                  placeholder="请填写景观面积"
                  value={area}
                  onChange={(e) =>
                    setArea(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>
              <div
                id="field-l2"
                className={cn(
                  "sm:col-span-2",
                  scanFieldClass(shownHighlight === "field-l2"),
                )}
              >
                <Label>二级专业（可多选）*</Label>
                <div className="mt-2">
                  <BountyTrackMultiSelect
                    options={l2Options.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    value={selectedL2}
                    onChange={handleL2Change}
                  />
                </div>
              </div>
              <div
                id="field-tracks"
                className={cn(
                  "sm:col-span-2",
                  scanFieldClass(shownHighlight === "field-tracks"),
                )}
              >
                <Label>三级专业与难度系数 *</Label>
                <div className="mt-3 space-y-3">
                  {TRACK_OPTIONS.map((spec) => {
                    const tk = spec.value;
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
                          <LandscapeAreaDifficultyCards
                            options={ui.options}
                            selectedValue={areaDifficulty[tk]}
                            onSelect={(opt) =>
                              setAreaDifficulty((prev) => ({
                                ...prev,
                                [tk]: opt.value,
                              }))
                            }
                            heading={
                              tk === "drainage"
                                ? "选项说明 · 给排水"
                                : `难度说明 · ${spec.label.split("（")[0]?.trim()}`
                            }
                            missingHint={
                              areaDifficulty[tk] == null
                                ? "请选择难度系数"
                                : undefined
                            }
                          />
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
              </div>
              <div
                id="field-build-type"
                className={scanFieldClass(shownHighlight === "field-build-type")}
              >
                <Label>建造类型 *</Label>
                <div className="mt-2 flex gap-2">
                  {[
                    { v: "new" as const, l: "新建（100%）" },
                    { v: "renovation" as const, l: "改扩建（110%）" },
                  ].map((b) => (
                    <button
                      key={b.v}
                      type="button"
                      onClick={() => setBuildType(b.v)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs",
                        buildType === b.v
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60",
                      )}
                    >
                      {b.l}
                    </button>
                  ))}
                </div>
              </div>
              <div
                id="field-tax"
                className={scanFieldClass(shownHighlight === "field-tax")}
              >
                <Label>税率 *</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pricingConfig.taxOptions.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTax(t)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs",
                        tax?.value === t.value
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            ) : billingTab === "designer_time" ? (
              <div className="space-y-4">
                <div>
                  <Label>计费专业档位 *</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TRACK_OPTIONS.map((spec) => (
                      <button
                        key={spec.value}
                        type="button"
                        onClick={() =>
                          setTimeTrack(spec.value as LandscapeTimeRateTrack)
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs",
                          resolvedTimeTrack === spec.value
                            ? "border-ink bg-ink text-white"
                            : "border-ink-20 text-ink-60",
                        )}
                      >
                        {spec.label.split("（")[0]?.trim()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>计费单位 *</Label>
                  <div className="mt-2 flex gap-2">
                    {[
                      { v: "daily" as const, l: "按工日" },
                      { v: "monthly" as const, l: "按月" },
                    ].map((u) => (
                      <button
                        key={u.v}
                        type="button"
                        onClick={() => {
                          setTimeUnit(u.v);
                          if (u.v === "daily") {
                            setMonthlyFrom("");
                            setMonthlyTo("");
                          } else {
                            setSelectedSlots([]);
                          }
                          applyTimePaymentStages(u.v);
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs",
                          timeUnit === u.v
                            ? "border-ink bg-ink text-white"
                            : "border-ink-20 text-ink-60",
                        )}
                      >
                        {u.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  id="field-schedule"
                  className={scanFieldClass(shownHighlight === "field-schedule")}
                >
                  <Label>
                      : "选择服务日期（设计师工作日历）"}{" "}
                    <span className="text-rose-500">*</span>
                  </Label>
                  <p className="mt-1 text-xs text-ink-60">
                    {timeUnit === "monthly"
                      ? "日历标出该设计师忙闲。先点开始日期，再点结束日期。首尾不足整月按工作日折算（日费 = 月费 ÷ 21），中间整月按月费率。"
                      : "日历标出该设计师目前忙闲时段。可单选或多选空闲日期，数量按已选工日计算。"}
                  </p>
                  <div className="mt-3">
                    {timeUnit === "daily" ? (
                      <DesignerSchedulePicker
                        calendar={bookingCalendar.booking}
                        events={bookingCalendar.events}
                        value={selectedSlots}
                        onChange={setSelectedSlots}
                        initialYear={calendarToday.getFullYear()}
                        initialMonth={calendarToday.getMonth() + 1}
                      />
                    ) : (
                      <DesignerDateRangeCalendar
                        calendar={bookingCalendar.booking}
                        events={bookingCalendar.events}
                        value={{ from: monthlyFrom, to: monthlyTo }}
                        onChange={(next) => {
                          setMonthlyFrom(next.from);
                          setMonthlyTo(next.to);
                        }}
                        initialYear={calendarToday.getFullYear()}
                        initialMonth={calendarToday.getMonth() + 1}
                      />
                    )}
                  </div>
                </div>
                <div
                  id="field-tax"
                  className={scanFieldClass(shownHighlight === "field-tax")}
                >
                  <Label>税率 *</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pricingConfig.taxOptions.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTax(t)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs",
                          tax?.value === t.value
                            ? "border-ink bg-ink text-white"
                            : "border-ink-20 text-ink-60",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-ink-60">
                  单价取该设计师已设定的
                  {serviceMode === "onsite" ? "驻场" : "线上"}
                  {timeUnit === "monthly" ? "月" : "工日"}
                  费率，再计平台服务费 {directedFeeLabel}。
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  id="field-direct-amount"
                  className={cn(
                    "max-w-xs",
                    scanFieldClass(shownHighlight === "field-direct-amount"),
                  )}
                >
                  <Label>
                    费用金额（元） <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1000}
                    step={100}
                    className="mt-2"
                    placeholder="如 28000"
                    value={directAmount}
                    onChange={(e) =>
                      setDirectAmount(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </div>
                <div
                  id="field-tax"
                  className={scanFieldClass(shownHighlight === "field-tax")}
                >
                  <Label>税率 *</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pricingConfig.taxOptions.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTax(t)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs",
                          tax?.value === t.value
                            ? "border-ink bg-ink text-white"
                            : "border-ink-20 text-ink-60",
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-ink-60">
                  填写您期望的项目费用即可，无需填写面积与专业难度。提交后设计师可确认或调整。
                  定向下单平台仅收取 {directedFeeLabel}。
                </p>
              </div>
            )}

            {billingTab === "platform_area" || billingTab === "designer_time" ? (
              <div className="rounded-xl border border-ink-20 bg-ink-20/20 px-4 py-3">
                <div className="text-xs text-ink-60">按该设计师费率预估</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-ink">
                  {billingTab === "designer_time"
                    ? designerTimeFee
                      ? formatCurrency(designerTimeFee.total)
                      : timeUnit === "monthly"
                        ? "请在日历中选择开始日期与结束日期"
                        : "请在日历中选择服务日期"
                    : designerAreaFee
                      ? formatCurrency(designerAreaFee.total)
                      : "待补全面积与专业"}
                </div>
                {billingTab === "designer_time" ? (
                  designerTimeFee ? (
                    <div className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-ink-50">
                      <p>
                        {designerTimeFee.trackLabel} ·{" "}
                        {formatCurrency(designerTimeFee.unit)} /{" "}
                        {timeUnit === "monthly" ? "月" : "工日"}
                        {timeUnit === "monthly" && monthlyRangeQuote
                          ? ` · 日费 ${formatCurrency(monthlyRangeQuote.dailyRate)}`
                          : ` × ${timeQty}`}{" "}
                        · 设计费 {formatCurrency(designerTimeFee.drawingFee)} ·
                        含平台服务费 {directedFeeLabel}。
                      </p>
                      {timeUnit === "monthly" && monthlyRangeQuote ? (
                        <ul className="space-y-0.5 text-ink-50">
                          {monthlyRangeQuote.segments.map((seg) => (
                            <li key={seg.monthKey}>
                              {seg.isFull
                                ? `${formatMonthLabel(seg.monthKey)}整月`
                                : `${formatMonthLabel(seg.monthKey)} ${formatIsoDateLabel(seg.from)}～${formatIsoDateLabel(seg.to)} · ${seg.workdays} 工作日`}{" "}
                              {formatCurrency(seg.amount)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink-50">
                      按该设计师已设定的
                      {serviceMode === "onsite" ? "驻场" : "线上"}
                      工时费率估算。
                    </p>
                  )
                ) : designerAreaFee ? (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-50">
                    设计费 {formatCurrency(designerAreaFee.drawingFee)} · 含平台服务费{" "}
                    {directedFeeLabel}。提交后设计师仍可确认或调整。
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-50">
                    按该设计师已设定的取费标准（等级、地区及本人费率）估算，不含平台通用价目。
                  </p>
                )}
              </div>
            ) : null}
          </Card>

          <Card
            id="field-payment-stages"
            className={cn(
              "space-y-4 p-4 sm:p-6",
              scanFieldClass(shownHighlight === "field-payment-stages"),
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <CircleDollarSign className="h-5 w-5 shrink-0 text-brand" />
              <h2 className="text-base font-semibold text-ink sm:text-lg">付款阶段</h2>
            </div>
            <p className="text-xs leading-relaxed text-ink-60">
              {billingTab === "designer_time" && timeUnit === "daily"
                ? "与常规委托按日一致：签约预付后开工，服务结束后付清尾款。比例合计须为 100%，每阶段备注必填。"
                : billingTab === "designer_time" && timeUnit === "monthly"
                  ? "与常规委托按月一致：按服务期内各月一期。首尾不足整月按工作日折算金额占比，中间整月按月费率。比例合计须为 100%。"
                  : "默认一个阶段（全款）。可增减阶段、调整比例与付款条件，比例合计须为 100%，每阶段备注必填。提交后设计师可再确认或调整。"}
            </p>
            <ScanPaymentStagesEditor
              stages={paymentStages}
              onChange={setPaymentStages}
              totalAmount={previewTotalAmount ?? 0}
              variant={
                billingTab === "designer_time"
                  ? timeUnit === "monthly"
                    ? "monthly"
                    : "daily"
                  : "custom"
              }
              ruleHint={
                billingTab === "designer_time"
                  ? timeUnit === "monthly"
                    ? formatMonthlyBillingRuleFull(pricingConfig.commerce)
                    : formatDailyBillingRule(pricingConfig.commerce)
                  : undefined
              }
              allowAddRemove={
                billingTab !== "designer_time" || timeUnit !== "monthly"
              }
            />
          </Card>

          <Card className="space-y-4 p-4 sm:p-6">
            <h2 className="text-base font-semibold text-ink sm:text-lg">4 · 项目描述与附件</h2>
            <div
              id="field-description"
              className={scanFieldClass(shownHighlight === "field-description")}
            >
              <Label>需求描述 *</Label>
              <Textarea
                className="mt-2 min-h-[120px]"
                placeholder="说明项目背景、交付深度、参考节点等"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>项目附件（选填）</Label>
              <p className="mt-1 text-xs text-ink-40">
                单文件不超过 {MAX_ATTACHMENT_LABEL}
              </p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {attachments.map((a, i) => (
                  <div
                    key={`${a.name}-${i}`}
                    className="flex items-center justify-between rounded-xl border border-ink-20 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-60" />
                      <span className="truncate">{a.name}</span>
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
                  disabled={uploadingAttachment}
                  onClick={() => attachmentInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink-20 p-2.5 text-sm text-ink-60 hover:border-ink/40"
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

          <Button
            variant="brand"
            size="lg"
            className="h-auto w-full whitespace-normal py-3"
            disabled={submitting}
            onClick={handleSubmit}
          >
            <FileSignature className="h-4 w-4" />
            {submitting
              ? "提交中..."
              : isSelfOrder
                ? "生成确认链接发给委托人"
                : "提交给设计师确认费用"}
          </Button>
          {!canSubmit ? (
            <p className="text-center text-[11px] text-rose-500">
              还有必填项未完成。点击提交会跳转到需要填写的位置。
            </p>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="space-y-3 p-4 sm:p-6">
            <div className="text-xs uppercase tracking-wider text-ink-40">费用预览</div>
            <div className="text-2xl font-bold tabular-nums text-ink">
              {previewTotalAmount ? formatCurrency(previewTotalAmount) : "待填写"}
            </div>
            <p className="text-xs leading-relaxed text-ink-60">
              {billingTab === "direct_amount"
                ? "以您填写的费用为准，提交后设计师可确认或调整。"
                : "按该设计师已设定的取费标准估算，提交后对方可确认或调整。"}
            </p>
          </Card>
          <Card className="space-y-3 p-4 sm:p-6">
            <div className="text-xs uppercase tracking-wider text-ink-40">流程说明</div>
            <ol className="space-y-2 text-xs leading-relaxed text-ink-60">
              <li>① 填写项目需求与付款阶段</li>
              <li>② 设计师确认费用与付款阶段</li>
              <li>③ 您确认后双方签约并预付</li>
              <li>④ 进入项目服务</li>
            </ol>
            <p className="rounded-xl bg-brand/5 p-3 text-[11px] leading-relaxed text-ink-60">
              按面积取费以该设计师本人费率为准。最终费用与阶段由设计师确认后，需您确认才会进入签约。
              定向下单平台服务费为 {formatDirectedPlatformFeeLabel(taxPointRateFromOption(tax))}。
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
