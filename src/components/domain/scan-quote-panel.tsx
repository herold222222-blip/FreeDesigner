"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScanPaymentStagesEditor } from "@/components/domain/scan-payment-stages-editor";
import { PaymentEscrowHint } from "@/components/domain/payment-escrow-hint";
import {
  defaultPaymentStages,
  directedScanQuoteHasChanges,
  draftsFromOrderPaymentStages,
  isScanAwaitingClientQuoteConfirm,
  isScanAwaitingDesignerQuote,
  paymentStagesValid,
  type ScanPaymentStageDraft,
} from "@/lib/scan-order";
import {
  confirmScanQuoteRequest,
  proposeScanQuoteRequest,
} from "@/lib/api-client";
import type { Order } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { Calculator, CheckCircle2, Pencil, Send } from "lucide-react";
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
  const totalInputRef = useRef<HTMLInputElement>(null);

  const [totalAmount, setTotalAmount] = useState(
    order.totalAmount > 0 ? String(order.totalAmount) : "",
  );
  const [totalEditing, setTotalEditing] = useState(false);
  const [stagesEditing, setStagesEditing] = useState(false);
  const [paymentStages, setPaymentStages] = useState<ScanPaymentStageDraft[]>(
    () =>
      draftsFromOrderPaymentStages(order.stages) ?? defaultPaymentStages(),
  );

  useEffect(() => {
    if (order.totalAmount > 0) {
      setTotalAmount(String(order.totalAmount));
    }
    const drafts = draftsFromOrderPaymentStages(order.stages);
    if (drafts) setPaymentStages(drafts);
    setTotalEditing(false);
    setStagesEditing(false);
  }, [order.id, order.totalAmount, order.stages, order.scanQuoteProposedAt]);

  if (!awaitingDesigner && !awaitingClient) return null;

  const amount = Math.round(Number(totalAmount) || 0);
  const canSubmit = amount > 0 && paymentStagesValid(paymentStages);
  const hasChanges = directedScanQuoteHasChanges(order, amount, paymentStages);
  const stagesPayload = paymentStages.map((s) => ({
    name: s.name,
    ratio: s.ratio,
    note: s.note?.trim() || undefined,
  }));

  const designerCanSubmit =
    awaitingDesigner && perspective === "designer" && canSubmit;
  const clientCanSubmit =
    awaitingClient && perspective === "client" && canSubmit;

  const handleDesignerPropose = async () => {
    if (!designerCanSubmit || busy) return;
    setBusy?.(true);
    try {
      await proposeScanQuoteRequest(order.id, {
        totalAmount: amount,
        stages: stagesPayload,
      });
      push({
        title: hasChanges ? "费用方案已发送" : "已确认费用",
        description: hasChanges
          ? "已通知委托人确认修改后的费用、付款阶段与付款条件。"
          : "双方已确认费用，请签署电子合同。",
        variant: "success",
      });
      onUpdated();
    } catch (e) {
      push({
        title: hasChanges ? "提交失败" : "确认失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy?.(false);
    }
  };

  const handleClientRespond = async () => {
    if (!clientCanSubmit || busy) return;
    setBusy?.(true);
    try {
      await confirmScanQuoteRequest(order.id, {
        totalAmount: amount,
        stages: stagesPayload,
      });
      push({
        title: hasChanges ? "费用方案已发送" : "已确认费用",
        description: hasChanges
          ? "已通知设计师确认修改后的费用、付款阶段与付款条件。"
          : "双方已确认费用，请签署电子合同。",
        variant: "success",
      });
      onUpdated();
    } catch (e) {
      push({
        title: hasChanges ? "提交失败" : "确认失败",
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
          已提交费用及付款阶段，等待委托人确认。
        </p>
        <p className="text-xs text-ink-60">
          委托人确认后将进入合同签署与预付流程；如对方修改条款，将通知您再次确认。
        </p>
      </Card>
    );
  }

  if (awaitingClient && perspective === "client") {
    return (
      <Card className="space-y-6 p-5">
        <div>
          <div className="text-xs uppercase tracking-wider text-ink-40">
            核对费用与付款阶段
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-60">
            未改动可直接确认费用并进入签约；如修改总费用、付款阶段或付款条件，将发回设计师再次确认。
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Label htmlFor="client-scan-total" className="text-base font-semibold text-ink">
              项目总费用
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTotalEditing((v) => {
                  const next = !v;
                  if (next) {
                    requestAnimationFrame(() => totalInputRef.current?.focus());
                  }
                  return next;
                });
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              {totalEditing ? "完成修改" : "修改"}
            </Button>
          </div>
          <Input
            ref={totalInputRef}
            id="client-scan-total"
            type="number"
            min={1000}
            step={100}
            readOnly={!totalEditing}
            className={cn(
              "max-w-xs text-lg font-semibold tabular-nums",
              !totalEditing && "cursor-default bg-ink-20/30",
            )}
            value={totalAmount}
            onChange={(e) => {
              if (!totalEditing) return;
              setTotalAmount(e.target.value);
            }}
          />
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink">付款阶段与付款条件</h3>
              {!stagesEditing ? <PaymentEscrowHint className="mt-1.5" /> : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStagesEditing((v) => !v)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {stagesEditing ? "完成修改" : "修改"}
            </Button>
          </div>
          {stagesEditing ? (
            <ScanPaymentStagesEditor
              stages={paymentStages}
              onChange={setPaymentStages}
              totalAmount={amount}
            />
          ) : (
            <ul className="space-y-2">
              {paymentStages.map((stage, i) => (
                <li
                  key={stage.id}
                  className="rounded-xl border border-ink-20 bg-ink-20/15 px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {i + 1}. {stage.name} · {stage.ratio}%
                    </span>
                    {amount > 0 ? (
                      <span className="text-sm font-semibold tabular-nums text-brand">
                        {formatCurrency(Math.round((amount * stage.ratio) / 100))}
                      </span>
                    ) : null}
                  </div>
                  {stage.note ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-60">
                      {stage.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button
          variant="brand"
          className="w-full"
          disabled={!clientCanSubmit || busy}
          onClick={handleClientRespond}
        >
          {hasChanges ? (
            <Send className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {busy
            ? hasChanges
              ? "发送中..."
              : "确认中..."
            : hasChanges
              ? "发送给设计师确认"
              : "确认费用"}
        </Button>
      </Card>
    );
  }

  if (awaitingDesigner && perspective === "client") {
    return null;
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
        请核对委托人提交的费用与付款阶段。未改动可直接确认；如有修改将发回委托人确认。
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
        onClick={handleDesignerPropose}
      >
        {hasChanges ? (
          <Send className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {busy
          ? hasChanges
            ? "发送中..."
            : "确认中..."
          : hasChanges
            ? "发送给委托人确认"
            : "确认费用"}
      </Button>
    </Card>
  );
}
