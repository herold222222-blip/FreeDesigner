"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Order, PaymentStage } from "@/lib/types";
import { buildStagePaymentPageUrl } from "@/lib/payment-link";
import { formatCurrency } from "@/lib/utils";
import { Check, Copy, Share2 } from "lucide-react";

export function ForwardPaymentLinkDialog({
  open,
  onOpenChange,
  order,
  stage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  stage: PaymentStage;
}) {
  const [paymentUrl, setPaymentUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    setPaymentUrl(buildStagePaymentPageUrl(order, stage));
  }, [open, order, stage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 降级：用户可手动选中复制 */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            转发支付链接
          </DialogTitle>
          <DialogDescription>
            {order.code} · {stage.name} · {formatCurrency(stage.amount)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {paymentUrl ? (
            <div className="rounded-2xl border border-ink-20 bg-white p-4">
              <QRCodeSVG value={paymentUrl} size={180} />
            </div>
          ) : null}
          <p className="text-center text-xs leading-relaxed text-ink-60">
            将下方链接或二维码转发给委托人，委托人微信 / 支付宝扫码即可支付。
            款项将进入平台托管。
          </p>
          <div className="flex w-full gap-2">
            <Input readOnly value={paymentUrl} className="text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label="复制支付链接"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button variant="brand" onClick={handleCopy}>
            {copied ? "已复制" : "复制链接"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
