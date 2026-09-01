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
import { Check, Copy, Share2 } from "lucide-react";

export function ForwardDeliverablesConfirmDialog({
  open,
  onOpenChange,
  url,
  code,
  title,
  confirmLabel,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  code: string;
  title: string;
  confirmLabel?: string;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 用户可手动复制 */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            转发{confirmLabel ?? "设计成果"}
          </DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {url ? (
            <div className="rounded-2xl border border-ink-20 bg-white p-4">
              <QRCodeSVG value={url} size={180} />
            </div>
          ) : null}
          <p className="text-center text-xs leading-relaxed text-ink-60">
            {description ??
              (confirmLabel
                ? `将下方链接或二维码转发出去。对方打开后须输入验证码，再点击「${confirmLabel}」。`
                : "将下方链接或二维码转发出去。对方打开后可查看本阶段全部成果（初步、最终、返修）。验证码请一并转给对方，便于核对链接。")}
          </p>
          <div className="rounded-xl border border-ink-20 bg-ink-20/20 px-4 py-2 text-center">
            <div className="text-[11px] text-ink-40">验证码</div>
            <div className="mt-0.5 font-mono text-2xl font-semibold tracking-[0.35em] text-ink">
              {code}
            </div>
          </div>
          <div className="flex w-full gap-2">
            <Input readOnly value={url} className="text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCopy}
              aria-label="复制链接"
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
