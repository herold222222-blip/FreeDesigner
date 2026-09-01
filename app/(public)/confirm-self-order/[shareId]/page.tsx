"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  confirmSelfOrderByShareRequest,
  fetchSelfOrderShareRequest,
} from "@/lib/api-client";
import type { SelfOrderShareView } from "@/lib/self-order-share";
import { SPECIALTIES } from "@/lib/constants";
import { labelEntrustBillingMode } from "@/lib/entrust-description";
import { formatCurrency, formatOptionalDate } from "@/lib/utils";
import { useRoleStore } from "@/store/role-store";
import { Check, Loader2, ShieldCheck } from "lucide-react";

function billingLabel(mode: string) {
  if (mode === "daily") return "按工时";
  if (mode === "monthly") return "按月雇佣";
  if (mode === "area") return "按面积";
  return labelEntrustBillingMode(mode);
}

function specialtyLabel(value?: string) {
  return SPECIALTIES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export default function ConfirmSelfOrderPage({
  params,
}: {
  params: { shareId: string };
}) {
  const router = useRouter();
  const role = useRoleStore((s) => s.role);
  const [view, setView] = useState<SelfOrderShareView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSelfOrderShareRequest(params.shareId)
      .then((payload) => {
        if (active) setView(payload);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "链接无效");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [params.shareId]);

  const handleConfirm = async () => {
    if (!/^\d{4}$/.test(code.trim()) || submitting) return;
    if (role !== "client") {
      router.push(
        `/login?redirect=${encodeURIComponent(`/confirm-self-order/${params.shareId}`)}`,
      );
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const next = await confirmSelfOrderByShareRequest(
        params.shareId,
        code.trim(),
      );
      setView(next);
      if (next.order.id) {
        router.push(`/client/directed-orders`);
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "确认失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-ink-60">
        <Loader2 className="h-5 w-5 animate-spin" />
        正在加载订单确认页...
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] py-20 text-center text-ink-60">
        {error ?? "确认链接不存在或已失效"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="container-page max-w-xl py-10">
        <div className="mb-6">
          <Badge variant="muted">设计师发起 · 请确认订单</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            {view.order.title}
          </h1>
          <p className="mt-1 text-sm text-ink-60">项目 {view.order.code}</p>
        </div>

        <Card className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {view.designer.avatar ? (
                <AvatarImage src={view.designer.avatar} alt={view.designer.name} />
              ) : null}
              <AvatarFallback>{view.designer.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-sm font-medium text-ink">{view.designer.name}</div>
              <div className="text-xs text-ink-60">接单设计师</div>
            </div>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-40">专业</dt>
              <dd className="mt-0.5 text-ink">{specialtyLabel(view.order.specialty)}</dd>
            </div>
            <div>
              <dt className="text-ink-40">项目类型</dt>
              <dd className="mt-0.5 text-ink">{view.order.projectType || "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-40">计费方式</dt>
              <dd className="mt-0.5 text-ink">{billingLabel(view.order.billingMode)}</dd>
            </div>
            <div>
              <dt className="text-ink-40">服务方式</dt>
              <dd className="mt-0.5 text-ink">
                {view.order.serviceMode === "onsite" ? "线下上门" : "线上远程"}
              </dd>
            </div>
            <div>
              <dt className="text-ink-40">预期交付</dt>
              <dd className="mt-0.5 text-ink">
                {formatOptionalDate(view.order.expectedDeliveryAt)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-40">订单金额</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
                {formatCurrency(view.order.totalAmount)}
              </dd>
            </div>
          </dl>

          {view.order.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-60">
              {view.order.description}
            </p>
          ) : null}

          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
              付款阶段
            </div>
            <ul className="mt-2 space-y-2">
              {view.stages.map((stage, i) => (
                <li
                  key={`${stage.name}-${i}`}
                  className="rounded-xl border border-ink-20 bg-ink-20/15 px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {i + 1}. {stage.name} · {Math.round((stage.ratio > 1 ? stage.ratio : stage.ratio * 100) || 0)}%
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-brand">
                      {formatCurrency(stage.amount)}
                    </span>
                  </div>
                  {stage.note ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-60">
                      {stage.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="mt-5 p-6">
          {view.confirmed || !view.canConfirm ? (
            <div className="flex items-start gap-3 text-emerald-800">
              <ShieldCheck className="mt-0.5 h-5 w-5" />
              <div>
                <div className="text-sm font-semibold">订单已确认</div>
                <p className="mt-1 text-xs text-emerald-700">
                  双方可进入电子合同签署。
                </p>
                <Button asChild variant="brand" className="mt-4">
                  <Link href="/client/directed-orders">查看定向订单</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-ink">输入 4 位验证码确认</div>
                <p className="mt-1 text-xs text-ink-60">
                  {role === "client"
                    ? "确认后订单将绑定到您的委托人账号，随后双方签约。"
                    : "请先登录委托人账号，再输入设计师提供的验证码。"}
                </p>
              </div>
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder="4 位验证码"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="max-w-[160px] text-center text-lg tracking-[0.3em]"
              />
              {submitError ? (
                <p className="text-xs text-rose-600">{submitError}</p>
              ) : null}
              <Button
                variant="brand"
                disabled={code.length !== 4 || submitting}
                onClick={handleConfirm}
              >
                <Check className="h-4 w-4" />
                {submitting
                  ? "确认中..."
                  : role === "client"
                    ? "确认订单并进入签约"
                    : "登录后确认"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
