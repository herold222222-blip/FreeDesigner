"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/lib/types";
import {
  CLIENT_LEVEL_META,
  DESIGNER_LEVEL_META,
  REGION_TIER_META,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { getQuoteOrderTotal, getQuotePreTaxTotal } from "@/lib/regular-entrust-quote";
import { CheckCircle2, FileSpreadsheet, Sparkles } from "lucide-react";
import { LevelQuoteCards } from "@/components/domain/level-quote-cards";
import { needsCsQuoteConfirm } from "@/lib/order-supervision";

export function OrderQuotePanel({
  order,
  onConfirm,
  confirming,
  compact,
}: {
  order: Order;
  onConfirm?: () => void;
  confirming?: boolean;
  compact?: boolean;
}) {
  const levelQuotes = order.levelQuotes?.length
    ? order.levelQuotes
    : order.quote
      ? [order.quote]
      : [];
  const quote = order.quote ?? levelQuotes[0];
  if (!quote) return null;

  const pending = order.status === "pending_quote" && quote.status === "pending";
  const awaitingCs = needsCsQuoteConfirm(order);
  const showLevelCards = Boolean(order.levelQuotes?.length);

  if (showLevelCards) {
    const lines = quote.lines;
    return (
      <Card className={compact ? "space-y-3 p-4" : "space-y-4 p-6"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-brand" />
              等级报价卡
            </div>
            <p className="mt-1 text-xs text-ink-60">
              系统按见习 / 中级 / 高级 / 特级四档测算费用，与委托人端展示一致。
            </p>
          </div>
          {awaitingCs ? (
            <Badge variant="amber">待客服确认</Badge>
          ) : pending ? (
            <Badge variant="amber">待选卡匹配</Badge>
          ) : (
            <Badge variant="emerald">已确认</Badge>
          )}
        </div>

        {lines.length ? (
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div
                key={`${line.l3 ?? line.track}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-ink">
                    {line.l3Label ?? line.trackLabel}
                  </div>
                  <div className="mt-0.5 text-ink-60">
                    {line.quantity} {line.unit === "day" ? "工日" : "个月"} · 难度
                    {line.difficultyLabel ?? ""}{" "}
                    {Math.round(line.difficulty * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <LevelQuoteCards
          quotes={levelQuotes}
          selectedLevels={order.clientMatch?.selectedLevels}
        />
      </Card>
    );
  }

  return (
    <Card className={compact ? "space-y-3 p-4" : "space-y-4 p-6"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <FileSpreadsheet className="mt-0.5 h-4 w-4 text-brand" />
          <div>
            <div className="text-sm font-semibold text-ink">系统报价单</div>
            <p className="mt-1 text-xs text-ink-60">
              {quote.assumptions.note}
            </p>
          </div>
        </div>
        <Badge variant={pending ? "amber" : "emerald"}>
          {pending ? "待确认" : "已确认"}
        </Badge>
      </div>

      <div className="space-y-2">
        {quote.lines.map((line, i) => (
          <div
            key={`${line.l3 ?? line.track}-${i}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2.5 text-xs"
          >
            <div className="min-w-0">
              <div className="font-medium text-ink">
                {line.l3Label ?? line.trackLabel}
              </div>
              <div className="mt-0.5 text-ink-60">
                {line.quantity} {line.unit === "day" ? "工日" : "个月"} · 难度
                {line.difficultyLabel ?? ""}{" "}
                {Math.round(line.difficulty * 100)}%
              </div>
            </div>
            <div className="tabular-nums font-semibold text-ink">
              {formatCurrency(line.subtotal)}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 border-t border-ink-20 pt-3 text-xs text-ink-60">
        <Row label="设计基础费" value={quote.basicFee} />
        <Row label="平台管理费（含商务费）" value={quote.platformFee} />
        {quote.auditFee > 0 ? (
          <Row label="第三方审图" value={quote.auditFee} />
        ) : null}
        {quote.projectManagementFee > 0 ? (
          <Row label="项目管理" value={quote.projectManagementFee} />
        ) : null}
        <Row label="税前合计" value={getQuotePreTaxTotal(quote)} />
        <div className="flex justify-between text-[11px]">
          <span>测算假设</span>
          <span className="text-right">
            {DESIGNER_LEVEL_META[quote.assumptions.designerLevel].label} ·{" "}
            {quote.assumptions.serviceMode === "remote"
              ? "远程地区系数 1.0"
              : REGION_TIER_META[quote.assumptions.designerRegion].label}{" "}
            · {CLIENT_LEVEL_META[quote.assumptions.clientLevel].label} · 税率{" "}
            {quote.taxCoefficient.toFixed(2)}
          </span>
        </div>
        <div className="flex items-end justify-between pt-2">
          <span className="text-sm font-semibold text-ink">订单总额（含税）</span>
          <span className="text-2xl font-bold tabular-nums tracking-tight text-brand">
            {formatCurrency(getQuoteOrderTotal(quote))}
          </span>
        </div>
      </div>

      {pending && onConfirm ? (
        <Button
          variant="brand"
          className="w-full"
          disabled={confirming}
          onClick={onConfirm}
        >
          <CheckCircle2 className="h-4 w-4" />
          {confirming ? "确认中..." : "确认报价并提交匹配"}
        </Button>
      ) : null}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="tabular-nums text-ink">{formatCurrency(value)}</span>
    </div>
  );
}
