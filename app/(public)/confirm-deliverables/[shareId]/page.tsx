"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DeliverableHistorySections } from "@/components/domain/deliverable-file-list";
import {
  confirmDeliverablesByShareRequest,
  fetchDeliverablesConfirmShareRequest,
} from "@/lib/api-client";
import type { DeliverablesConfirmView } from "@/lib/deliverables-confirm-share";
import { labelEntrustBillingMode } from "@/lib/entrust-description";
import { SPECIALTIES } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatOptionalDate } from "@/lib/utils";
import { Check, FileBox, Loader2, ShieldCheck, Users } from "lucide-react";

function billingLabel(mode: string) {
  if (mode === "daily") return "按工时";
  if (mode === "monthly") return "按月雇佣";
  if (mode === "area") return "常规面积报价";
  return labelEntrustBillingMode(mode);
}

function specialtyLabel(value?: string) {
  return SPECIALTIES.find((s) => s.value === value)?.label ?? value ?? "—";
}

export default function ConfirmDeliverablesPage({
  params,
}: {
  params: { shareId: string };
}) {
  const [view, setView] = useState<DeliverablesConfirmView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDeliverablesConfirmShareRequest(params.shareId)
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
    setSubmitting(true);
    setSubmitError(null);
    try {
      const next = await confirmDeliverablesByShareRequest(
        params.shareId,
        code.trim(),
      );
      setView(next);
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
        正在加载成果确认页...
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
      <div className="container-page max-w-3xl py-10">
        <div className="mb-6">
          <Badge variant="muted">转发设计成果</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
            {view.order.title}
          </h1>
          <p className="mt-1 text-sm text-ink-60">
            项目 {view.order.code} · {view.stage.name}
          </p>
        </div>

        <Card className="space-y-5 p-6">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
              项目基本信息
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
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
              <div>
                <dt className="text-ink-40">服务方式</dt>
                <dd className="mt-0.5 text-ink">
                  {view.order.serviceMode === "onsite" ? "线下上门" : "纯线上"}
                </dd>
              </div>
              <div>
                <dt className="text-ink-40">预期交付</dt>
                <dd className="mt-0.5 text-ink">
                  {formatOptionalDate(view.order.expectedDeliveryAt)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-40">本阶段金额</dt>
                <dd className="mt-0.5 font-medium text-ink">
                  {formatCurrency(view.stage.amount)} ·{" "}
                  {Math.round(view.stage.ratio * 100)}%
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-40">
              <Users className="h-3.5 w-3.5" />
              服务设计师
            </div>
            <div className="space-y-2">
              {view.people.map((person) => (
                <div
                  key={`${person.roleLabel}-${person.id}`}
                  className="flex items-center gap-3 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2.5"
                >
                  <Avatar className="h-9 w-9">
                    {person.avatar ? (
                      <AvatarImage src={person.avatar} alt={person.name} />
                    ) : null}
                    <AvatarFallback>{person.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">
                      {person.name}
                    </div>
                    <div className="text-xs text-ink-60">
                      {person.roleLabel} · {person.trackLabel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-40">
              <FileBox className="h-3.5 w-3.5" />
              本阶段成果
            </div>
            {view.files.length > 0 ? (
              <DeliverableHistorySections
                files={view.files}
                unlocked
              />
            ) : (
              <p className="text-sm text-ink-40">暂无成果文件</p>
            )}
          </div>
        </Card>

        <Card className="mt-5 p-6">
          {view.confirmed ? (
            <div className="flex items-start gap-3 text-emerald-800">
              <ShieldCheck className="mt-0.5 h-5 w-5" />
              <div>
                <div className="text-sm font-semibold">最终成果已确认</div>
                <p className="mt-1 text-xs text-emerald-700">
                  确认时间{" "}
                  {view.confirmedAt ? formatDateTime(view.confirmedAt) : "—"}
                  。委托人可继续支付本阶段费用。
                </p>
              </div>
            </div>
          ) : !view.canConfirm ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-ink">
                {view.files.length > 0
                  ? "可查看本阶段全部成果"
                  : view.phase === "preliminary"
                    ? "等待设计师上传初步成果"
                    : "等待设计师上传最终成果 / 确认单"}
              </div>
              {view.preliminaryConfirmedAt ? (
                <p className="text-xs text-ink-60">
                  初步成果已于 {formatDateTime(view.preliminaryConfirmedAt)} 确认。
                </p>
              ) : view.preliminarySkipped ? (
                <p className="text-xs text-ink-60">设计师已跳过初步成果。</p>
              ) : (
                <p className="text-xs text-ink-60">
                  {view.files.length > 0
                    ? "上方已按初步、最终、返修分类列出全部成果，可预览或下载。"
                    : "当前步骤尚无可确认文件，确认按钮将在设计师上传后开放。"}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {view.preliminaryConfirmedAt ? (
                <p className="text-xs text-ink-60">
                  初步成果已于 {formatDateTime(view.preliminaryConfirmedAt)} 确认。
                </p>
              ) : null}
              <div>
                <div className="text-sm font-semibold text-ink">{view.confirmLabel}</div>
                <p className="mt-1 text-xs text-ink-60">
                  请向委托人索取 4 位验证码，输入后再点击确认。确认后即视为认可本步骤成果。
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
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
                </div>
                <Button
                  variant="brand"
                  disabled={code.length !== 4 || submitting}
                  onClick={handleConfirm}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {view.confirmLabel}
                </Button>
              </div>
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
