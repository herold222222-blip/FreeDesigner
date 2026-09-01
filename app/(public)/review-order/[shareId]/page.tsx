"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OrderReviewForm } from "@/components/domain/order-review-dialog";
import {
  fetchOrderReviewShareRequest,
  submitOrderReviewByShareRequest,
} from "@/lib/api-client";
import type { OrderReviewShareView } from "@/lib/review-share";
import { SPECIALTIES } from "@/lib/constants";
import { labelEntrustBillingMode } from "@/lib/entrust-description";
import { Loader2, ShieldCheck, Star } from "lucide-react";

function billingLabel(mode: string) {
  if (mode === "daily") return "按工时";
  if (mode === "monthly") return "按月雇佣";
  if (mode === "area") return "常规面积报价";
  return labelEntrustBillingMode(mode);
}

function specialtyLabel(value?: string) {
  return SPECIALTIES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export default function ReviewOrderSharePage({
  params,
}: {
  params: { shareId: string };
}) {
  const [view, setView] = useState<OrderReviewShareView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchOrderReviewShareRequest(params.shareId)
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-ink-60">
        <Loader2 className="h-5 w-5 animate-spin" />
        正在加载评价页...
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] py-20 text-center text-ink-60">
        {error ?? "评价链接不存在或已失效"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="container-page max-w-xl py-10">
        <div className="mb-6">
          <Badge variant="muted">转发项目评价</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            {view.order.title}
          </h1>
          <p className="mt-1 text-sm text-ink-60">项目 {view.order.code}</p>
        </div>

        <Card className="space-y-5 p-6">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-40">专业</dt>
              <dd className="mt-0.5 text-ink">
                {specialtyLabel(view.order.specialty)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-40">项目类型</dt>
              <dd className="mt-0.5 text-ink">
                {view.order.projectType || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-ink-40">计费方式</dt>
              <dd className="mt-0.5 text-ink">
                {billingLabel(view.order.billingMode)}
              </dd>
            </div>
          </dl>

          <div className="flex items-center gap-3 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2.5">
            <Avatar className="h-9 w-9">
              {view.designer.avatar ? (
                <AvatarImage
                  src={view.designer.avatar}
                  alt={view.designer.name}
                />
              ) : null}
              <AvatarFallback>{view.designer.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">
                {view.designer.name}
              </div>
              <div className="text-xs text-ink-60">本项目设计师</div>
            </div>
          </div>
        </Card>

        <Card className="mt-5 p-6">
          {view.submitted ? (
            <div className="flex items-start gap-3 text-emerald-800">
              <ShieldCheck className="mt-0.5 h-5 w-5" />
              <div>
                <div className="text-sm font-semibold">评价已提交</div>
                <p className="mt-1 text-xs text-emerald-700">
                  感谢反馈。设计师主页将展示本项目评价。
                </p>
              </div>
            </div>
          ) : view.closed || !view.canSubmit ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Star className="h-4 w-4 text-ink-40" />
                评价已关闭
              </div>
              <p className="text-xs text-ink-60">
                {view.deadlineHint ?? "本项目评价窗口已结束。"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <OrderReviewForm
                designerName={view.designer.name}
                deadlineHint={view.deadlineHint}
                busy={submitting}
                extra={
                  <div>
                    <label className="text-[11px] text-ink-40">验证码</label>
                    <Input
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="4 位数字"
                      className="mt-1 w-32 font-mono tracking-[0.35em]"
                    />
                    <p className="mt-1 text-[11px] text-ink-40">
                      请向委托人索取 4 位验证码后再提交。
                    </p>
                  </div>
                }
                onSubmit={async (payload) => {
                  if (!/^\d{4}$/.test(code.trim())) {
                    setSubmitError("请输入 4 位验证码");
                    return;
                  }
                  setSubmitting(true);
                  setSubmitError(null);
                  try {
                    const next = await submitOrderReviewByShareRequest(
                      params.shareId,
                      { code: code.trim(), ...payload },
                    );
                    setView(next);
                  } catch (e) {
                    setSubmitError(
                      e instanceof Error ? e.message : "提交失败",
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }}
              />
              {submitError ? (
                <p className="text-xs text-rose-600">{submitError}</p>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
