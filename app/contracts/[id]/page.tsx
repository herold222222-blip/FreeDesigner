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
  fetchContractViewRequest,
  type ContractViewPayload,
} from "@/lib/api-client";
import { useRoleStore } from "@/store/role-store";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ContractPage({ params }: { params: { id: string } }) {
  const role = useRoleStore((s) => s.role);
  const [data, setData] = useState<ContractViewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] py-20 text-center text-ink-60">
        正在加载合同...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] py-20 text-center">
        <p className="text-ink-60">{error ?? "合同不存在"}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/client/orders">返回订单</Link>
        </Button>
      </div>
    );
  }

  const { order, client, designer } = data;
  const signedByClient = order.clientSignedContract === true;
  const signedByDesigner = order.designerSignedContract === true;
  const allSigned = signedByClient && signedByDesigner;
  const orderHref =
    role === "designer"
      ? `/designer/orders/${order.id}`
      : `/client/orders/${order.id}`;

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
                合同编号 · {params.id} · 项目 {order.code}
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
                <p className="font-medium text-ink">{order.title}</p>
                <p className="mt-2 text-ink-80">{order.description}</p>
                <Row label="项目类型">{order.projectType}</Row>
                <Row label="预期交付">{formatDate(order.expectedDeliveryAt)}</Row>
              </Section>

              <Section title="三、服务费用与付款节点">
                <Row label="合同总价款">
                  {formatCurrency(order.totalAmount)}（含税）
                </Row>
                <Row label="平台手续费率">
                  {Math.round((order.feeRate ?? 0.08) * 100)}%（由乙方承担）
                </Row>
                <div className="mt-3 grid gap-2">
                  {order.stages.map((s) => (
                    <PaymentRow
                      key={s.id}
                      stage={`${s.name} · ${Math.round(s.ratio * 100)}%`}
                      amount={s.amount}
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
                />
                <SignatureBlock
                  party="乙方(设计师)"
                  name={designer?.name ?? "设计师"}
                  signed={signedByDesigner}
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
                  尚未完成双方签署。请前往
                  <Link href={orderHref} className="mx-1 font-medium underline">
                    订单详情
                  </Link>
                  完成电子签约与预付款。
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

function PaymentRow({ stage, amount }: { stage: string; amount: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-20 bg-ink-20/20 px-4 py-2.5">
      <span className="text-sm">{stage}</span>
      <span className="text-sm font-semibold text-ink">{formatCurrency(amount)}</span>
    </div>
  );
}

function SignatureBlock({
  party,
  name,
  signed,
}: {
  party: string;
  name: string;
  signed: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink-20 p-5">
      <div className="text-xs uppercase tracking-wider text-ink-40">{party}</div>
      <div className="mt-2 text-base font-semibold text-ink">{name}</div>
      {signed ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> 已电子签署
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
