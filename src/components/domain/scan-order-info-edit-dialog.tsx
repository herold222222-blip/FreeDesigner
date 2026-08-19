"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateMatchingOrderRequest } from "@/lib/api-client";
import { orderExpectedDateLabel } from "@/lib/order-lifecycle";
import type { Order } from "@/lib/types";
import { useSessionStore } from "@/store/session-store";

export function ScanOrderInfoEditDialog({
  open,
  onOpenChange,
  order,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onSaved: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const [title, setTitle] = useState(order.title);
  const [description, setDescription] = useState(order.description);
  const [projectType, setProjectType] = useState(order.projectType);
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState(
    order.expectedDeliveryAt?.slice(0, 10) ?? "",
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving || !title.trim()) return;
    setSaving(true);
    try {
      await updateMatchingOrderRequest(order.id, {
        title: title.trim(),
        description: description.trim(),
        projectType: projectType.trim(),
        expectedDeliveryAt: expectedDeliveryAt || undefined,
      });
      push({ title: "项目信息已更新", variant: "success" });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      push({
        title: "保存失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>修改项目信息</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="scan-edit-title">项目标题</Label>
            <Input
              id="scan-edit-title"
              className="mt-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="scan-edit-type">项目类型</Label>
            <Input
              id="scan-edit-type"
              className="mt-2"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="scan-edit-date">{orderExpectedDateLabel(order)}</Label>
            <Input
              id="scan-edit-date"
              type="date"
              className="mt-2"
              value={expectedDeliveryAt}
              onChange={(e) => setExpectedDeliveryAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="scan-edit-desc">项目说明</Label>
            <Textarea
              id="scan-edit-desc"
              className="mt-2 min-h-[160px] font-mono text-xs"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="brand" disabled={saving || !title.trim()} onClick={handleSave}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
