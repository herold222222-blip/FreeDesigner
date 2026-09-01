"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSignature,
  Lock,
  Printer,
  ShieldCheck,
} from "lucide-react";
import {
  designerSignOrderRequest,
  fetchContractViewRequest,
  signOrderRequest,
  type ContractViewPayload,
} from "@/lib/api-client";
import { ContractSignDialog } from "@/components/domain/contract-sign-dialog";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import { invalidateApiPath } from "@/lib/use-data";
import { formatCurrency, formatDate, formatOptionalDate } from "@/lib/utils";
import { clientOrderDetailHref } from "@/lib/unified-project-list";
import {
  needsClientSign,
  needsDesignerSign,
  orderExpectedDateLabel,
} from "@/lib/order-lifecycle";
import {
  formatDirectedPlatformFeeLabel,
  isDirectedLikeOrderSource,
  resolveOrderPlatformFeeRate,
  taxPointRateFromCoefficient,
  orderTaxCoefficient,
} from "@/lib/directed-platform-fee";
import { resolveStagePaymentCondition } from "@/lib/order-payment-stages";
import { usePlatformPricingStore } from "@/store/platform-pricing-store";
import {
  labelEntrustBillingMode,
  parseRegularEntrustDescription,
} from "@/lib/entrust-description";
import {
  maskPhonesInText,
  resolveVisiblePhone,
} from "@/lib/designer-contact-privacy";
import type { Order } from "@/lib/types";

