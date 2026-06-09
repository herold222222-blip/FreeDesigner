import { ORDER_STATUS_META, SPECIALTIES } from "@/lib/constants";
import { getTrackLabelParts } from "@/lib/bounty-filters";
import { SCAN_ORDER_STATUS_LABEL, type ScanOrder } from "@/lib/scan-order";
import type { DraftOrderPayload } from "@/store/session-store";
import {
  BOUNTY_STATUS_FILTER_TABS,
  bountyStatusLabel,
  type BountyStatusFilter,
} from "@/lib/bounty-manage";
import { DESIGNER_ORDER_STATUS_LABEL } from "@/lib/designer-order-status-filter";
import type { Bounty, Order, OrderSource, OrderStatus, Specialty } from "@/lib/types";

export type ProjectListCategory =
  | "all"
  | "bounty"
  | "monthly"
  | "daily"
  | "online"
  | "onsite"
  | "area";

export const PROJECT_LIST_CATEGORY_TABS: {
  value: ProjectListCategory;
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "bounty", label: "悬赏" },
  { value: "monthly", label: "按月" },
  { value: "daily", label: "按工时" },
  { value: "online", label: "线上" },
  { value: "onsite", label: "线下" },
  { value: "area", label: "常规面积" },
];

/** 委托人平台订单页：不含悬赏、常规面积分类 */
export const CLIENT_PLATFORM_CATEGORY_TABS =
  PROJECT_LIST_CATEGORY_TABS.filter(
    (t) => t.value !== "bounty" && t.value !== "area",
  );

export type PlatformSpecialtyFilter = Specialty | "all";

/** 平台订单 · 一级专业筛选 */
export const PLATFORM_SPECIALTY_FILTER_TABS: {
  value: PlatformSpecialtyFilter;
  label: string;
}[] = [
  { value: "all", label: "全部专业" },
  ...SPECIALTIES.map((s) => ({ value: s.value, label: s.label })),
];

export function isPlatformOrderSource(order: Order): boolean {
  const source = inferOrderSource(order);
  return source !== "bounty";
}

export function isPlatformProjectItem(item: UnifiedProjectItem): boolean {
  if (item.kind === "bounty") return false;
  if (item.order && !isPlatformOrderSource(item.order)) return false;
  return true;
}

export type UnifiedProjectKind = "order" | "bounty" | "scan" | "draft";

export interface UnifiedProjectItem {
  id: string;
  kind: UnifiedProjectKind;
  title: string;
  code: string;
  status: string;
  statusLabel: string;
  totalAmount: number;
  createdAt: string;
  href: string;
  specialty?: Specialty;
  counterpartyName?: string;
  categories: Exclude<ProjectListCategory, "all">[];
  tags: string[];
  order?: Order;
  scan?: import("@/lib/scan-order").ScanOrder;
}

function inferOrderSource(order: Order): OrderSource {
  if (order.orderSource) return order.orderSource;
  if (order.billingMode === "area") return "regular";
  if (order.onsiteSchedule) return "directed";
  return "regular";
}

export function resolveOrderCategories(order: Order): Exclude<ProjectListCategory, "all">[] {
  const cats = new Set<Exclude<ProjectListCategory, "all">>();
  const source = inferOrderSource(order);
  if (source === "bounty") cats.add("bounty");
  if (order.billingMode === "monthly") cats.add("monthly");
  if (order.billingMode === "daily") cats.add("daily");
  if (order.billingMode === "area") cats.add("area");
  if (order.serviceMode === "online") cats.add("online");
  if (order.serviceMode === "onsite") cats.add("onsite");
  return [...cats];
}

export function orderDisplayTags(order: Order): string[] {
  const source = inferOrderSource(order);
  const tags: string[] = [];
  if (source === "bounty") tags.push("悬赏");
  else if (source === "scan") tags.push("扫码下单");
  else if (source === "directed") tags.push("定向下单");
  else tags.push("常规委托");

  if (order.billingMode === "area") tags.push("按面积");
  else if (order.billingMode === "monthly") tags.push("按月");
  else if (order.billingMode === "daily") tags.push("按工时");

  tags.push(order.serviceMode === "onsite" ? "线下" : "线上");
  return tags;
}

/** 通过 id 解析展示名称（设计师或委托人，id 前缀不同，统一查表） */
export type NameResolver = (id?: string) => string | undefined;

function orderToItem(
  order: Order,
  perspective: "client" | "designer",
  nameById: NameResolver,
): UnifiedProjectItem {
  const counterpartyName =
    perspective === "client"
      ? nameById(order.designerId)
      : nameById(order.clientId);
  return {
    id: order.id,
    kind: "order",
    title: order.title,
    code: order.code,
    status: order.status,
    statusLabel:
      perspective === "designer"
        ? (DESIGNER_ORDER_STATUS_LABEL[order.status] ??
          ORDER_STATUS_META[order.status as OrderStatus]?.label ??
          order.status)
        : (ORDER_STATUS_META[order.status as OrderStatus]?.label ?? order.status),
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    href:
      perspective === "client"
        ? `/client/orders/${order.id}`
        : `/designer/orders/${order.id}`,
    specialty: order.specialty,
    counterpartyName,
    categories: resolveOrderCategories(order),
    tags: orderDisplayTags(order),
    order,
  };
}

