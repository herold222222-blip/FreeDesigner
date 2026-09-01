"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildScanOrderPath, getScanOrderUrl } from "@/lib/scan-order";
import { Copy, QrCode, Share2 } from "lucide-react";
import { useSessionStore } from "@/store/session-store";

export function ScanOrderQrDialog({
  designerId,
  designerName,
  triggerClassName,
  triggerVariant = "outline",
  triggerLabel = "扫我下单",
  triggerSize = "lg",
  showEnterOrder = true,
}: {
  designerId: string;
  designerName: string;
  triggerClassName?: string;
  triggerVariant?: "outline" | "brand";
  triggerLabel?: string;
  triggerSize?: "default" | "sm" | "lg";
  /** 设计师工作台分享时可不展示「进入下单」，避免与「自己下单」重复 */
  showEnterOrder?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const push = useSessionStore((s) => s.pushNotification);

  const scanPath = buildScanOrderPath(designerId);
  const scanUrl = useMemo(() => {
    if (typeof window === "undefined") return scanPath;
    return getScanOrderUrl(designerId);
  }, [designerId, scanPath]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(scanUrl);
      push({
        title: "链接已复制",
        description: "可发送给委托人，对方打开链接即可填写项目需求。",
        variant: "success",
      });
    } catch {
      push({ title: "复制失败", description: scanUrl, variant: "destructive" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !showEnterOrder) void copyLink();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName ?? "mt-2 w-full"}>
          <QrCode className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>扫我下单 · {designerName}</DialogTitle>
          <DialogDescription>
            将二维码保存或转发给委托人。对方打开链接后按面积填写项目需求；你确认费用与付款阶段后发给委托人，对方确认即可进入签约。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="rounded-2xl border border-ink-20 bg-white p-4 shadow-sm">
            <QRCodeSVG
              value={scanUrl}
              size={220}
              level="M"
              includeMargin
              className="rounded-lg"
            />
          </div>
          <p className="max-w-full break-all text-center text-[11px] leading-relaxed text-ink-50">
            {scanUrl}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {showEnterOrder ? (
            <Button variant="brand" className="flex-1" asChild>
              <Link href={scanPath} onClick={() => setOpen(false)}>
                <Share2 className="h-4 w-4" /> 进入下单
              </Link>
            </Button>
          ) : null}
          <Button
            variant={showEnterOrder ? "outline" : "brand"}
            className="flex-1"
            onClick={copyLink}
          >
            <Copy className="h-4 w-4" /> 复制链接
          </Button>
        </div>

        <p className="text-center text-[11px] text-ink-40">
          按面积填写需求 · 设计师报价与付款阶段 · 委托人确认后签约开工
        </p>
      </DialogContent>
    </Dialog>
  );
}