export default function ContractPage({ params }: { params: { id: string } }) {
  const role = useRoleStore((s) => s.role);
  const identityId = useRoleStore((s) => s.identityId);
  const push = useSessionStore((s) => s.pushNotification);
  const commerce = usePlatformPricingStore((s) => s.config.commerce);
  const [data, setData] = useState<ContractViewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signOpen, setSignOpen] = useState(false);
  const [signatureDraft, setSignatureDraft] = useState("");
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    let active = true;
    fetchContractViewRequest(params.id)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.id]);

  const order = data?.order;
  const canClientSign = Boolean(
    order &&
      role === "client" &&
      identityId === order.clientId &&
      needsClientSign(order),
  );
  const canDesignerSign = Boolean(
    order &&
      role === "designer" &&
      identityId === order.designerId &&
      needsDesignerSign(order),
  );
  const canSign = canClientSign || canDesignerSign;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] py-20 text-center text-ink-60">
        正在加载合同...
      </div>
    );
  }

  if (error || !data || !order) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] py-20 text-center">
        <p className="text-ink-60">{error ?? "合同不存在"}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/client/orders">返回订单</Link>
        </Button>
      </div>
    );
  }

  const { client, designer } = data;
  const signedByClient = order.clientSignedContract === true;
  const signedByDesigner = order.designerSignedContract === true;
  const allSigned = signedByClient && signedByDesigner;
  const orderHref =
    role === "designer"
      ? `/designer/orders/${order.id}`
      : clientOrderDetailHref(order);

  const handleSaveHandwriting = (signature: string) => {
    setSignatureDraft(signature);
    setSignOpen(false);
    push({
      title: "手写签名已确认",
      description: "请再点击「完成签署」提交合同。",
      variant: "success",
    });
  };

  const handleCompleteSign = async () => {
    if (signing || !signatureDraft) return;
    setSigning(true);
    try {
      const nextOrder = canDesignerSign
        ? await designerSignOrderRequest(order.id, signatureDraft)
        : await signOrderRequest(order.id, signatureDraft);
      setData((prev) => (prev ? { ...prev, order: nextOrder } : prev));
      invalidateApiPath(`/api/orders/${order.id}`);
      setSignatureDraft("");
      push({
        title: "合同已签署",
        description: canDesignerSign
          ? "请等待委托人完成签署并支付预付款。"
          : "请等待设计师完成签署后支付预付款。",
        variant: "success",
      });
    } catch (e) {
      push({
        title: "签署失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="container-page py-10">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={orderHref}
            className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 返回订单详情
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="h-3.5 w-3.5" /> 打印
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" /> 下载 PDF
            </Button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <Card className="overflow-hidden">
            <div className="border-b border-ink-20 bg-ink p-8 text-white">
              <div className="flex items-center gap-2">
                <FileSignature className="h-5 w-5" />
                <Badge className="bg-white/15 text-white">电子合同</Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                乐自由设计服务协议
              </h1>
              <div className="mt-2 text-sm text-white/70">
                合同编号 · {order.contractId || params.id} · 项目 {order.code}
              </div>
            </div>

            <div className="space-y-6 p-8 text-sm leading-relaxed text-ink">
              <Section title="一、合同主体">
                <Row label="甲方(委托人)">
                  {client?.name ?? "委托人"} ·{" "}
                  {client?.type === "enterprise" ? "企业" : "个人"}
                </Row>
                <Row label="乙方(设计师)">
                  {designer?.name ?? "待匹配"} · {designer?.location ?? "—"}
                </Row>
                <Row label="平台监管方">乐自由设计服务平台</Row>
              </Section>

              <Section title="二、服务内容">
                <ContractServiceContent
                  order={order}
                  revealContactPhone={
                    allSigned || role === "admin" || role === "super_admin"
                  }
                />
              </Section>

              <Section title="三、服务费用与付款节点">
                <Row label="合同总价款">
                  {formatCurrency(order.totalAmount)}（含税）
                </Row>
                <Row label="平台手续费率">
                  {isDirectedLikeOrderSource(order.orderSource)
                    ? `${formatDirectedPlatformFeeLabel(
                        taxPointRateFromCoefficient(orderTaxCoefficient(order)),
                      )}（由乙方承担）`
                    : `${Math.round(resolveOrderPlatformFeeRate(order) * 100)}%（由乙方承担）`}
                </Row>
                <div className="mt-3 grid gap-2">
                  {order.stages.map((s, i) => (
                    <PaymentRow
                      key={s.id}
                      stage={`${s.name} · ${Math.round(s.ratio * 100)}%`}
                      amount={s.amount}
                      condition={resolveStagePaymentCondition(
                        order,
                        s,
                        i,
                        commerce,
                      )}
                    />
                  ))}
                </div>
              </Section>

              <Section title="四、资金托管与结算">
                <p className="text-ink-80">
                  甲方付款后，款项由平台托管。乙方上传阶段成果并经甲方付费验收解锁后，
                  款项进入验收期。验收无异议后款项解冻并结算给乙方；全部阶段完成后双方确认最终服务完成。
                </p>
              </Section>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <SignatureBlock
                  party="甲方(委托人)"
                  name={client?.name ?? "委托人"}
                  signed={signedByClient}
                  signatureImage={
                    signedByClient
                      ? order.clientContractSignature
                      : canClientSign
                        ? signatureDraft
                        : undefined
                  }
                  draftPending={canClientSign && Boolean(signatureDraft)}
                  onSign={canClientSign ? () => setSignOpen(true) : undefined}
                />
                <SignatureBlock
                  party="乙方(设计师)"
                  name={designer?.name ?? "设计师"}
                  signed={signedByDesigner}
                  signatureImage={
                    signedByDesigner
                      ? order.designerContractSignature
                      : canDesignerSign
                        ? signatureDraft
                        : undefined
                  }
                  draftPending={canDesignerSign && Boolean(signatureDraft)}
                  onSign={canDesignerSign ? () => setSignOpen(true) : undefined}
                />
              </div>

              {allSigned ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div>
                      <div className="text-sm font-semibold text-emerald-900">
                        合同已生效 · 永久存档
                      </div>
                      <div className="mt-1 text-xs text-emerald-700">
                        生效时间 ·{" "}
                        {order.contractSignedAt
                          ? formatDate(order.contractSignedAt)
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                  {canSign ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>
                        {signatureDraft
                          ? "手写签名已确认，请再点击「完成签署」提交。"
                          : "请先点「手写签署」写下姓名，确认手写后再点「完成签署」。"}
                      </span>
                      <Button
                        variant={signatureDraft ? "brand" : "outline"}
                        size="sm"
                        disabled={signing || !signatureDraft}
                        onClick={handleCompleteSign}
                      >
                        {signing ? "签署中..." : "完成签署"}
                      </Button>
                    </div>
                  ) : (
                    <>
                      尚未完成双方签署。请前往
                      <Link href={orderHref} className="mx-1 font-medium underline">
                        订单详情
                      </Link>
                      完成电子签约与预付款。
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>

          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wider text-ink-40">
                合同状态
              </div>
              <div className="mt-3 space-y-2.5">
                <SignStatus party="设计师" signed={signedByDesigner} />
                <SignStatus party="委托人" signed={signedByClient} />
              </div>
              {allSigned ? (
                <Badge variant="emerald" className="mt-4 w-full justify-center py-2">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 合同已生效
                </Badge>
              ) : (
                <Badge variant="amber" className="mt-4 w-full justify-center py-2">
                  等待签署中
                </Badge>
              )}
            </Card>

            <Card className="space-y-2 p-5 text-xs text-ink-60">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 text-ink-40" />
                合同与订单状态同步存证，签署记录来自平台订单数据。
              </div>
            </Card>
          </aside>
        </div>
      </div>

      <ContractSignDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        partyLabel={canDesignerSign ? "乙方(设计师)" : "甲方(委托人)"}
        signerName={
          canDesignerSign
            ? designer?.name ?? "设计师"
            : client?.name ?? "委托人"
        }
        onConfirm={handleSaveHandwriting}
      />
    </div>
  );
}

function ContractServiceContent({
  order,
  revealContactPhone,
}: {
  order: Order;
  revealContactPhone: boolean;
}) {
  const parsed = parseRegularEntrustDescription(order.description ?? "");
  const visibleRaw = revealContactPhone
    ? order.description
    : maskPhonesInText(order.description || "");
  const contactPhone = resolveVisiblePhone(
    parsed.contact?.contactPhone,
    revealContactPhone,
  );

  const meta = (
    <>
      <Row label="项目类型">{order.projectType || "—"}</Row>
      <Row label={orderExpectedDateLabel(order)}>
        {formatOptionalDate(order.expectedDeliveryAt)}
      </Row>
    </>
  );

  if (!parsed.structured) {
    return (
      <>
        <p className="font-medium text-ink">{order.title}</p>
        {visibleRaw ? (
          <p className="whitespace-pre-wrap text-ink-80">{visibleRaw}</p>
        ) : null}
        {meta}
      </>
    );
  }

  const contactPairs = parsed.contact
    ? (
        [
          ["委托方", parsed.contact.committerName],
          ["联系人", parsed.contact.contactName],
          ["电话", contactPhone?.display],
          ["项目城市", parsed.contact.projectCity],
        ] as const
      ).filter(([, value]) => Boolean(value))
    : [];

  const remark = parsed.brief
    ? revealContactPhone
      ? parsed.brief
      : maskPhonesInText(parsed.brief)
    : "";

  return (
    <div className="space-y-4">
      <p className="font-medium text-ink">{order.title}</p>
      {meta}

      {contactPairs.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-medium tracking-wide text-ink-40">
            委托联系信息
          </div>
          {contactPairs.map(([label, value]) => (
            <Row key={label} label={label}>
              {label === "电话" && contactPhone?.href ? (
                <a href={contactPhone.href} className="hover:text-brand">
                  {value}
                </a>
              ) : (
                value
              )}
            </Row>
          ))}
        </div>
      ) : null}

      {parsed.billing ? (
        <div className="space-y-2">
          <div className="text-xs font-medium tracking-wide text-ink-40">
            计费摘要
          </div>
          <Row label="计费方式">
            {labelEntrustBillingMode(parsed.billing.billingModeRaw)}
          </Row>
          {parsed.billing.detailLines.length > 0 ? (
            <div className="space-y-2">
              {parsed.billing.detailLines.map((line) => {
                const sep = line.indexOf("：");
                if (sep < 0) {
                  return (
                    <p key={line} className="text-ink">
                      {line}
                    </p>
                  );
                }
                return (
                  <Row key={line} label={line.slice(0, sep)}>
                    {line.slice(sep + 1)}
                  </Row>
                );
              })}
            </div>
          ) : null}
          {parsed.billing.valueAdded.length > 0 ? (
            <Row label="增值服务">{parsed.billing.valueAdded.join("、")}</Row>
          ) : null}
        </div>
      ) : null}

      {remark ? (
        <div className="space-y-2">
          <div className="text-xs font-medium tracking-wide text-ink-40">
            项目备注
          </div>
          <p className="whitespace-pre-wrap text-ink">{remark}</p>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-ink">{title}</h3>
      <div className="space-y-2 text-ink-80">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3">
      <span className="text-ink-60">{label}:</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

function PaymentRow({
  stage,
  amount,
  condition,
}: {
  stage: string;
  amount: number;
  condition?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-20 bg-ink-20/20 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{stage}</span>
        <span className="shrink-0 text-sm font-semibold text-ink">
          {formatCurrency(amount)}
        </span>
      </div>
      {condition ? (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-60">{condition}</p>
      ) : null}
    </div>
  );
}

function SignatureBlock({
  party,
  name,
  signed,
  signatureImage,
  draftPending,
  onSign,
}: {
  party: string;
  name: string;
  signed: boolean;
  signatureImage?: string;
  draftPending?: boolean;
  onSign?: () => void;
}) {
  return (
    <div className="rounded-xl border border-ink-20 p-5">
      <div className="text-xs uppercase tracking-wider text-ink-40">{party}</div>
      <div className="mt-2 text-base font-semibold text-ink">{name}</div>
      {signed ? (
        <div className="mt-4 space-y-3">
          {signatureImage ? (
            <img
              src={signatureImage}
              alt={`${name}的电子签名`}
              className="h-16 w-full rounded-lg border border-ink-20 bg-white object-contain"
            />
          ) : null}
          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> 已电子签署
          </div>
        </div>
      ) : onSign ? (
        <div className="mt-4 space-y-3">
          {signatureImage ? (
            <img
              src={signatureImage}
              alt={`${name}的手写签名预览`}
              className="h-16 w-full rounded-lg border border-ink-20 bg-white object-contain"
            />
          ) : null}
          {draftPending ? (
            <div className="text-xs text-ink-60">手写已确认，请再点下方「完成签署」。</div>
          ) : null}
          <Button variant="brand" size="sm" onClick={onSign}>
            {draftPending ? "重写签名" : "手写签署"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 text-xs text-ink-40">待签署</div>
      )}
    </div>
  );
}

function SignStatus({ party, signed }: { party: string; signed: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-20 px-3 py-2 text-xs">
      <span className="text-ink-60">{party}</span>
      {signed ? (
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> 已签
        </span>
      ) : (
        <span className="text-ink-40">未签</span>
      )}
    </div>
  );
}
