import "server-only";
import { prisma } from "./db";
import type {
  PlatformSnapshotStats,
  PlatformStatsPeriod,
  PlatformStatsPoint,
  PlatformStatsPayload,
} from "@/lib/platform-stats";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDayLabel(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}-${day}`;
}

function formatMonthLabel(d: Date) {
  return `${d.getMonth() + 1}月`;
}

async function countUsersBetween(from: Date, to: Date) {
  return prisma.user.count({
    where: { createdAt: { gte: from, lt: to } },
  });
}

async function countSessionsBetween(from: Date, to: Date) {
  return prisma.session.count({
    where: { createdAt: { gte: from, lt: to } },
  });
}

async function countOrdersBetween(from: Date, to: Date) {
  return prisma.order.count({
    where: { createdAt: { gte: from, lt: to } },
  });
}

async function sumOrderVolumeBetween(from: Date, to: Date) {
  const agg = await prisma.order.aggregate({
    where: { createdAt: { gte: from, lt: to } },
    _sum: { totalAmount: true },
  });
  return agg._sum.totalAmount ?? 0;
}

async function buildDaySeries(): Promise<PlatformStatsPoint[]> {
  const today = startOfDay(new Date());
  const points: PlatformStatsPoint[] = [];
  for (let i = 14; i >= 0; i--) {
    const from = new Date(today);
    from.setDate(from.getDate() - i);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const [registrations, activity, orders, volume] = await Promise.all([
      countUsersBetween(from, to),
      countSessionsBetween(from, to),
      countOrdersBetween(from, to),
      sumOrderVolumeBetween(from, to),
    ]);
    points.push({
      label: formatDayLabel(from),
      registrations,
      activity,
      orders,
      volume,
    });
  }
  return points;
}

async function buildMonthSeries(): Promise<PlatformStatsPoint[]> {
  const now = new Date();
  const points: PlatformStatsPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const [registrations, activity, orders, volume] = await Promise.all([
      countUsersBetween(from, to),
      countSessionsBetween(from, to),
      countOrdersBetween(from, to),
      sumOrderVolumeBetween(from, to),
    ]);
    points.push({
      label: formatMonthLabel(from),
      registrations,
      activity,
      orders,
      volume,
    });
  }
  return points;
}

async function buildYearSeries(): Promise<PlatformStatsPoint[]> {
  const year = new Date().getFullYear();
  const points: PlatformStatsPoint[] = [];
  for (let y = year - 4; y <= year; y++) {
    const from = new Date(y, 0, 1);
    const to = new Date(y + 1, 0, 1);
    const [registrations, activity, orders, volume] = await Promise.all([
      countUsersBetween(from, to),
      countSessionsBetween(from, to),
      countOrdersBetween(from, to),
      sumOrderVolumeBetween(from, to),
    ]);
    points.push({
      label: String(y),
      registrations,
      activity,
      orders,
      volume,
    });
  }
  return points;
}

async function buildSnapshot(): Promise<PlatformSnapshotStats> {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [
    todayRegistrations,
    todayLogins,
    newUsers3d,
    newUsers7d,
    activity7d,
    activityMonth,
  ] = await Promise.all([
    countUsersBetween(today, tomorrow),
    countSessionsBetween(today, tomorrow),
    countUsersBetween(threeDaysAgo, tomorrow),
    countUsersBetween(sevenDaysAgo, tomorrow),
    countSessionsBetween(sevenDaysAgo, tomorrow),
    countSessionsBetween(monthStart, nextMonth),
  ]);

  return {
    todayRegistrations,
    todayLogins,
    newUsers3d,
    newUsers7d,
    activity7d,
    activityMonth,
  };
}

export async function getPlatformStats(
  period: PlatformStatsPeriod,
): Promise<PlatformStatsPayload> {
  const series =
    period === "day"
      ? await buildDaySeries()
      : period === "month"
        ? await buildMonthSeries()
        : await buildYearSeries();
  const snapshot = await buildSnapshot();
  return { period, series, snapshot };
}
