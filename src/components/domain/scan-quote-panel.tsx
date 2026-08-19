"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanPaymentStagesEditor } from "@/components/domain/scan-payment-stages-editor";
import {
  defaultPaymentStages,
  isScanAwaitingClientQuoteConfirm,
  isScanAwaitingDesignerQuote,
  paymentStagesValid,
  type ScanPaymentStageDraft,
} from "@/lib/scan-order";
import { proposeScanQuoteRequest } from "@/lib/api-client";
import type { Order } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Calculator, Send } from "lucide-react";
import { useSessionStore } from "@/store/session-store";

export function ScanQuotePanel({
  order,
  perspective,
  onUpdated,
  busy,
  setBusy,
}: {
  order: Order;
  perspective: "designer" | "client";
  onUpdated: () => void;
  busy?: boolean;
  setBusy?: (v: boolean) => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const awaitingDesigner = isScanAwaitingDesignerQuote(order);
  const awaitingClient = isScanAwaitingClientQuoteConfirm(order);

  const [totalAmount, setTotalAmount] = useState(
    order.totalAmount > 0 ? String(order.totalAmount) : "",
  );
  const [paymentStages, setPaymentStages] = useState<ScanPaymentStageDraft[]>(() => {
    if (order.stages?.length && order.totalAmount > 0) {
      return order.stages.map((s, i) => ({
        id: s.id || `stg_${i}`,
        name: s.name,
        ratio: Math.round((s.ratio ?? 0) * 100) || 0,
      }));
    }
    return defaultPaymentStages();
  });

  useEffect(() => {
    if (order.totalAmount > 0) {
      setTotalAmount(String(order.totalAmount));
    }
    if (order.stages?.length && order.scanQuoteProposedAt) {
      setPaymentStages(
        order.stages.map((s, i) => ({
          id: s.id || `stg_${i}`,
          name: s.name,
          ratio: Math.round((s.ratio ?? 0) * 100) || 0,
        })),
      );
    }
  }, [order.id, order.totalAmount, order.stages, order.scanQuoteProposedAt]);

  if (!awaitingDesigner && !awaitingClient) return null;

  const amount = Math.round(Number(totalAmount) || 0);
  const designerCanSubmit =
    awaitingDesigner &&
    perspective === "designer" &&
    amount > 0 &&
    paymentStagesValid(paymentStages);

  const handlePropose = async () => {
    if (!designerCanSubmit || busy) return;
    setBusy?.(true);
    try {
      await proposeScanQuoteRequest(order.id, {
        totalAmount: amount,
        stages: paymentStages.map((s) => ({
          name: s.name,
          ratio: s.ratio,
          note: s.note?.trim() || undefined,
        })),
      });
      push({
        title: "费用方案已发送",
        description: "已通知委托人确认费用与付款阶段。",
        variant: "success",
      });
      onUpdated();
    } catch (e) {
      push({
        title: "提交失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy?.(false);
    }
  };

  if (awaitingClient && perspective === "designer") {
    return (
      <Card className="space-y-2 p-5">
        <div className="text-xs uppercase tracking-wider text-ink-40">费用方案</div>
        <p className="text-sm leading-relaxed text-ink">
          已提交费用及付款阶段，等待委托人最终确认。
        </p>
        <p className="text-xs text-ink-60">
          委托人确认后将进入合同签署与预付流程，届时可在此查看各阶段进度。
        </p>
      </Card>
    );
  }

  if (awaitingClient && perspective === "client") {
    return (
      <Card className="space-y-3 p-5">
        <div className="text-xs uppercase tracking-wider text-ink-40">待确认费用</div>
        <p className="text-2xl font-semibold tabular-nums text-ink">
          {formatCurrency(order.totalAmount)}
        </p>
        <ul className="space-y-1 text-xs text-ink-60">
          {order.stages.map((s) => (
            <li key={s.id} className="flex justify-between gap-2">
              <span>
                {s.name} · {Math.round((s.ratio ?? 0) * 100)}%
              </span>
              <span className="font-medium text-ink">{formatCurrency(s.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (awaitingDesigner && perspective === "client") {
    return (
      <Card className="space-y-2 p-5">
        <div className="text-xs uppercase tracking-wider text-ink-40">当前进度</div>
        <p className="text-sm text-ink-60">
          需求已提交，等待设计师填写项目费用与付款阶段。
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-ink-40">填写费用方案</div>
        <Button asChild variant="outline" size="sm">
          <Link href="/calculator" target="_blank">
            <Calculator className="h-3.5 w-3.5" /> 平台收费标准
          </Link>
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-ink-60">
        委托人已提交按面积项目需求。请根据平台收费标准或实际情况填写总费用与付款阶段，发送后由委托人确认。
      </p>
      <div>
        <Label htmlFor="scan-quote-amount">项目总费用（元）</Label>
        <Input
          id="scan-quote-amount"
          type="number"
          min={1000}
          step={100}
          className="mt-2 max-w-xs"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          placeholder="如 28000"
        />
      </div>
      <ScanPaymentStagesEditor
        stages={paymentStages}
        onChange={setPaymentStages}
        totalAmount={amount}
      />
      <Button
        variant="brand"
        size="sm"
        className="w-full"
        disabled={!designerCanSubmit || busy}
        onClick={handlePropose}
      >
        <Send className="h-3.5 w-3.5" />
        {busy ? "发送中..." : "发送给委托人确认"}
      </Button>
    </Card>
  );
}
