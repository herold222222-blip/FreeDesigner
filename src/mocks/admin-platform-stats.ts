export type PlatformStatsPeriod = "day" | "month" | "year";

export type PlatformStatsPoint = {
  label: string;
  registrations: number;
  activity: number;
  volume: number;
  orders: number;
};

export type PlatformSnapshotStats = {
  todayRegistrations: number;
  todayLogins: number;
  newUsers3d: number;
  newUsers7d: number;
  activity7d: number;
  activityMonth: number;
};

export const PLATFORM_STATS_BY_PERIOD: Record<
  PlatformStatsPeriod,
  PlatformStatsPoint[]
> = {
  day: [
    { label: "05-22", registrations: 18, activity: 412, volume: 28600, orders: 9 },
    { label: "05-23", registrations: 24, activity: 438, volume: 31200, orders: 11 },
    { label: "05-24", registrations: 15, activity: 395, volume: 24800, orders: 8 },
    { label: "05-25", registrations: 31, activity: 521, volume: 42100, orders: 16 },
    { label: "05-26", registrations: 22, activity: 467, volume: 33500, orders: 12 },
    { label: "05-27", registrations: 19, activity: 403, volume: 27900, orders: 10 },
    { label: "05-28", registrations: 27, activity: 489, volume: 36800, orders: 14 },
    { label: "05-29", registrations: 33, activity: 556, volume: 45200, orders: 17 },
    { label: "05-30", registrations: 21, activity: 441, volume: 30100, orders: 11 },
    { label: "05-31", registrations: 26, activity: 478, volume: 34600, orders: 13 },
    { label: "06-01", registrations: 29, activity: 512, volume: 38900, orders: 15 },
    { label: "06-02", registrations: 17, activity: 386, volume: 26200, orders: 9 },
    { label: "06-03", registrations: 35, activity: 598, volume: 47800, orders: 19 },
    { label: "06-04", registrations: 28, activity: 534, volume: 41200, orders: 16 },
    { label: "06-05", registrations: 32, activity: 571, volume: 43600, orders: 18 },
  ],
  month: [
    { label: "7月", registrations: 412, activity: 9820, volume: 628000, orders: 286 },
    { label: "8月", registrations: 468, activity: 10450, volume: 712000, orders: 312 },
    { label: "9月", registrations: 521, activity: 11280, volume: 798000, orders: 348 },
    { label: "10月", registrations: 589, activity: 12140, volume: 865000, orders: 376 },
    { label: "11月", registrations: 634, activity: 12890, volume: 924000, orders: 402 },
    { label: "12月", registrations: 712, activity: 13620, volume: 1012000, orders: 438 },
    { label: "1月", registrations: 498, activity: 11860, volume: 842000, orders: 364 },
    { label: "2月", registrations: 445, activity: 10920, volume: 756000, orders: 328 },
    { label: "3月", registrations: 612, activity: 13240, volume: 968000, orders: 412 },
    { label: "4月", registrations: 678, activity: 14180, volume: 1056000, orders: 448 },
    { label: "5月", registrations: 724, activity: 14860, volume: 1124000, orders: 476 },
    { label: "6月", registrations: 386, activity: 8240, volume: 586000, orders: 248 },
  ],
  year: [
    { label: "2021", registrations: 4280, activity: 68400, volume: 4860000, orders: 2180 },
    { label: "2022", registrations: 6120, activity: 92800, volume: 7120000, orders: 3260 },
    { label: "2023", registrations: 8640, activity: 118600, volume: 9840000, orders: 4480 },
    { label: "2024", registrations: 11280, activity: 142400, volume: 12680000, orders: 5620 },
    { label: "2025", registrations: 4860, activity: 62400, volume: 5480000, orders: 2480 },
  ],
};

const TODAY_LOGIN_RATIO = 0.85;

export function getPlatformSnapshotStats(): PlatformSnapshotStats {
  const days = PLATFORM_STATS_BY_PERIOD.day;
  const months = PLATFORM_STATS_BY_PERIOD.month;
  const today = days[days.length - 1];
  const last3 = days.slice(-3);
  const last7 = days.slice(-7);
  const currentMonth = months[months.length - 1];

  return {
    todayRegistrations: today.registrations,
    todayLogins: Math.round(today.activity * TODAY_LOGIN_RATIO),
    newUsers3d: last3.reduce((sum, point) => sum + point.registrations, 0),
    newUsers7d: last7.reduce((sum, point) => sum + point.registrations, 0),
    activity7d: last7.reduce((sum, point) => sum + point.activity, 0),
    activityMonth: currentMonth.activity,
  };
}

export function summarizePlatformStats(period: PlatformStatsPeriod) {
  const points = PLATFORM_STATS_BY_PERIOD[period];
  const totalRegistrations = points.reduce((s, p) => s + p.registrations, 0);
  const avgActivity = Math.round(
    points.reduce((s, p) => s + p.activity, 0) / points.length,
  );
  const totalVolume = points.reduce((s, p) => s + p.volume, 0);
  const totalOrders = points.reduce((s, p) => s + p.orders, 0);
  return { totalRegistrations, avgActivity, totalVolume, totalOrders };
}
