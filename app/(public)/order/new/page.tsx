"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDesigner } from "@/lib/use-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  Check,
  CircleDollarSign,
  FileSignature,
  MapPin,
  Sparkles,
  TimerReset,
  Wifi,
} from "lucide-react";
import { SUB_SPECIALTIES, getProjectTypes } from "@/lib/constants";
import { getDesignerV11TimeRates } from "@/lib/designer-rates";
import { formatCurrency } from "@/lib/utils";
import type { DesignerLevel, HalfDaySlot, ServiceMode } from "@/lib/types";

type DirectedBillingMode = "daily" | "monthly";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";
import { createOrderRequest } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DesignerName } from "@/components/domain/designer-name";
import {
  DesignerLevelBadge,
  DesignerLevelCoefficientBadge,
} from "@/components/domain/level-badges";
import { DesignerSchedulePicker } from "@/components/domain/designer-schedule-picker";
import { DesignerMonthPicker } from "@/components/domain/designer-month-picker";
import {
  formatSelectedSlotsSummary,
  formatSelectedMonthsSummary,
  halfDaysToWorkDays,
  slotsToDateRange,
  type MonthKey,
} from "@/lib/designer-schedule";
import {
  MONTHLY_BILLING_RULE,
  buildMonthlyStages,
} from "@/lib/monthly-billing";

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-ink-60">加载下单表单...</div>}>
      <NewOrderInner />
    </Suspense>
  );
}

function NewOrderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const designerId = params.get("designer");
  const initialMode = params.get("mode") as ServiceMode | null;

  const [step, setStep] = useState(0);
  const [serviceMode, setServiceMode] = useState<ServiceMode>(
    initialMode || "online",
  );
  const [billingMode, setBillingMode] = useState<DirectedBillingMode>("daily");
  const [selectedSlots, setSelectedSlots] = useState<HalfDaySlot[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<MonthKey[]>([]);
  const [address, setAddress] = useState("");
  const [subSpecialty, setSubSpecialty] = useState("");
  const [projectType, setProjectType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [withAudit, setWithAudit] = useState(false);
  const [withPM, setWithPM] = useState(false);

  const { data: designer } = useDesigner(designerId);
  const push = useSessionStore((s) => s.pushNotification);
  const setRole = useRoleStore((s) => s.setRole);
  const role = useRoleStore((s) => s.role);
  const identityId = useRoleStore((s) => s.identityId);

  const workDays = halfDaysToWorkDays(selectedSlots);
  const months = selectedMonths.length;
  const dateRange = slotsToDateRange(selectedSlots);

  const handleBillingModeChange = (mode: DirectedBillingMode) => {
    setBillingMode(mode);
    if (mode === "daily") setSelectedMonths([]);
    else setSelectedSlots([]);
  };

  const hasScheduleSelection =
    billingMode === "daily" ? selectedSlots.length >= 1 : selectedMonths.length >= 1;

  useEffect(() => {
    if (role === "guest") {
      setRole("client");
    }
  }, [role, setRole]);

  const projectTypes = designer ? getProjectTypes(designer.specialty) : [];
  const subSpecialties = designer ? SUB_SPECIALTIES[designer.specialty] : [];

  const v11Rates = useMemo(() => {
    if (!designer) return null;
    const level: DesignerLevel = designer.level ?? "mid_v1";
    return getDesignerV11TimeRates({ ...designer, level });
  }, [designer]);

  const unitDaily =
    serviceMode === "online" ? v11Rates?.remote.daily ?? 0 : v11Rates?.onsite.daily ?? 0;
  const unitMonthly =
    serviceMode === "online" ? v11Rates?.remote.monthly ?? 0 : v11Rates?.onsite.monthly ?? 0;

  const totalAmount = useMemo(() => {
    if (!designer || !v11Rates) return 0;
    if (billingMode === "monthly") return unitMonthly * Math.max(months, 0);
    return unitDaily * Math.max(workDays, 0);
  }, [billingMode, workDays, months, designer, unitDaily, unitMonthly, v11Rates]);

  const monthlyPreviewStages = useMemo(
    () =>
      billingMode === "monthly" && selectedMonths.length > 0
        ? buildMonthlyStages("preview", totalAmount, selectedMonths)
        : [],
    [billingMode, selectedMonths, totalAmount],
  );

  const platformFee = Math.round(totalAmount * 0.08);
  const auditFee = withAudit ? Math.round(totalAmount * 0.08) : 0;
  const pmFee = withPM ? Math.round(totalAmount * 0.2) : 0;
  const grandTotal = totalAmount + auditFee + pmFee;
  const designerNet = totalAmount - platformFee;

  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!designer || !hasScheduleSelection || submitting) return;
    setSubmitting(true);
    try {
      // 优先写入数据库（已登录的委托人）
      const order = await createOrderRequest({
        designerId: designer.id,
        title,
        specialty: designer.specialty,
        subSpecialty: subSpecialty || undefined,
        projectType,
        serviceMode,
        billingMode,
        orderSource: "directed",
        totalAmount,
        description,
        selectedSlots: billingMode === "daily" ? selectedSlots : [],
        selectedMonths: billingMode === "monthly" ? selectedMonths : undefined,
        address: serviceMode === "onsite" ? address : undefined,
        scheduleFrom: dateRange?.from,
        scheduleTo: dateRange?.to,
        withAuditService: withAudit,
        withProjectManagement: withPM,
      });
      push({
        title: "下单成功",
        description: `订单号 ${order.code}，已发送给 ${designer.name} 确认档期。`,
        variant: "success",
      });
      router.push("/client/orders");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "请稍后再试";
      if (msg.includes("401") || msg.includes("登录") || role === "guest") {
        push({
          title: "请先登录",
          description: "定向下单需使用委托人账号登录。",
          variant: "destructive",
        });
        router.push(`/login?redirect=/order/new?designerId=${designer.id}`);
        return;
      }
      push({
        title: "下单失败",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!designerId || !designer) {
    return (
      <div className="container-page py-20">
        <Card className="mx-auto max-w-md p-10 text-center">
          <h2 className="text-lg font-semibold text-ink">请先选择设计师</h2>
          <p className="mt-2 text-sm text-ink-60">
            进入设计师列表挑选喜欢的设计师,从主页发起定向下单。
          </p>
          <Button asChild className="mt-5">
            <Link href="/designers">浏览设计师</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const designerLevel: DesignerLevel = designer.level ?? "mid_v1";

  const STEPS = [
    { id: "service", label: "服务类型" },
    { id: "scope", label: "项目内容" },
    { id: "payment", label: "确认 · 支付" },
  ];

  const canNextStep0 =
    serviceMode !== undefined &&
    hasScheduleSelection &&
    (serviceMode !== "onsite" || address.trim().length > 2);
  const canNextStep1 =
    title.trim().length > 1 && projectType && subSpecialty && description.length > 4;

  return (
    <div className="container-page py-10">
      <Link
        href={`/designers/${designer.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回设计师主页
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    i <= step
                      ? "bg-ink text-white"
                      : "border border-ink-20 text-ink-40",
                  )}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-sm",
                    i === step ? "font-medium text-ink" : "text-ink-60",
                  )}
                >
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="mx-2 h-px w-12 bg-ink-20" />
                )}
              </div>
            ))}
          </div>

          {step === 0 && (
            <Card className="p-8">
              <h2 className="text-lg font-semibold text-ink">第 1 步 · 选择服务类型与计费</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <ChoiceCard
                  active={serviceMode === "online"}
                  onClick={() => setServiceMode("online")}
                  icon={Wifi}
                  title="纯线上服务"
                  description="远程沟通,在线交付文件,无现场上门。"
                />
                <ChoiceCard
                  active={serviceMode === "onsite"}
                  onClick={() => setServiceMode("onsite")}
                  icon={MapPin}
                  title="线下上门服务"
                  description="设计师现场踏勘 + 落地对接,需查看档期并预付全款。"
                  disabled={!designer.serviceModes.includes("onsite")}
                />
              </div>

              <Separator className="my-7" />

              <div className="grid gap-4 md:grid-cols-2">
                <ChoiceCard
                  active={billingMode === "daily"}
                  onClick={() => handleBillingModeChange("daily")}
                  icon={CircleDollarSign}
                  title={`按天计费 · ${formatCurrency(unitDaily)} / 天`}
                  description={
                    selectedSlots.length > 0
                      ? `已选 ${workDays} 工日 · 小计 ${formatCurrency(unitDaily * workDays)}`
                      : `v1.1 单价（${serviceMode === "online" ? "线上远程" : "线下驻场"} · ${v11Rates?.trackLabel ?? ""}）× 等级 × 地区`
                  }
                />
                <ChoiceCard
                  active={billingMode === "monthly"}
                  onClick={() => handleBillingModeChange("monthly")}
                  icon={CalendarRange}
                  title={`按月雇佣 · ${formatCurrency(unitMonthly)} / 月`}
                  description={
                    selectedMonths.length > 0
                      ? `已选 ${months} 个月 · 小计 ${formatCurrency(unitMonthly * months)}`
                      : "首月预付，每月 25 号前支付下月服务费。"
                  }
                />
              </div>

              <Separator className="my-7" />

              <div>
                <div className="mb-4">
                  <Label className="text-base font-semibold text-ink">
                    {billingMode === "daily" ? "选择服务档期（按半天）" : "选择雇佣月份"}
                  </Label>
                  <p className="mt-1 text-xs text-ink-60">
                    {billingMode === "daily"
                      ? "在设计师空闲档期内点选上午/下午，可连续或跳跃多选，最少半天。提交后发送给设计师确认。"
                      : "点选要雇佣的月份，可连续或跳跃多选，至少 1 个月。提交后发送给设计师确认。"}
                  </p>
                </div>
                {billingMode === "daily" ? (
                  <DesignerSchedulePicker
                    calendar={designer.calendar}
                    value={selectedSlots}
                    onChange={setSelectedSlots}
                  />
                ) : (
                  <DesignerMonthPicker
                    calendar={designer.calendar}
                    value={selectedMonths}
                    onChange={setSelectedMonths}
                  />
                )}
              </div>

              {serviceMode === "onsite" && (
                <div className="mt-6">
                  <Label>项目地址</Label>
                  <Input
                    placeholder="精确到门牌号"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-2"
                  />
                </div>
              )}

              <div className="mt-7 flex items-center justify-end gap-2">
                <Button
                  variant="brand"
                  onClick={() => setStep(1)}
                  disabled={!canNextStep0}
                >
                  下一步 <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card className="p-8">
              <h2 className="text-lg font-semibold text-ink">
                第 2 步 · 项目详细信息
              </h2>
              <div className="mt-6 grid gap-5">
                <div>
                  <Label>项目名称</Label>
                  <Input
                    placeholder="例如:杭州未来社区中心庭院 · 景观全专业施工图"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>子专业</Label>
                    <Select value={subSpecialty} onValueChange={setSubSpecialty}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="选择子专业" />
                      </SelectTrigger>
                      <SelectContent>
                        {subSpecialties.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>项目类型</Label>
                    <Select value={projectType} onValueChange={setProjectType}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="选择项目类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>项目描述与服务要求</Label>
                  <Textarea
                    rows={6}
                    placeholder="请描述项目背景、规模、交付深度、关键节点等"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>v1.1 增值服务（可选加购）</Label>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
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
                </div>
              </div>

              <div className="mt-7 flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4" /> 上一步
                </Button>
                <Button
                  variant="brand"
                  onClick={() => setStep(2)}
                  disabled={!canNextStep1}
                >
                  下一步 <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {step === 2 && (
            <Card className="p-8">
              <h2 className="text-lg font-semibold text-ink">
                第 3 步 · 确认订单并支付
              </h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-ink-20 bg-ink-20/20 p-5">
                  <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                    {billingMode === "monthly"
                      ? "按月雇佣付款方案"
                      : "分阶段付款方案 · 默认 30 / 40 / 30"}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm">
                    {billingMode === "monthly"
                      ? monthlyPreviewStages.map((stage) => (
                          <MonthlyStageRow
                            key={stage.id}
                            label={stage.name}
                            amount={stage.amount}
                          />
                        ))
                      : (
                        <>
                          <StageRow label="预付款" ratio={0.3} amount={totalAmount} />
                          <StageRow
                            label="中期款 · 阶段成果上传后支付"
                            ratio={0.4}
                            amount={totalAmount}
                          />
                          <StageRow
                            label="尾款 · 终稿验收后支付"
                            ratio={0.3}
                            amount={totalAmount}
                          />
                        </>
                      )}
                  </div>
                  <div className="mt-3 flex items-start gap-2 text-xs text-ink-60">
                    <TimerReset className="mt-0.5 h-3.5 w-3.5" />
                    {billingMode === "monthly"
                      ? MONTHLY_BILLING_RULE
                      : "每笔款项支付后进入平台 30 天托管,验收无误自动解冻给设计师。"}
                  </div>
                </div>

                <div className="rounded-2xl border border-ink-20 p-5">
                  <div className="flex items-start gap-3">
                    <FileSignature className="mt-0.5 h-5 w-5 text-brand" />
                    <div>
                      <div className="text-sm font-medium text-ink">
                        电子合同将自动生成
                      </div>
                      <div className="mt-1 text-xs text-ink-60">
                        档期确认后自动生成合同，记录服务范围、交付清单、付款节点等条款。永久存档可在订单详情查阅。
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 h-5 w-5 text-brand" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ink">
                        本次支付方式
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="brand">微信支付</Badge>
                        <Badge variant="muted">支付宝</Badge>
                        <Badge variant="muted">企业对公转账</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-7 flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" /> 上一步
                </Button>
                <Button
                  variant="brand"
                  onClick={handleConfirm}
                  disabled={!hasScheduleSelection || submitting}
                >
                  {submitting
                    ? "提交中..."
                    : `发送档期申请并支付预付款 ${formatCurrency(Math.round(totalAmount * 0.3))}`}
                </Button>
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={designer.avatar} alt={designer.name} />
                <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-ink">
                  <DesignerName designer={designer} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <DesignerLevelBadge level={designerLevel} />
                  <DesignerLevelCoefficientBadge level={designerLevel} />
                </div>
                <div className="truncate text-xs text-ink-60">{designer.tagline}</div>
              </div>
            </div>
            <Separator />
            <div className="mt-5 space-y-3 text-sm">
              <Row label="服务模式" value={serviceMode === "online" ? "纯线上" : "线下上门"} />
              <Row label="计费模式" value={billingMode === "daily" ? "按天计费" : "按月雇佣"} />
              <Row
                label={billingMode === "daily" ? "服务档期" : "雇佣月份"}
                value={
                  billingMode === "daily"
                    ? selectedSlots.length > 0
                      ? formatSelectedSlotsSummary(selectedSlots)
                      : "未选择"
                    : selectedMonths.length > 0
                      ? formatSelectedMonthsSummary(selectedMonths)
                      : "未选择"
                }
              />
              <Row
                label={billingMode === "daily" ? "工日" : "雇佣月数"}
                value={
                  billingMode === "daily"
                    ? `${workDays} 天`
                    : `${months} 个月`
                }
              />
              <Row
                label="v1.1 单价（当前模式）"
                value={
                  billingMode === "daily"
                    ? `${formatCurrency(unitDaily)} / 天`
                    : `${formatCurrency(unitMonthly)} / 月`
                }
              />
              <Row
                label="线上 / 线下（日）"
                value={`${formatCurrency(v11Rates?.remote.daily ?? 0)} / ${formatCurrency(v11Rates?.onsite.daily ?? 0)}`}
              />
              <Row
                label="线上 / 线下（月）"
                value={`${formatCurrency(v11Rates?.remote.monthly ?? 0)} / ${formatCurrency(v11Rates?.onsite.monthly ?? 0)}`}
              />
              <Separator />
              <Row label="设计费小计" value={formatCurrency(totalAmount)} />
              {withAudit ? (
                <Row
                  label="第三方审图 (+8%)"
                  value={`+${formatCurrency(auditFee)}`}
                  tone="amber"
                />
              ) : null}
              {withPM ? (
                <Row
                  label="项目管理 (+20%)"
                  value={`+${formatCurrency(pmFee)}`}
                  tone="violet"
                />
              ) : null}
              <Row
                label="平台手续费 (8%)"
                value={`-${formatCurrency(platformFee)}`}
                tone="rose"
              />
              {withAudit || withPM ? (
                <div className="flex items-end justify-between border-t border-ink-20 pt-3">
                  <span className="text-xs text-ink-60">含增值服务合计</span>
                  <span className="text-base font-semibold text-ink">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-end justify-between border-t border-ink-20 pt-3">
                <span className="text-xs text-ink-60">设计师实际到账</span>
                <span className="text-base font-semibold text-emerald-700">
                  {formatCurrency(designerNet)}
                </span>
              </div>
            </div>
          </Card>

          <Card className="space-y-3 p-6 text-xs text-ink-60">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              档期发送后需设计师确认，确认后自动生成电子合同并永久存档。
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-brand" />
              所有阶段款项托管于平台,验收无误后自动结算给设计师。
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  icon: Icon,
  title,
  description,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-5 text-left transition-all",
        disabled && "cursor-not-allowed opacity-50",
        active
          ? "border-ink bg-ink-20/30 shadow-sm"
          : "border-ink-20 hover:border-ink/40",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          active ? "bg-ink text-white" : "bg-ink-20/50 text-ink-60",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-1 text-xs text-ink-60">{description}</div>
      </div>
    </button>
  );
}

function StageRow({
  label,
  ratio,
  amount,
}: {
  label: string;
  ratio: number;
  amount: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-20 bg-white p-3">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs text-ink-60">{Math.round(ratio * 100)}%</div>
      </div>
      <div className="text-base font-semibold tracking-tight text-ink">
        {formatCurrency(Math.round(amount * ratio))}
      </div>
    </div>
  );
}

function MonthlyStageRow({
  label,
  amount,
}: {
  label: string;
  amount: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-20 bg-white p-3">
      <div className="text-sm font-medium text-ink">{label}</div>
      <div className="text-base font-semibold tracking-tight text-ink">
        {formatCurrency(amount)}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "rose" | "amber" | "violet";
}) {
  const toneCls =
    tone === "rose"
      ? "text-rose-600"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "violet"
          ? "text-violet-700"
          : "text-ink";
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-60">{label}</span>
      <span className={toneCls}>{value}</span>
    </div>
  );
}
