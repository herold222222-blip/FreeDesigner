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
  sandboxConfirmRequest,
  type PayIntentDTO,
} from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Loader2, ShieldCheck } from "lucide-react";

const PROVIDER_LABEL: Record<PayIntentDTO["provider"], string> = {
  sandbox: "沙箱支付（演示）",
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
  onPaid,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: string;
  stageId: string;
  stageName: string;
  amount: number;
  onPaid: () => void;
}) {
  const [intent, setIntent] = useState<PayIntentDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 打开时发起支付意图
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
        if (i.status === "paid") {
          onPaid();
          onOpenChange(false);
        }
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
    // 仅在打开/目标阶段变化时重新发起
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId, stageId]);

  // 待支付时轮询状态（真实渠道扫码后自动到账）
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

  const handleSandboxConfirm = async () => {
    if (!intent) return;
    setConfirming(true);
    try {
      await sandboxConfirmRequest(intent.paymentId);
      onPaid();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "确认失败");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            支付 · {stageName}
          </DialogTitle>
          <DialogDescription>
            {intent ? PROVIDER_LABEL[intent.provider] : "正在发起支付"} ·
            金额 {formatCurrency(amount)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {loading && (
            <div className="flex items-center gap-2 py-8 text-ink-60">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在生成支付订单...
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {intent?.qrCodeContent && (
            <>
              <div className="rounded-2xl border border-ink-20 bg-white p-4">
                <QRCodeSVG value={intent.qrCodeContent} size={196} />
              </div>
              <p className="text-center text-xs text-ink-60">
                {intent.provider === "wechat"
                  ? "请使用微信扫一扫完成支付，支付后自动到账平台托管。"
                  : intent.provider === "alipay"
                    ? "请使用支付宝扫一扫完成支付，支付后自动到账平台托管。"
                    : "沙箱演示二维码：点击下方按钮模拟支付成功。"}
              </p>
            </>
          )}

          {intent?.redirectUrl && (
            <Button asChild variant="brand">
              <a href={intent.redirectUrl} target="_blank" rel="noreferrer">
                前往支付页面
              </a>
            </Button>
          )}

          {intent && !intent.sandbox && (
            <div className="flex items-center gap-1.5 text-xs text-ink-40">
              <ShieldCheck className="h-3.5 w-3.5" /> 支付完成后本弹窗会自动关闭
            </div>
          )}

          {intent?.sandbox && intent.status !== "paid" && (
            <Button
              variant="brand"
              className="w-full"
              disabled={confirming}
              onClick={handleSandboxConfirm}
            >
              {confirming ? "处理中..." : "模拟支付成功（沙箱）"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
