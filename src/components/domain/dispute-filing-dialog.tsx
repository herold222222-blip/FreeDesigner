"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createDisputeRequest } from "@/lib/api-client";
import type { Order } from "@/lib/types";

const DISPUTE_TYPES = [
  "成果质量异议",
  "付款延迟",
  "返修响应慢",
  "沟通纠纷",
  "其他",
] as const;

export function DisputeFilingDialog({
  open,
  onOpenChange,
  order,
  onFiled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: Order;
  onFiled?: () => void;
}) {
  const [type, setType] = useState<string>(DISPUTE_TYPES[0]);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await createDisputeRequest({
        orderId: order.id,
        type,
        description,
      });
      onFiled?.();
      onOpenChange(false);
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>申请平台介入</DialogTitle>
          <DialogDescription>
            订单 {order.code} · 平台将依据沟通记录、阶段成果与付款记录介入调解。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>纠纷类型</Label>
            <select
              className="mt-1.5 w-full rounded-lg border border-ink-20 bg-paper px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {DISPUTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>争议描述</Label>
            <textarea
              className="mt-1.5 min-h-[120px] w-full rounded-lg border border-ink-20 bg-paper px-3 py-2 text-sm"
              placeholder="请客观描述争议经过与诉求…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="brand" disabled={saving || !description.trim()} onClick={submit}>
            {saving ? "提交中…" : "提交申请"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
