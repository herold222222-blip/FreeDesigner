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
import {
  difficultyOptionKey,
  getHardscapeScopeNote,
  landscapeAreaDifficultyUI,
} from "@/lib/landscape-area-difficulty";
import { buildRegularEntrustDescription } from "@/lib/entrust-submit";
import { resolveLandscapeAreaPaymentStages } from "@/lib/landscape-payment-stages";
import { PlatformPaymentStagesPreview } from "@/components/domain/platform-payment-stages-preview";
import { getProjectTypes } from "@/lib/constants";
import type { BountyAttachment, ServiceMode, Specialty } from "@/lib/types";
import {
  ArrowLeft,
  Calculator,
  FileSignature,
  Paperclip,
  QrCode,
  Ruler,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { createOrderRequest } from "@/lib/api-client";
import { expectedDateFieldLabel } from "@/lib/order-lifecycle";
import { cn, formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import { DesignerName } from "@/components/domain/designer-name";
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
type ScanBillingTab = "platform_area" | "direct_amount";

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
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("online");
  const [area, setArea] = useState<number | "">("");
  const [selectedL2, setSelectedL2] = useState<string[]>([]);
  const [tracks, setTracks] = useState<TrackKey[]>([]);
  const [areaDifficulty, setAreaDifficulty] = useState<
    Partial<Record<TrackKey, number>>
  >({});
  const [buildType, setBuildType] = useState<"new" | "renovation" | null>(null);
  const [billingTab, setBillingTab] = useState<ScanBillingTab>("platform_area");
  const [directAmount, setDirectAmount] = useState<number | "">("");
  const [tax, setTax] = useState<{
    value: string;
    label: string;
    coefficient: number;
  } | null>(null);
  const [description, setDescription] = useState("");
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

  useEffect(() => {
    if (!client) return;
    setCommitterName(client.companyName || client.name || "");
    setContactName(client.contactName || client.name || "");
    setContactPhone(client.phone || "");
  }, [client]);

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
    typeof directAmount === "number" && directAmount > 0;

  const canSubmit =
    committerName.trim().length > 0 &&
    title.trim().length > 1 &&
    contactName.trim().length > 0 &&
    contactPhone.trim().length > 0 &&
    !!projectSiteResolution &&
    projectType.trim().length > 0 &&
    !!expectedDeliveryAt &&
    description.trim().length > 4 &&
    (billingTab === "platform_area" ? areaBillingComplete : directBillingComplete);

  const trackLabels = tracks.map(
    (t) => TRACK_OPTIONS.find((o) => o.value === t)?.label ?? t,
  );

  const platformPaymentStages = useMemo(() => {
    if (billingTab === "direct_amount") {
      return resolveLandscapeAreaPaymentStages(["construction_doc"]);
    }
    return resolveLandscapeAreaPaymentStages(selectedL2);
  }, [billingTab, selectedL2]);

  const paymentPreviewDescription =
    billingTab === "platform_area"
      ? selectedL2.length === 0
        ? "请先选择二级专业；仅选方案设计时适用方案阶段规则，含施工图/扩初时适用施工图规则（30 / 40 / 30）。"
        : selectedL2.every((l2) => l2 === "scheme")
          ? "当前为景观方案按面积项目，付款阶段按平台方案规则执行。"
          : "当前为景观施工图按面积项目，付款阶段按平台常规规则（30 / 40 / 30）执行。"
      : "以下为平台常规施工图付款阶段参考；提交后设计师可确认或调整。";

  const previewTotalAmount =
    billingTab === "direct_amount" && typeof directAmount === "number"
      ? directAmount
      : undefined;

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
    if (!canSubmit || submitting || !designer) return;
    if (role === "guest" || !identityId) {
      push({
        title: "请先登录",
        description: "扫码下单需使用委托人账号登录。",
        variant: "destructive",
      });
      router.push(`/login?redirect=/scan-order/${designer.id}`);
      return;
    }
    setSubmitting(true);
    try {
      const serviceModeLabel = serviceMode === "online" ? "线上远程" : "线下驻场";
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
              closingLine: "扫码下单已提交，等待设计师确认费用与付款阶段。",
            })
          : [
              description.trim(),
              "",
              "--- 委托联系信息 ---",
              committerName ? `委托方：${committerName}` : null,
              `联系人：${contactName}`,
              `电话：${contactPhone}`,
              projectCity ? `项目城市：${projectCity}` : null,
              "",
              "--- 计费摘要 ---",
              "计费方式：直接输入费用金额",
              `委托人填写费用：${formatCurrency(
                typeof directAmount === "number" ? directAmount : 0,
              )}`,
              `服务方式：${serviceModeLabel}`,
              "",
              "扫码下单已提交，等待设计师确认费用与付款阶段。",
            ]
              .filter(Boolean)
              .join("\n");
      const order = await createOrderRequest({
        designerId: designer.id,
        title: title.trim(),
        specialty,
        projectType,
        serviceMode,
        billingMode: "area",
        orderSource: "scan",
        totalAmount: 0,
        description: fullDescription,
        projectAreaSqm:
          billingTab === "platform_area" && typeof area === "number"
            ? area
            : undefined,
        expectedDeliveryAt,
        attachments: attachments.length ? attachments : undefined,
        selectedSlots: [],
      });
      push({
        title: "需求已提交",
        description: `已发送给 ${designer.name}，请等待对方确认费用与付款阶段。订单号 ${order.code}。`,
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
    <div className="container-page py-10">
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-60">
        <QrCode className="h-4 w-4 text-brand" />
        <span>扫码下单 · 填写项目需求</span>
      </div>

      <Link
        href={`/designers/${designer.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 查看设计师主页
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={designer.avatar} alt={designer.name} />
                <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold text-ink">
                  <DesignerName designer={designer} />
                </h1>
                <div className="mt-1 flex flex-wrap gap-2">
                  <DesignerLevelBadge level={level} />
                  <Badge variant="muted">{designer.tagline}</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <h2 className="text-lg font-semibold text-ink">1 · 填写委托方</h2>
            <p className="text-xs text-ink-60">
              已登录委托人账号时将自动填充；联系人可与委托方名称相同或另行填写。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
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
              <div>
                <Label>联系人 *</Label>
                <Input
                  className="mt-2"
                  placeholder="可与委托方一致或另行输入"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div>
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

          <Card className="space-y-5 p-6">
            <h2 className="text-lg font-semibold text-ink">2 · 项目信息</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>项目名称 *</Label>
                <Input
                  className="mt-2"
                  placeholder="如：徐汇复式住宅景观施工图"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>项目所在地 *</Label>
                <div className="relative z-[5] mt-2">
                  <AdministrativeRegionSelector
                    triple={projectAdminTriple}
                    onTripleChange={setProjectAdminTriple}
                  />
                </div>
              </div>
              <div>
                <Label>项目类型 *</Label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
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
              <div>
                <Label>
                  {expectedDateFieldLabel(serviceMode)}
                  <span className="ml-1 text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  className="mt-2"
                  value={expectedDeliveryAt}
                  onChange={(e) => setExpectedDeliveryAt(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>服务方式</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { v: "online" as const, l: "线上远程" },
                    { v: "onsite" as const, l: "线下驻场" },
                  ].map((m) => (
                    <button
                      key={m.v}
                      type="button"
                      disabled={
                        m.v === "onsite" && !designer.serviceModes.includes("onsite")
                      }
                      onClick={() => setServiceMode(m.v)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm transition-colors",
                        serviceMode === m.v
                          ? "border-brand bg-brand/5 text-brand"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                        m.v === "onsite" &&
                          !designer.serviceModes.includes("onsite") &&
                          "cursor-not-allowed opacity-50",
                      )}
                    >
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">3 · 费用计算</h2>
              {billingTab === "platform_area" ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/calculator" target="_blank">
                    <Calculator className="h-3.5 w-3.5" /> 平台收费标准
                  </Link>
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                {
                  v: "platform_area" as const,
                  l: "按面积计费（平台标准）",
                  icon: Ruler,
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
                    onClick={() => setBillingTab(tab.v)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
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
              <div>
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
              <div className="sm:col-span-2">
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
              <div className="sm:col-span-2">
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
                            <div className="grid gap-2 sm:grid-cols-2">
                              {ui.options.map((opt) => (
                                <div
                                  key={difficultyOptionKey(opt)}
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
              </div>
              <div>
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
              <div>
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
            ) : (
              <div className="space-y-4">
                <div className="max-w-xs">
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
                <p className="text-xs leading-relaxed text-ink-60">
                  填写您期望的项目费用即可，无需填写面积与专业难度。提交后设计师可确认或调整，并设置付款阶段。
                </p>
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-ink">4 · 项目描述与附件</h2>
            <div>
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
            className="w-full"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            <FileSignature className="h-4 w-4" />
            {submitting ? "提交中..." : "提交给设计师确认费用"}
          </Button>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <PlatformPaymentStagesPreview
            stages={platformPaymentStages}
            totalAmount={previewTotalAmount}
            description={paymentPreviewDescription}
          />
          <Card className="space-y-3 p-6">
            <div className="text-xs uppercase tracking-wider text-ink-40">流程说明</div>
            <ol className="space-y-2 text-xs leading-relaxed text-ink-60">
              <li>① 填写项目需求（按面积或直填费用）</li>
              <li>② 设计师确认费用与付款阶段</li>
              <li>③ 您确认后双方签约并预付</li>
              <li>④ 进入项目服务</li>
            </ol>
            <p className="rounded-xl bg-brand/5 p-3 text-[11px] leading-relaxed text-ink-60">
              以上为平台标准付款条件；最终费用与阶段由设计师确认后，需您确认才会进入签约。
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
