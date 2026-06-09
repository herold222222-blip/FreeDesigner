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

export type PlatformStatsPayload = {
  period: PlatformStatsPeriod;
  series: PlatformStatsPoint[];
  snapshot: PlatformSnapshotStats;
};
