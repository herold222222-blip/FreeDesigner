"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/lib/use-data";
import { formatCurrency } from "@/lib/utils";
import {
  buildIncomeStats,
  INCOME_STATS_GRANULARITY_META,
  sumStats,
  type IncomeStatsGranularity,
} from "@/lib/wallet-income-stats";
import { ArrowLeft, ArrowDownToLine, CircleDollarSign, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const GRANULARITIES: IncomeStatsGranularity[] = [
  "day",
  "month",
  "quarter",
  "year",
];

export default function DesignerWalletStatsPage() {
  const { data: wallet } = useWallet();
  const [granularity, setGranularity] = useState<IncomeStatsGranularity>("month");

  const chartData = useMemo(
    () => buildIncomeStats(wallet.transactions, granularity),
    [wallet.transactions, granularity],
  );

  const totals = useMemo(() => sumStats(chartData), [chartData]);
  const meta = INCOME_STATS_GRANULARITY_META[granularity];

  return (
    <div className="space-y-6">
      <Link
        href="/designer/wallet"
        className="inline-flex items-center gap-1 text-sm text-ink-60 hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 返回钱包
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            收入统计
          </h2>
          <p className="mt-1 text-sm text-ink-60">{meta.description}</p>
        </div>
        <Badge variant="muted">
          <TrendingUp className="h-3 w-3" /> 同比 +28%
        </Badge>
      </div>

      <Tabs
        value={granularity}
        onValueChange={(v) => setGranularity(v as IncomeStatsGranularity)}
      >
        <TabsList>
          {GRANULARITIES.map((g) => (
            <TabsTrigger key={g} value={g}>
              {INCOME_STATS_GRANULARITY_META[g].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-ink-40">
              期间入账
            </span>
            <CircleDollarSign className="h-4 w-4 text-ink-60" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(totals.income)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-ink-40">
              期间提现
            </span>
            <ArrowDownToLine className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(totals.withdraw)}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-5">
          <h3 className="text-base font-semibold tracking-tight text-ink">
            收入趋势
          </h3>
          <p className="mt-1 text-xs text-ink-60">
            按{meta.label}查看入账与提现变化
          </p>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="statsIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="statsWithdrawGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E11D48" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#E11D48" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E5E5E5" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                stroke="#A3A3A3"
                fontSize={11}
                interval={granularity === "day" ? 4 : granularity === "month" ? 1 : 0}
                angle={granularity === "day" ? -35 : 0}
                textAnchor={granularity === "day" ? "end" : "middle"}
                height={granularity === "day" ? 50 : 30}
              />
              <YAxis stroke="#A3A3A3" fontSize={11} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #E5E5E5",
                  fontSize: 12,
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#0a0a0a"
                fill="url(#statsIncomeGrad)"
                name="入账"
              />
              <Area
                type="monotone"
                dataKey="withdraw"
                stroke="#E11D48"
                fill="url(#statsWithdrawGrad)"
                name="提现"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
