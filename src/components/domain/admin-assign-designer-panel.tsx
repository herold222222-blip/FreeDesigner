"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Designer, Order } from "@/lib/types";
import { assignDesignerToOrderRequest } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";

export function AdminAssignDesignerPanel({
  order,
  designers,
  onAssigned,
}: {
  order: Order;
  designers: Designer[];
  onAssigned: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const [designerId, setDesignerId] = useState("");
  const [totalAmount, setTotalAmount] = useState(
    String(order.totalAmount > 1 ? order.totalAmount : ""),
  );
  const [busy, setBusy] = useState(false);

  if (order.status !== "matching") return null;

  const candidates = designers.filter((d) => d.acceptingOrders !== false);

  const handleAssign = async () => {
    if (!designerId || busy) return;
    setBusy(true);
    try {
      const amount = Number(totalAmount);
      await assignDesignerToOrderRequest(
        order.id,
        designerId,
        amount > 0 ? amount : undefined,
      );
      push({
        title: "已委派设计师",
        description: "订单已进入待签约，双方将收到通知。",
        variant: "success",
      });
      onAssigned();
    } catch (e) {
      push({
        title: "委派失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 border-amber-200 bg-amber-50/60 p-5">
      <div>
        <div className="text-sm font-semibold text-amber-950">
          常规委托 · 待匹配设计师
        </div>
        <p className="mt-1 text-xs text-amber-900/80">
          确认费用后委派设计师，订单将进入双方签约流程。
          {order.totalAmount <= 1
            ? " 委托人尚未填写预算，请在此确认订单总额。"
            : ` 参考预算 ${formatCurrency(order.totalAmount)}。`}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>委派设计师</Label>
          <Select value={designerId} onValueChange={setDesignerId}>
            <SelectTrigger>
              <SelectValue placeholder="选择设计师" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} {d.code ? `· ${d.code}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>确认订单总额（元）</Label>
          <Input
            type="number"
            min={1}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="例如 50000"
          />
        </div>
      </div>
      <Button variant="brand" size="sm" disabled={!designerId || busy} onClick={handleAssign}>
        {busy ? "委派中..." : "确认费用并委派"}
      </Button>
    </Card>
  );
}
