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
import { ArrowRight, Copy, QrCode, Share2 } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { useRoleStore } from "@/store/role-store";

export function ScanOrderQrDialog({
  designerId,
  designerName,
  triggerClassName,
}: {
  designerId: string;
  designerName: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const push = useSessionStore((s) => s.pushNotification);
  const role = useRoleStore((s) => s.role);
  const orderPath = buildScanOrderPath(designerId);

  const scanUrl = useMemo(() => {
    if (typeof window === "undefined") return buildScanOrderPath(designerId);
    return getScanOrderUrl(designerId);
  }, [designerId]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(scanUrl);
      push({
        title: "链接已复制",
        description: "可发送给委托人，对方扫码或打开链接即可下单。",
        variant: "success",
      });
    } catch {
      push({ title: "复制失败", description: scanUrl, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className={triggerClassName ?? "mt-2 w-full"}>
          <QrCode className="h-4 w-4" /> 扫我下单
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>扫我下单 · {designerName}</DialogTitle>
          <DialogDescription>
            将二维码保存或转发给委托人。对方使用微信扫一扫或平台内扫码，即可填写项目需求、
            设置付款阶段；你确认条件后生成电子合同，双方签约并预付后进入服务流程。
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

        {role === "client" ? (
          <div className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-3">
            <p className="text-center text-[11px] text-ink-60">
              演示模式：无需真机扫码，可直接模拟委托人扫码后的填写页
            </p>
            <Button asChild variant="brand" className="mt-3 w-full">
              <Link href={orderPath} onClick={() => setOpen(false)}>
                <ArrowRight className="h-4 w-4" /> 进入扫码下单页
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="brand" className="flex-1" onClick={copyLink}>
            <Copy className="h-4 w-4" /> 复制链接
          </Button>
          <Button variant="outline" className="flex-1" onClick={copyLink}>
            <Share2 className="h-4 w-4" /> 转发分享
          </Button>
        </div>

        <p className="text-center text-[11px] text-ink-40">
          支持按工时或总价报价 · 可自定义付款阶段 · 合同模板自动生成
        </p>
      </DialogContent>
    </Dialog>
  );
}
