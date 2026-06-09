"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import type {
  PlatformStatsPayload,
  PlatformStatsPeriod,
} from "@/lib/platform-stats";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Activity,
  CalendarDays,
  LineChart as LineChartIcon,
  LogIn,
  Package,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PERIOD_OPTIONS: { value: PlatformStatsPeriod; label: string }[] = [
  { value: "day", label: "日" },
  { value: "month", label: "月" },
  { value: "year", label: "年" },
];

function formatVolumeTick(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(0)}万`;
  return String(value);
}

export function AdminPlatformDataCharts() {
  const [period, setPeriod] = useState<PlatformStatsPeriod>("month");
  const [payload, setPayload] = useState<PlatformStatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch<PlatformStatsPayload>(
      `/api/admin/platform-stats?period=${period}`,
    )
      .then((data) => {
        if (active) setPayload(data);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period]);

  const data = payload?.series ?? [];
  const snapshot = payload?.snapshot;

  const periodHint =
    period === "day"
      ? "近 15 日"
      : period === "month"
        ? "近 12 个月"
        : "近 5 年";

  const snapshotTiles = snapshot
    ? [
        {
          icon: UserPlus,
          label: "今日注册人数",
          value: snapshot.todayRegistrations.toLocaleString(),
          suffix: "人",
        },
        {
          icon: LogIn,
          label: "今日登录人数",
          value: snapshot.todayLogins.toLocaleString(),
          suffix: "人",
        },
        {
          icon: Users,
          label: "三日新增用户",
          value: snapshot.newUsers3d.toLocaleString(),
          suffix: "人",
        },
        {
          icon: CalendarDays,
          label: "七日新增用户",
          value: snapshot.newUsers7d.toLocaleString(),
          suffix: "人",
        },
        {
          icon: Activity,
          label: "七日活跃度",
          value: snapshot.activity7d.toLocaleString(),
          suffix: "人次",
        },
        {
          icon: TrendingUp,
          label: "月活跃度",
          value: snapshot.activityMonth.toLocaleString(),
          suffix: "人次",
        },
      ]
    : [];

  return (
    <Card className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-ink">
            平台数据
          </h3>
          <p className="mt-1 text-xs text-ink-60">
            注册、活跃、交易与订单趋势 · {periodHint} · 数据库实时统计
          </p>
        </div>
        <div className="flex rounded-xl border border-ink-20 bg-ink-20/20 p-1">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                period === option.value
                  ? "bg-ink text-paper shadow-sm"
                  : "text-ink-60 hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-ink-60">加载统计数据...</div>
      ) : null}

      {error ? (
        <div className="py-16 text-center text-sm text-rose-600">{error}</div>
      ) : null}

      {!loading && !error && snapshot ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {snapshotTiles.map((tile) => (
              <SummaryTile
                key={tile.label}
                icon={tile.icon}
                label={tile.label}
                value={tile.value}
                suffix={tile.suffix}
              />
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricChart
              title="注册人数"
              subtitle={periodHint}
              dataKey="registrations"
              data={data}
              color="#0a0a0a"
              valueFormatter={(v) => `${v} 人`}
            />
            <MetricChart
              title="活跃度"
              subtitle="会话创建量"
              dataKey="activity"
              data={data}
              color="#2563EB"
              valueFormatter={(v) => `${v} 人次`}
            />
            <MetricChart
              title="交易额"
              subtitle="平台托管流水"
              dataKey="volume"
              data={data}
              color="#E11D48"
              valueFormatter={(v) => formatCurrency(v)}
              yAxisFormatter={formatVolumeTick}
            />
            <MetricChart
              title="订单数"
              subtitle="新建订单量"
              dataKey="orders"
              data={data}
              color="#059669"
              valueFormatter={(v) => `${v} 单`}
            />
          </div>
        </>
      ) : null}
    </Card>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof UserPlus;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-20 p-4">
      <div className="flex items-center gap-2 text-xs text-ink-60">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {value}
        {suffix ? (
          <span className="ml-1 text-sm font-normal text-ink-60">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

type MetricDataKey = "registrations" | "activity" | "volume" | "orders";

function MetricChart({
  title,
  subtitle,
  dataKey,
  data,
  color,
  valueFormatter,
  yAxisFormatter,
}: {
  title: string;
  subtitle: string;
  dataKey: MetricDataKey;
  data: {
    label: string;
    registrations: number;
    activity: number;
    volume: number;
    orders: number;
  }[];
  color: string;
  valueFormatter: (value: number) => string;
  yAxisFormatter?: (value: number) => string;
}) {
  return (
    <div className="rounded-xl border border-ink-20 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-ink">{title}</h4>
          <p className="mt-0.5 text-[11px] text-ink-40">{subtitle}</p>
        </div>
        <Badge variant="muted">
          {dataKey === "orders" ? (
            <Package className="h-3 w-3" />
          ) : (
            <LineChartIcon className="h-3 w-3" />
          )}
        </Badge>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#E5E5E5" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#A3A3A3"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#A3A3A3"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={yAxisFormatter}
              width={36}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #E5E5E5",
                fontSize: 12,
              }}
              formatter={(value: number) => [valueFormatter(value), title]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
