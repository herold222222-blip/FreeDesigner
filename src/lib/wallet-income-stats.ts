import type { WalletTransaction } from "@/lib/types";

export type IncomeStatsGranularity = "day" | "month" | "quarter" | "year";

export interface IncomeStatsPoint {
  key: string;
  label: string;
  income: number;
  withdraw: number;
}

function quarterOf(date: Date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

function bucketKey(date: Date, granularity: IncomeStatsGranularity) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  switch (granularity) {
    case "day":
      return `${y}-${String(m).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    case "month":
      return `${y}-${String(m).padStart(2, "0")}`;
    case "quarter":
      return `${y}-Q${quarterOf(date)}`;
    case "year":
      return `${y}`;
  }
}

function formatLabel(key: string, granularity: IncomeStatsGranularity) {
  switch (granularity) {
    case "day": {
      const [, mm, dd] = key.split("-");
      return `${Number(mm)}月${Number(dd)}日`;
    }
    case "month": {
      const [y, mm] = key.split("-");
      return `${y}年${Number(mm)}月`;
    }
    case "quarter": {
      const [y, q] = key.split("-");
      return `${y}年 ${q}`;
    }
    case "year":
      return `${key}年`;
  }
}

function createBuckets(
  granularity: IncomeStatsGranularity,
  now = new Date(),
): IncomeStatsPoint[] {
  const buckets: IncomeStatsPoint[] = [];

  if (granularity === "day") {
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = bucketKey(d, "day");
      buckets.push({ key, label: formatLabel(key, "day"), income: 0, withdraw: 0 });
    }
    return buckets;
  }

  if (granularity === "month") {
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = bucketKey(d, "month");
      buckets.push({ key, label: formatLabel(key, "month"), income: 0, withdraw: 0 });
    }
    return buckets;
  }

  if (granularity === "quarter") {
    let q = quarterOf(now);
    let y = now.getFullYear();
    const keys: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      keys.unshift(`${y}-Q${q}`);
      q -= 1;
      if (q <= 0) {
        q = 4;
        y -= 1;
      }
    }
    for (const key of keys) {
      buckets.push({ key, label: formatLabel(key, "quarter"), income: 0, withdraw: 0 });
    }
    return buckets;
  }

  for (let i = 4; i >= 0; i -= 1) {
    const y = now.getFullYear() - i;
    const key = `${y}`;
    buckets.push({ key, label: formatLabel(key, "year"), income: 0, withdraw: 0 });
  }
  return buckets;
}

export function buildIncomeStats(
  transactions: WalletTransaction[],
  granularity: IncomeStatsGranularity,
  now = new Date(),
): IncomeStatsPoint[] {
  const buckets = createBuckets(granularity, now);
  const index = new Map(buckets.map((b, i) => [b.key, i]));

  for (const t of transactions) {
    const d = new Date(t.occurredAt);
    const key = bucketKey(d, granularity);
    const i = index.get(key);
    if (i === undefined) continue;
    if (t.type === "income" && t.amount > 0) {
      buckets[i].income += t.amount;
    }
    if (t.type === "withdraw") {
      buckets[i].withdraw += Math.abs(t.amount);
    }
  }

  return buckets;
}

export function sumStats(points: IncomeStatsPoint[]) {
  return points.reduce(
    (acc, p) => ({
      income: acc.income + p.income,
      withdraw: acc.withdraw + p.withdraw,
    }),
    { income: 0, withdraw: 0 },
  );
}

export const INCOME_STATS_GRANULARITY_META: Record<
  IncomeStatsGranularity,
  { label: string; description: string }
> = {
  day: { label: "日", description: "近 30 天入账与提现" },
  month: { label: "月", description: "近 12 个月入账与提现" },
  quarter: { label: "季度", description: "近 8 个季度入账与提现" },
  year: { label: "年", description: "近 5 年入账与提现" },
};
