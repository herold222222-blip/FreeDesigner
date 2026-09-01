"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Order } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import {
  STRUCTURE_L3_LABEL,
  STRUCTURE_SHEET_UNIT_PRICE,
  getStructureSheetsFromOrder,
  isStructureQuantityPending,
  parsePositiveIntSheets,
  structureFeeFromSheets,
} from "@/lib/structure-sheets";
import { updateOrderStructureSheetsRequest } from "@/lib/api-client";
import { useSessionStore } from "@/store/session-store";
import { Layers } from "lucide-react";

export function AdminStructureSheetsPanel({
  order,
  onUpdated,
}: {
  order: Order;
  onUpdated?: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const current = getStructureSheetsFromOrder(order);
  const pending = isStructureQuantityPending(order);
  const [addValue, setAddValue] = useState<number | "">("");
  const [setValue, setSetValue] = useState<number | "">(pending ? "" : current || "");
  const [saving, setSaving] = useState(false);

  const addSheets = parsePositiveIntSheets(addValue);
  const setSheets = parsePositiveIntSheets(setValue);

  const run = async (body: { sheets?: number; addSheets?: number }) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateOrderStructureSheetsRequest(order.id, body);
      push({
        title: "结构张数已更新",
        description: "结构费用已按 450 元/张计入订单。",
        variant: "success",
      });
      setAddValue("");
      onUpdated?.();
    } catch (e) {
      push({
        title: "更新失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-2">
        <Layers className="mt-0.5 h-4 w-4 text-brand" />
        <div>
          <div className="text-sm font-semibold text-ink">{STRUCTURE_L3_LABEL}</div>
          <p className="mt-1 text-xs leading-relaxed text-ink-60">
            按张计价，{STRUCTURE_SHEET_UNIT_PRICE} 元/张。可在任意环节增加张数，结构费用同步计入订单。
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2.5 text-sm">
        <div className="text-ink-40">当前张数</div>
        <div className="mt-0.5 font-medium text-ink">
          {pending || current <= 0
            ? "待系统评估"
            : `${current} 张 · ${formatCurrency(structureFeeFromSheets(current))}`}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs text-ink-40">增加张数</div>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              className="h-9"
              value={addValue}
              onChange={(e) =>
                setAddValue(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
            <Button
              size="sm"
              variant="brand"
              disabled={saving || addSheets == null}
              onClick={() => run({ addSheets: addSheets! })}
            >
              增加
            </Button>
          </div>
        </div>
        <div>
          <div className="text-xs text-ink-40">设为张数</div>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              className="h-9"
              value={setValue}
              onChange={(e) =>
                setSetValue(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
            <Button
              size="sm"
              variant="outline"
              disabled={saving || setSheets == null}
              onClick={() => run({ sheets: setSheets! })}
            >
              设定
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