function bountyToItem(
  bounty: Bounty,
  perspective: "client" | "designer" = "client",
): UnifiedProjectItem {
  const trackLabels = getTrackLabelParts(bounty.primaryTrack);
  return {
    id: bounty.id,
    kind: "bounty",
    title: bounty.title,
    code: bounty.code,
    status: bounty.status,
    statusLabel: bountyStatusLabel(bounty.status),
    totalAmount: bounty.reward,
    createdAt: bounty.publishedAt,
    href:
      perspective === "client"
        ? `/client/bounties/${bounty.id}`
        : `/bounties/${bounty.id}`,
    specialty: bounty.specialty,
    categories: ["bounty", "online"],
    tags: [
      "悬赏",
      trackLabels.l2,
      trackLabels.l3,
      bounty.location.label,
    ].filter(Boolean),
  };
}

function scanToItem(
  scan: ScanOrder,
  perspective: "client" | "designer",
  nameById: NameResolver,
): UnifiedProjectItem {
  const counterpartyName =
    perspective === "client"
      ? nameById(scan.designerId)
      : nameById(scan.clientId);
  const cats = new Set<Exclude<ProjectListCategory, "all">>();
  if (scan.pricingMode === "hourly") {
    if (scan.billingMode === "monthly") cats.add("monthly");
    else cats.add("daily");
  } else {
    cats.add("daily");
  }
  if (scan.serviceMode === "online") cats.add("online");
  else cats.add("onsite");

  const tags = ["扫码下单"];
  if (scan.pricingMode === "fixed") tags.push("按总价");
  else if (scan.billingMode === "monthly") tags.push("按月");
  else tags.push("按工时");
  tags.push(scan.serviceMode === "onsite" ? "线下" : "线上");

  return {
    id: scan.id,
    kind: "scan",
    title: scan.title,
    code: scan.id,
    status: scan.status,
    statusLabel: SCAN_ORDER_STATUS_LABEL[scan.status],
    totalAmount: scan.totalAmount,
    createdAt: scan.createdAt,
    href:
      scan.status === "pending_contract" || scan.status === "pending_prepay"
        ? `/scan-order/contract?id=${scan.id}`
        : perspective === "client"
          ? "/client/orders"
          : "/designer/scan-orders",
    counterpartyName,
    categories: [...cats],
    tags,
    scan,
  };
}

function draftToItem(
  draft: { id: string; designerId: string; createdAt: string; payload: DraftOrderPayload },
  nameById: NameResolver,
): UnifiedProjectItem {
  const designerName = nameById(draft.designerId);
  const cats = new Set<Exclude<ProjectListCategory, "all">>(["daily", "online"]);
  if (draft.payload.billingMode === "monthly") {
    cats.delete("daily");
    cats.add("monthly");
  }
  if (draft.payload.serviceMode === "onsite") {
    cats.delete("online");
    cats.add("onsite");
  }
  const statusLabel =
    draft.payload.status === "pending_schedule"
      ? "待确认档期"
      : draft.payload.status === "pending_contract"
        ? "待签约"
        : draft.payload.status === "rejected"
          ? "档期被拒绝"
          : draft.payload.status;

  return {
    id: draft.id,
    kind: "draft",
    title: draft.payload.title,
    code: draft.id,
    status: draft.payload.status,
    statusLabel,
    totalAmount: draft.payload.totalAmount,
    createdAt: draft.createdAt,
    href: "/client/orders",
    counterpartyName: designerName,
    categories: [...cats],
    tags: ["定向下单", draft.payload.billingMode === "monthly" ? "按月" : "按工时", draft.payload.serviceMode === "onsite" ? "线下" : "线上"],
  };
}

function draftBountyToItem(draft: {
  id: string;
  createdAt: string;
  payload: Record<string, unknown>;
}): UnifiedProjectItem {
  const title = String(draft.payload.title ?? "悬赏委托草稿");
  const billing = String(draft.payload.billingMode ?? "");
  const cats: Exclude<ProjectListCategory, "all">[] = ["bounty", "online"];
  if (billing === "area") cats.push("area");
  if (billing === "daily") cats.push("daily");
  if (billing === "monthly") cats.push("monthly");

  const tags = ["悬赏"];
  if (draft.payload.kind === "regular") tags.unshift("常规委托");
  if (billing === "area") tags.push("按面积");
  else if (billing === "monthly") tags.push("按月");
  else if (billing === "daily") tags.push("按工时");
  tags.push("线上");

  const specialty = draft.payload.specialty as Specialty | undefined;

  return {
    id: draft.id,
    kind: "bounty",
    title,
    code: draft.id,
    status: "draft",
    statusLabel: "草稿",
    totalAmount: Number(draft.payload.estimatedTotal ?? draft.payload.reward ?? 0),
    createdAt: draft.createdAt,
    href: "/client/bounties",
    specialty,
    categories: [...new Set(cats)],
    tags,
  };
}

