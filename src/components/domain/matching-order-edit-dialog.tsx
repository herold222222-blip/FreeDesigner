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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProjectTypes } from "@/lib/constants";
import type { Order, ServiceMode } from "@/lib/types";

export type MatchingOrderEditPayload = {
  title: string;
  description: string;
  projectType: string;
  totalAmount: number;
  expectedDeliveryAt: string;
  serviceMode: ServiceMode;
  withAuditService: boolean;
  withProjectManagement: boolean;
  projectAreaSqm?: number;
};

export function MatchingOrderEditDialog({
  open,
  onOpenChange,
  order,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSave: (payload: MatchingOrderEditPayload) => void;
  saving?: boolean;
}) {
  const [title, setTitle] = useState(order.title);
  const [description, setDescription] = useState(order.description);
  const [projectType, setProjectType] = useState(order.projectType);
  const [totalAmount, setTotalAmount] = useState(String(order.totalAmount));
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState(
    order.expectedDeliveryAt?.slice(0, 10) ?? "",
  );
  const [serviceMode, setServiceMode] = useState<ServiceMode>(order.serviceMode);
  const [withAudit, setWithAudit] = useState(!!order.withAuditService);
  const [withPM, setWithPM] = useState(!!order.withProjectManagement);
  const [area, setArea] = useState(
    order.projectAreaSqm != null ? String(order.projectAreaSqm) : "",
  );

  const projectTypes = useMemo(
    () => getProjectTypes(order.specialty),
    [order.specialty],
  );

  useEffect(() => {
    if (!open) return;
    setTitle(order.title);
    setDescription(order.description);
    setProjectType(order.projectType);
    setTotalAmount(String(order.totalAmount));
    setExpectedDeliveryAt(order.expectedDeliveryAt?.slice(0, 10) ?? "");
    setServiceMode(order.serviceMode);
    setWithAudit(!!order.withAuditService);
    setWithPM(!!order.withProjectManagement);
    setArea(order.projectAreaSqm != null ? String(order.projectAreaSqm) : "");
  }, [open, order]);

  const canSubmit =
    !!title.trim() &&
    !!description.trim() &&
    !!projectType.trim() &&
    Math.round(Number(totalAmount)) > 0;

  const handleSubmit = () => {
    if (!canSubmit || saving) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      projectType: projectType.trim(),
      totalAmount: Math.round(Number(totalAmount)),
      expectedDeliveryAt,
      serviceMode,
      withAuditService: withAudit,
      withProjectManagement: withPM,
      projectAreaSqm:
        order.billingMode === "area" && Number(area) > 0
          ? Number(area)
          : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>修改委托信息</DialogTitle>
          <DialogDescription>
            订单处于「待匹配设计师」时可调整委托内容。保存后平台将按最新信息匹配设计师。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="match-order-title">项目标题</Label>
            <Input
              id="match-order-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="match-order-desc">委托说明</Label>
            <Textarea
              id="match-order-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="mt-2"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>项目类型</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="选择项目类型" />
                </SelectTrigger>
                <SelectContent>
                  {projectTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                  {projectType && !projectTypes.includes(projectType) ? (
                    <SelectItem value={projectType}>{projectType}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>服务模式</Label>
              <Select
                value={serviceMode}
                onValueChange={(v) => setServiceMode(v as ServiceMode)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">线上远程</SelectItem>
                  <SelectItem value="onsite">线下上门</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="match-order-budget">预算金额（元）</Label>
              <Input
                id="match-order-budget"
                type="number"
                min={1}
                step={100}
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="match-order-delivery">期望交付日期</Label>
              <Input
                id="match-order-delivery"
                type="date"
                value={expectedDeliveryAt}
                onChange={(e) => setExpectedDeliveryAt(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          {order.billingMode === "area" ? (
            <div>
              <Label htmlFor="match-order-area">项目面积（㎡）</Label>
              <Input
                id="match-order-area"
                type="number"
                min={1}
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="mt-2"
              />
            </div>
          ) : null}
          <div className="space-y-2 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-3">
            <div className="text-xs font-medium text-ink">增值服务</div>
            <label className="flex items-center gap-2 text-sm text-ink-60">
              <input
                type="checkbox"
                checked={withAudit}
                onChange={(e) => setWithAudit(e.target.checked)}
              />
              第三方审图
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-60">
              <input
                type="checkbox"
                checked={withPM}
                onChange={(e) => setWithPM(e.target.checked)}
              />
              项目管理
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            variant="brand"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
          >
            {saving ? "保存中..." : "保存修改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
