"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  designerCanAcceptOrders,
  getAcceptableProjectTypes,
  portfolioReadinessHint,
} from "@/lib/designer-portfolio-readiness";
import type { Designer } from "@/lib/types";
import { ImagePlus } from "lucide-react";

const PORTFOLIO_PATH = "/designer/portfolio";

export function DesignerPortfolioPromptDialog({
  designer,
}: {
  designer: Designer | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const needsUpload = designer ? !designerCanAcceptOrders(designer) : false;
  const covered = designer ? getAcceptableProjectTypes(designer) : [];
  const hint = designer ? portfolioReadinessHint(designer) : "";

  useEffect(() => {
    if (!needsUpload) {
      setDismissed(false);
      setOpen(false);
      return;
    }
    if (dismissed) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [needsUpload, dismissed]);

  if (!designer || !needsUpload) return null;

  const dismiss = () => {
    setDismissed(true);
    setOpen(false);
  };

  const goUploadWorks = () => {
    dismiss();
    if (pathname !== PORTFOLIO_PATH) {
      router.push(PORTFOLIO_PATH);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
        else if (!dismissed) setOpen(true);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-brand" />
            上传项目案例后方可接单
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 pt-1 text-sm text-ink-60">
              <p>
                入驻审核已通过。请先在作品管理中按
                <span className="font-medium text-ink">项目类型</span>
                上传案例：上传后的类型将同步为擅长项目类型，并决定您可承接的订单类型。
              </p>
              {covered.length > 0 ? (
                <div className="rounded-xl bg-ink-20/30 p-3">
                  <div className="text-xs font-medium text-ink">
                    当前可接单项目类型
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {covered.map((t) => (
                      <Badge key={t} variant="emerald" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {hint ? <p className="text-xs text-ink-40">{hint}</p> : null}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={dismiss}>
            稍后处理
          </Button>
          <Button variant="brand" onClick={goUploadWorks}>
            去上传作品
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