export interface BuildUnifiedListInput {
  perspective: "client" | "designer";
  identityId?: string;
  /** 真实订单数据（来自 API） */
  orders?: Order[];
  /** 真实悬赏数据（来自 API） */
  bounties?: Bounty[];
  /** id → 展示名称解析（设计师 / 委托人） */
  nameById?: NameResolver;
  draftOrders?: Array<{
    id: string;
    designerId: string;
    createdAt: string;
    payload: DraftOrderPayload;
  }>;
  draftBounties?: Array<{ id: string; createdAt: string; payload: Record<string, unknown> }>;
  scanOrders?: ScanOrder[];
  /** 委托人平台订单：排除悬赏及悬赏转化订单 */
  platformOrdersOnly?: boolean;
  /** 委托人我的悬赏：仅悬赏与悬赏草稿 */
  bountiesOnly?: boolean;
}

export function buildUnifiedProjectList(input: BuildUnifiedListInput): UnifiedProjectItem[] {
  const identityId = input.identityId || "";
  const orders = input.orders ?? [];
  const bounties = input.bounties ?? [];
  const nameById: NameResolver = input.nameById ?? (() => undefined);
  const items: UnifiedProjectItem[] = [];

  if (input.perspective === "client" && input.bountiesOnly) {
    for (const b of bounties.filter((x) => x.publisherId === identityId)) {
      items.push(bountyToItem(b, "client"));
    }
    for (const d of input.draftBounties ?? []) {
      items.push(draftBountyToItem(d));
    }
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  if (input.perspective === "client") {
    const clientOrders = orders.filter((x) => x.clientId === identityId);
    for (const o of clientOrders) {
      if (input.platformOrdersOnly && !isPlatformOrderSource(o)) continue;
      items.push(orderToItem(o, "client", nameById));
    }
    if (!input.platformOrdersOnly) {
      for (const b of bounties.filter((x) => x.publisherId === identityId)) {
        items.push(bountyToItem(b, "client"));
      }
    }
    for (const d of input.draftOrders ?? []) {
      items.push(draftToItem(d, nameById));
    }
    if (!input.platformOrdersOnly) {
      for (const d of input.draftBounties ?? []) {
        items.push(draftBountyToItem(d));
      }
    }
    for (const s of input.scanOrders ?? []) {
      if (s.clientId === identityId) items.push(scanToItem(s, "client", nameById));
    }
  } else {
    for (const o of orders.filter((x) => x.designerId === identityId)) {
      items.push(orderToItem(o, "designer", nameById));
    }
    for (const b of bounties) {
      if (b.applicants.some((a) => a.designerId === identityId)) {
        items.push(bountyToItem(b, "designer"));
      }
    }
    for (const s of input.scanOrders ?? []) {
      if (s.designerId === identityId) items.push(scanToItem(s, "designer", nameById));
    }
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function filterByCategory(
  items: UnifiedProjectItem[],
  category: ProjectListCategory,
): UnifiedProjectItem[] {
  if (category === "all") return items;
  return items.filter((i) => i.categories.includes(category));
}

export function filterByStatus(
  items: UnifiedProjectItem[],
  status: OrderStatus | "all",
): UnifiedProjectItem[] {
  if (status === "all") return items;
  return items.filter((i) => i.kind === "order" && i.status === status);
}

export function filterBySpecialty(
  items: UnifiedProjectItem[],
  specialty: PlatformSpecialtyFilter,
): UnifiedProjectItem[] {
  if (specialty === "all") return items;
  return items.filter((i) => i.specialty === specialty);
}

export function filterByBountyStatus(
  items: UnifiedProjectItem[],
  status: BountyStatusFilter,
): UnifiedProjectItem[] {
  if (status === "all") return items;
  return items.filter((i) => i.status === status);
}

export function bountyStatusCounts(
  items: UnifiedProjectItem[],
): Record<BountyStatusFilter, number> {
  const counts = Object.fromEntries(
    BOUNTY_STATUS_FILTER_TABS.map((t) => [t.value, 0]),
  ) as Record<BountyStatusFilter, number>;
  counts.all = items.length;
  for (const item of items) {
    const key = item.status as BountyStatusFilter;
    if (key !== "all" && key in counts) {
      counts[key] += 1;
    }
  }
  return counts;
}

export function specialtyCounts(
  items: UnifiedProjectItem[],
): Record<PlatformSpecialtyFilter, number> {
  const counts = Object.fromEntries(
    PLATFORM_SPECIALTY_FILTER_TABS.map((t) => [t.value, 0]),
  ) as Record<PlatformSpecialtyFilter, number>;
  counts.all = items.length;
  for (const item of items) {
    if (item.specialty) counts[item.specialty] += 1;
  }
  return counts;
}

export function categoryCounts(
  items: UnifiedProjectItem[],
): Record<ProjectListCategory, number> {
  const counts = Object.fromEntries(
    PROJECT_LIST_CATEGORY_TABS.map((t) => [t.value, 0]),
  ) as Record<ProjectListCategory, number>;
  counts.all = items.length;
  for (const item of items) {
    for (const c of item.categories) {
      counts[c] += 1;
    }
  }
  return counts;
}
