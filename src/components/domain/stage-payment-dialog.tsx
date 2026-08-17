"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  createPayIntentRequest,
  getPaymentRequest,
  payStageRequest,
  sandboxConfirmRequest,
  type PayIntentDTO,
} from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Loader2, ShieldCheck } from "lucide-react";
import type { StagePaymentDeadline } from "@/lib/order-payment-overdue";
import { PaymentDeadlineNote } from "@/components/domain/payment-deadline-note";

const PROVIDER_LABEL: Record<PayIntentDTO["provider"], string> = {
  sandbox: "扫码支付",
  wechat: "微信支付",
  alipay: "支付宝",
};

export function StagePaymentDialog({
  open,
  onOpenChange,
  orderId,
  stageId,
  stageName,
  amount,
  deadline,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  stageId: string;
  stageName: string;
  amount: number;
  deadline?: StagePaymentDeadline | null;
  onPaid: () => void;
}) {
  const [intent, setIntent] = useState<PayIntentDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setIntent(null);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    createPayIntentRequest(orderId, stageId)
      .then((i) => {
        if (!active) return;
        setIntent(i);
      })
      .catch((e) =>
        active ? setError(e instanceof Error ? e.message : "发起支付失败") : null,
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId, stageId]);

  useEffect(() => {
    if (!open || !intent || intent.status === "paid") return;
    pollRef.current = setInterval(async () => {
      try {
        const s = await getPaymentRequest(intent.paymentId);
        if (s.status === "paid") {
          onPaid();
          onOpenChange(false);
        }
      } catch {
        /* 轮询失败忽略，下次重试 */
      }
    }, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, intent]);

  const qrValue =
    intent?.qrCodeContent ||
    `lezyou-pay://${orderId}/${stageId}?amount=${Math.round(amount * 100)}`;
  const canManualConfirm = !intent || intent.sandbox || intent.status !== "paid";

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      if (intent?.sandbox && intent.status !== "paid") {
        await sandboxConfirmRequest(intent.paymentId);
      } else {
        await payStageRequest(orderId, stageId);
      }
      onPaid();
      onOpenChange(false);
    } catch (e) {
      try {
        await payStageRequest(orderId, stageId);
        onPaid();
        onOpenChange(false);
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : e instanceof Error ? e.message : "确认失败");
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>扫码支付 · {stageName}</DialogTitle>
          <DialogDescription>
            {intent ? PROVIDER_LABEL[intent.provider] : "正在生成收款码"} · 资金将进入平台托管
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="text-center">
            <div className="text-xs text-ink-40">应付金额</div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-ink">
              {formatCurrency(amount)}
            </div>
            {deadline ? (
              <div className="mt-2">
                <PaymentDeadlineNote deadline={deadline} />
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-ink-60">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在生成收款二维码...
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-ink-20 bg-white p-4">
                <QRCodeSVG value={qrValue} size={196} />
              </div>
              <p className="text-center text-xs leading-relaxed text-ink-60">
                请使用微信或支付宝扫一扫完成支付。
                支付系统尚未接入，扫码仅作示意，点击下方确认即可完成支付。
              </p>
            </>
          )}

          {error ? (
            <div className="w-full rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {intent?.redirectUrl ? (
            <Button asChild variant="outline" className="w-full">
              <a href={intent.redirectUrl} target="_blank" rel="noreferrer">
                前往支付页面
              </a>
            </Button>
          ) : null}

          {canManualConfirm && !loading ? (
            <Button
              variant="brand"
              className="w-full"
              disabled={confirming}
              onClick={handleConfirm}
            >
              {confirming ? "处理中..." : "确认支付"}
            </Button>
          ) : null}

          <div className="flex items-center gap-1.5 text-xs text-ink-40">
            <ShieldCheck className="h-3.5 w-3.5" /> 确认后款项进入平台托管，验收通过后解冻
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
