"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  getMissingPortfolioProjectTypes,
  getRequiredProjectTypes,
  portfolioReadinessHint,
} from "@/lib/designer-portfolio-readiness";
import type { Designer } from "@/lib/types";
import { ImagePlus } from "lucide-react";

export function DesignerPortfolioPromptDialog({
  designer,
}: {
  designer: Designer | null;
}) {
  const [open, setOpen] = useState(false);

  const needsUpload = designer ? !designerCanAcceptOrders(designer) : false;
  const required = designer ? getRequiredProjectTypes(designer) : [];
  const missing = designer ? getMissingPortfolioProjectTypes(designer) : [];
  const hint = designer ? portfolioReadinessHint(designer) : "";

  useEffect(() => {
    setOpen(needsUpload);
  }, [needsUpload]);

  if (!designer || !needsUpload) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                上传对应案例，平台核验并公开展示后，方可开启在线接单与匹配平台项目。
              </p>
              {required.length > 0 ? (
                <div className="rounded-xl bg-ink-20/30 p-3">
                  <div className="text-xs font-medium text-ink">
                    需覆盖的项目类型
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {required.map((t) => (
                      <Badge
                        key={t}
                        variant={missing.includes(t) ? "amber" : "emerald"}
                        className="text-[10px]"
                      >
                        {t}
                        {missing.includes(t) ? " · 待上传" : ""}
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
            稍后处理
          </Button>
          <Button asChild variant="brand">
            <Link href="/designer/portfolio">去上传作品</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
