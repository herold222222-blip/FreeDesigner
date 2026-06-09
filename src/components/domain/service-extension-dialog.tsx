"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import type { Order } from "@/lib/types";
import {
  computeExtensionAmount,
  computeExtendedEndDaily,
  computeExtendedEndMonthly,
  formatServiceExtensionDeadline,
  getEffectiveServiceEnd,
  getExtensionRule,
  type ServiceExtensionRecord,
} from "@/lib/time-billing";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CalendarPlus } from "lucide-react";

export function ServiceExtensionDialog({
  open,
  onOpenChange,
  order,
  extensions,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  extensions: ServiceExtensionRecord[];
  onSubmit: (record: ServiceExtensionRecord) => void;
}) {
  const isMonthly = order.billingMode === "monthly";
  const [units, setUnits] = useState("1");

  const serviceEnd = getEffectiveServiceEnd(order, extensions);
  const deadline = formatServiceExtensionDeadline(order, extensions);

  const parsedUnits = Math.max(1, Math.floor(Number(units) || 0));
  const amount = useMemo(
    () =>
      computeExtensionAmount(
        order,
        parsedUnits,
        isMonthly ? "month" : "halfDay",
      ),
    [order, parsedUnits, isMonthly],
  );

  const newEnd = useMemo(() => {
    if (!serviceEnd) return null;
    return isMonthly
      ? computeExtendedEndMonthly(serviceEnd, parsedUnits)
      : computeExtendedEndDaily(serviceEnd, parsedUnits);
  }, [serviceEnd, parsedUnits, isMonthly]);

  useEffect(() => {
    if (open) setUnits("1");
  }, [open]);

  const handleSubmit = () => {
    if (!serviceEnd || !newEnd || parsedUnits < 1) return;
    onSubmit({
      id: `ext_${Date.now().toString(36)}`,
      units: parsedUnits,
      unitType: isMonthly ? "month" : "halfDay",
      amount,
      requestedAt: new Date().toISOString(),
      extendedEndAt: newEnd,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-brand" />
            延长服务
          </DialogTitle>
          <DialogDescription>{getExtensionRule(order)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {serviceEnd ? (
            <div className="rounded-xl border border-ink-20 bg-ink-20/10 px-4 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-ink-60">当前服务结束日</span>
                <span className="font-medium text-ink">
                  {formatDate(serviceEnd)}
                </span>
              </div>
              {deadline ? (
                <div className="mt-2 flex justify-between gap-2 text-xs">
                  <span className="text-ink-60">本次申请截止</span>
                  <span className="text-amber-700">{deadline}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <Label htmlFor="extension-units">
              {isMonthly ? "延长月数" : "延长半天数"}
            </Label>
            <Input
              id="extension-units"
              type="number"
              min={1}
              step={1}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              className="mt-2"
              placeholder={isMonthly ? "例如 1" : "例如 2（即 1 工日）"}
            />
            <p className="mt-1.5 text-xs text-ink-60">
              {isMonthly
                ? "以月为计费单元，设计师确认后按预付规则支付延长费用。"
                : "以半天为计费单元，设计师确认后于服务完成时补付延长费用。"}
            </p>
          </div>

          {newEnd ? (
            <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-60">延长后服务结束日</span>
                <span className="font-medium text-ink">
                  {formatDate(newEnd)}
                </span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-ink-60">预估延长费用</span>
                <span className="font-semibold text-ink">
                  {formatCurrency(amount)}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="brand" onClick={handleSubmit} disabled={parsedUnits < 1}>
            提交延长申请
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
