"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ScanPaymentStagesEditor } from "@/components/domain/scan-payment-stages-editor";
import {
  ArrowLeft,
  CircleDollarSign,
  FileSignature,
  QrCode,
  Sparkles,
  Timer,
  Wallet,
} from "lucide-react";
import { getDesignerV11TimeRates } from "@/lib/designer-rates";
import {
  computeScanOrderTotal,
  defaultPaymentStages,
  paymentStagesValid,
  type ScanPricingMode,
} from "@/lib/scan-order";
import type { BillingMode, DesignerLevel, ServiceMode } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { createOrderRequest } from "@/lib/api-client";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";
import { DesignerName } from "@/components/domain/designer-name";
import {
  DesignerLevelBadge,
} from "@/components/domain/level-badges";

export default function ScanOrderPage({
  params,
}: {
  params: { designerId: string };
}) {
  return <ScanOrderForm designerId={params.designerId} />;
}

function ScanOrderForm({ designerId }: { designerId: string }) {
  const router = useRouter();
  const { data: designer, loading } = useDesigner(designerId);
  const push = useSessionStore((s) => s.pushNotification);
  const setRole = useRoleStore((s) => s.setRole);
  const role = useRoleStore((s) => s.role);
  const identityId = useRoleStore((s) => s.identityId);
  const [submitting, setSubmitting] = useState(false);

  const [pricingMode, setPricingMode] = useState<ScanPricingMode>("hourly");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("online");
  const [billingMode, setBillingMode] = useState<BillingMode>("daily");
  const [workDays, setWorkDays] = useState(5);
  const [months, setMonths] = useState(1);
  const [fixedAmount, setFixedAmount] = useState(28000);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [paymentStages, setPaymentStages] = useState(() => defaultPaymentStages());

  useEffect(() => {
    if (role === "guest") setRole("client");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-switch on mount
  }, []);

  const level: DesignerLevel = designer?.level ?? "mid_v1";
  const v11Rates = useMemo(
    () => (designer ? getDesignerV11TimeRates({ ...designer, level }) : null),
    [designer, level],
  );
  const unitDaily =
    serviceMode === "online"
      ? v11Rates?.remote.daily ?? 0
      : v11Rates?.onsite.daily ?? 0;
  const unitMonthly =
    serviceMode === "online"
      ? v11Rates?.remote.monthly ?? 0
      : v11Rates?.onsite.monthly ?? 0;

  const totalAmount = useMemo(
    () =>
      computeScanOrderTotal({
        pricingMode,
        billingMode,
        unitDaily,
        unitMonthly,
        workDays,
        months,
        fixedAmount,
      }),
    [
      pricingMode,
      billingMode,
      unitDaily,
      unitMonthly,
      workDays,
      months,
      fixedAmount,
    ],
  );

  if (loading || !designer) {
    return (
      <div className="container-page py-20 text-center text-ink-60">
        正在加载设计师信息...
      </div>
    );
  }

  const canSubmit =
    title.trim().length > 1 &&
    description.length > 4 &&
    totalAmount > 0 &&
    paymentStagesValid(paymentStages);

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
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
      const order = await createOrderRequest({
        designerId: designer.id,
        title: title.trim(),
        specialty: designer.specialty,
        projectType: "扫码下单",
        serviceMode,
        billingMode: pricingMode === "hourly" ? billingMode : "area",
        orderSource: "scan",
        totalAmount,
        description,
        selectedSlots: [],
        customStageRatios: paymentStages.map((s) => ({
          name: s.name,
          ratio: s.ratio,
        })),
      });
      push({
        title: "扫码下单已提交",
        description: `已发送给 ${designer.name} 确认付款阶段，订单号 ${order.code}。`,
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

  return (
    <div className="container-page py-10">
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-60">
        <QrCode className="h-4 w-4 text-brand" />
        <span>扫码下单 · 直连设计师</span>
      </div>

      <Link
        href={`/designers/${designer.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 查看设计师主页
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
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

          <Card className="p-8">
            <h2 className="text-lg font-semibold text-ink">1 · 报价方式</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Choice
                active={pricingMode === "hourly"}
                onClick={() => setPricingMode("hourly")}
                icon={Timer}
                title="按工时"
                desc="按工日或按月，沿用设计师公开报价"
              />
              <Choice
                active={pricingMode === "fixed"}
                onClick={() => setPricingMode("fixed")}
                icon={Wallet}
                title="按总价"
                desc="一口价包干，适合范围清晰的项目"
              />
            </div>

            {pricingMode === "hourly" ? (
              <>
                <Separator className="my-6" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Choice
                    active={serviceMode === "online"}
                    onClick={() => setServiceMode("online")}
                    icon={Sparkles}
                    title="线上远程"
                    desc={`${formatCurrency(unitDaily)} / 工日`}
                  />
                  <Choice
                    active={serviceMode === "onsite"}
                    onClick={() => setServiceMode("onsite")}
                    icon={CircleDollarSign}
                    title="线下驻场"
                    desc={`${formatCurrency(unitDaily)} / 工日`}
                    disabled={!designer.serviceModes.includes("onsite")}
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Choice
                    active={billingMode === "daily"}
                    onClick={() => setBillingMode("daily")}
                    icon={Timer}
                    title="按工日"
                    desc="填写预计工日数"
                  />
                  <Choice
                    active={billingMode === "monthly"}
                    onClick={() => setBillingMode("monthly")}
                    icon={CircleDollarSign}
                    title="按月雇佣"
                    desc={`${formatCurrency(unitMonthly)} / 月`}
                  />
                </div>
                <div className="mt-4">
                  <Label>
                    {billingMode === "daily" ? "预计工日数" : "雇佣月数"}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    className="mt-2 max-w-[200px]"
                    value={billingMode === "daily" ? workDays : months}
                    onChange={(e) => {
                      const v = Math.max(1, Number(e.target.value) || 1);
                      if (billingMode === "daily") setWorkDays(v);
                      else setMonths(v);
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="mt-4">
                <Label>项目总价（元）</Label>
                <Input
                  type="number"
                  min={1000}
                  step={100}
                  className="mt-2 max-w-xs"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(Number(e.target.value) || 0)}
                />
              </div>
            )}
          </Card>

          <Card className="p-8">
            <h2 className="text-lg font-semibold text-ink">2 · 项目说明</h2>
            <div className="mt-5 space-y-4">
              <div>
                <Label>项目标题</Label>
                <Input
                  className="mt-2"
                  placeholder="如：徐汇复式住宅方案深化"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Label>需求描述</Label>
                <Textarea
                  className="mt-2 min-h-[120px]"
                  placeholder="说明范围、交付物、时间节点等，便于设计师确认付款条件"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </Card>

          <Card className="p-8">
            <h2 className="text-lg font-semibold text-ink">3 · 付款阶段</h2>
            <p className="mt-1 text-sm text-ink-60">
              提交后由设计师确认或调整；确认后生成模板电子合同，双方签约后支付预付款进入服务。
            </p>
            <ScanPaymentStagesEditor
              className="mt-5"
              stages={paymentStages}
              onChange={setPaymentStages}
              totalAmount={totalAmount}
            />
          </Card>

          <Button
            variant="brand"
            size="lg"
            className="w-full"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            <FileSignature className="h-4 w-4" /> 提交给设计师确认
          </Button>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="p-6">
            <div className="text-xs uppercase tracking-wider text-ink-40">费用预览</div>
            <div className="mt-3 text-3xl font-semibold tabular-nums text-ink">
              {formatCurrency(totalAmount)}
            </div>
            <ul className="mt-4 space-y-2 text-xs text-ink-60">
              {paymentStages.map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <span>
                    {s.name} · {s.ratio}%
                  </span>
                  <span className="font-medium text-ink">
                    {formatCurrency(Math.round((totalAmount * s.ratio) / 100))}
                  </span>
                </li>
              ))}
            </ul>
            <Separator className="my-4" />
            <ol className="space-y-2 text-[11px] leading-relaxed text-ink-50">
              <li>① 设计师确认付款阶段与条件</li>
              <li>② 生成电子合同 · 双方签约</li>
              <li>③ 委托人支付预付款 · 进入项目服务</li>
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Choice({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-colors",
        active
          ? "border-brand bg-brand/5 ring-1 ring-brand/30"
          : "border-ink-20 hover:border-ink-40",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <Icon className={cn("h-5 w-5", active ? "text-brand" : "text-ink-40")} />
      <div className="mt-2 font-semibold text-ink">{title}</div>
      <div className="mt-1 text-xs text-ink-60">{desc}</div>
    </button>
  );
}
