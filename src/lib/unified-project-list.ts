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
import { isContractFullySigned, resolveDisplayOrderStatus } from "@/lib/order-lifecycle";
import { needsClientReview } from "@/lib/client-review";
import {
  isAwaitingClientPaymentOrder,
  isAwaitingClientSignOrder,
  isAwaitingDesignerSignOrder,
  isAwaitingReviewOrder,
  isInProgressSupervisionOrder,
  isInRevisionSupervisionOrder,
} from "@/lib/order-supervision";
import { maskDesignerPublicName } from "@/lib/designer-contact-privacy";
import { bountyDesignerTakeHomeFromBounty } from "@/lib/bounty-invoice";
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

/** 委托人常规订单页：不含悬赏、常规面积分类 */
export const CLIENT_PLATFORM_CATEGORY_TABS =
  PROJECT_LIST_CATEGORY_TABS.filter(
    (t) => t.value !== "bounty" && t.value !== "area",
  );

export type PlatformSpecialtyFilter = Specialty | "all";

/** 常规订单 · 一级专业筛选 */
export const PLATFORM_SPECIALTY_FILTER_TABS: {
  value: PlatformSpecialtyFilter;
  label: string;
}[] = [
  { value: "all", label: "全部专业" },
  ...SPECIALTIES.map((s) => ({ value: s.value, label: s.label })),
];

export function isPlatformOrderSource(order: Order): boolean {
  return !isBountySourcedOrder(order);
}

export function isDirectedOrderSource(
  order: Pick<Order, "orderSource" | "bountyId">,
): boolean {
  return order.orderSource === "directed" || order.orderSource === "scan";
}

export function isBountySourcedOrder(
  order: Pick<Order, "bountyId" | "orderSource">,
): boolean {
  if (order.bountyId) return true;
  return order.orderSource === "bounty";
}

/** 委托人打开订单详情：悬赏履约留在「我的悬赏」 */
export function clientOrderDetailHref(
  order: Pick<Order, "id" | "bountyId" | "orderSource">,
): string {
  if (isBountySourcedOrder(order) && order.bountyId) {
    return `/client/bounties/${order.bountyId}`;
  }
  return `/client/orders/${order.id}`;
}

/** 委托人订单详情返回列表 */
export function clientOrderListNav(
  order: Pick<Order, "bountyId" | "orderSource">,
): { href: string; label: string } {
  if (isBountySourcedOrder(order) && order.bountyId) {
    return { href: "/client/bounties", label: "返回我的悬赏" };
  }
  if (isDirectedOrderSource(order)) {
    return { href: "/client/directed-orders", label: "返回定向下单" };
  }
  return { href: "/client/orders", label: "返回常规订单" };
}

export function isPlatformProjectItem(item: UnifiedProjectItem): boolean {
  if (item.kind === "bounty") return false;
  if (item.kind === "draft") return false;
  if (item.order && !isPlatformOrderSource(item.order)) return false;
  if (item.order && isDirectedOrderSource(item.order)) return false;
  return true;
}

export function isDirectedProjectItem(item: UnifiedProjectItem): boolean {
  if (item.kind === "draft") return true;
  if (item.kind === "scan") return true;
  if (item.order) return isDirectedOrderSource(item.order);
  return false;
}

/** 设计师平台项目：常规接单，不含悬赏、主页定向下单与扫码下单 */
export function isDesignerPlatformProjectItem(item: UnifiedProjectItem): boolean {
  if (item.kind === "bounty" || item.kind === "scan" || item.kind === "draft") {
    return false;
  }
  if (item.order && isDirectedOrderSource(item.order)) return false;
  if (item.order && isBountySourcedOrder(item.order)) return false;
  return item.kind === "order";
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
  /** 设计师看悬赏时：实际到手金额（主金额为委托金额） */
  takeHomeAmount?: number;
  createdAt: string;
  href: string;
  specialty?: Specialty;
  counterpartyName?: string;
  categories: Exclude<ProjectListCategory, "all">[];
  tags: string[];
  order?: Order;
  scan?: import("@/lib/scan-order").ScanOrder;
  alreadyApplied?: boolean;
  bountyWon?: boolean;
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

function clientFacingDesignerName(
  name: string | undefined,
  revealFullName: boolean,
): string | undefined {
  if (!name) return name;
  return revealFullName ? name : maskDesignerPublicName(name);
}

function orderToItem(
  order: Order,
  perspective: "client" | "designer",
  nameById: NameResolver,
): UnifiedProjectItem {
  const counterpartyName =
    perspective === "client"
      ? clientFacingDesignerName(
          nameById(order.designerId),
          isContractFullySigned(order),
        )
      : nameById(order.clientId);
  const displayStatus = resolveDisplayOrderStatus(order);
  return {
    id: order.id,
    kind: "order",
    title: order.title,
    code: order.code,
    status: displayStatus,
    statusLabel:
      perspective === "designer"
        ? (DESIGNER_ORDER_STATUS_LABEL[displayStatus] ??
          ORDER_STATUS_META[displayStatus]?.label ??
          order.status)
        : (ORDER_STATUS_META[displayStatus]?.label ?? order.status),
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    href:
      perspective === "client"
        ? clientOrderDetailHref(order)
        : `/designer/orders/${order.id}`,
    specialty: order.specialty,
    counterpartyName,
    categories: resolveOrderCategories(order),
    tags: orderDisplayTags(order),
    order,
  };
}

function designerAppliedBountyStatusLabel(
  bounty: Bounty,
  designerId?: string,
): string {
  if (
    bounty.status === "open" ||
    bounty.status === "in_review" ||
    bounty.status === "paused"
  ) {
    return "待委托人确认";
  }
  if (bounty.status === "awarded") {
    return designerId && bounty.awardedDesignerId === designerId
      ? "已中选"
      : "未中选";
  }
  if (bounty.status === "completed") return "已完成";
  if (bounty.status === "closed") return "已取消";
  return bountyStatusLabel(bounty.status);
}

function bountyToItem(
  bounty: Bounty,
  perspective: "client" | "designer" = "client",
  alreadyApplied = false,
  designerId?: string,
  order?: Order,
): UnifiedProjectItem {
  const trackLabels = getTrackLabelParts(bounty.primaryTrack);
  const bountyWon = Boolean(
    designerId && bounty.awardedDesignerId === designerId,
  );
  return {
    id: bounty.id,
    kind: "bounty",
    title: bounty.title,
    code: bounty.code,
    status: bounty.status,
    statusLabel:
      perspective === "designer" && alreadyApplied
        ? designerAppliedBountyStatusLabel(bounty, designerId)
        : bountyStatusLabel(bounty.status),
    totalAmount: bounty.reward,
    takeHomeAmount:
      perspective === "designer"
        ? bountyDesignerTakeHomeFromBounty(bounty)
        : undefined,
    createdAt: bounty.publishedAt,
    href:
      perspective === "client"
        ? `/client/bounties/${bounty.id}`
        : `/bounties/${bounty.id}`,
    specialty: bounty.specialty,
    categories: ["bounty", "online"],
    alreadyApplied,
    bountyWon,
    order,
    tags: [
      "悬赏",
      alreadyApplied ? "已报名" : "",
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
      ? clientFacingDesignerName(
          nameById(scan.designerId),
          scan.signedByClient && scan.signedByDesigner,
        )
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
          : "/designer/directed-orders",
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
      ? "待确认匹配"
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
    href: "/client/directed-orders",
    counterpartyName: clientFacingDesignerName(designerName, false),
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
  /** 委托人常规订单：排除悬赏、定向下单及悬赏转化订单 */
  platformOrdersOnly?: boolean;
  /** 委托人定向下单：仅定向委托与定向草稿 */
  directedOrdersOnly?: boolean;
  /** 委托人我的悬赏 / 设计师已报名悬赏订单 */
  bountiesOnly?: boolean;
}

export function buildUnifiedProjectList(input: BuildUnifiedListInput): UnifiedProjectItem[] {
  const identityId = input.identityId || "";
  const orders = input.orders ?? [];
  const bounties = input.bounties ?? [];
  const nameById: NameResolver = input.nameById ?? (() => undefined);
  const items: UnifiedProjectItem[] = [];

  if (input.perspective === "designer" && input.bountiesOnly) {
    const awardedBountyIds = new Set<string>();
    for (const o of orders) {
      const mine =
        o.designerId === identityId ||
        (o.trackAssignments ?? []).some((a) => a.designerId === identityId);
      if (!mine || !isBountySourcedOrder(o)) continue;
      items.push(orderToItem(o, "designer", nameById));
      if (o.bountyId) awardedBountyIds.add(o.bountyId);
    }
    for (const b of bounties) {
      const applied = b.applicants.some((a) => a.designerId === identityId);
      if (!applied) continue;
      if (awardedBountyIds.has(b.id)) continue;
      items.push(bountyToItem(b, "designer", true, identityId));
    }
    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  if (input.perspective === "client" && input.bountiesOnly) {
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const orderByBountyId = new Map<string, Order>();
    for (const o of orders) {
      if (o.bountyId) orderByBountyId.set(o.bountyId, o);
    }
    for (const b of bounties.filter((x) => x.publisherId === identityId)) {
      const linked =
        (b.orderId ? orderById.get(b.orderId) : undefined) ??
        orderByBountyId.get(b.id);
      items.push(bountyToItem(b, "client", false, undefined, linked));
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
      if (input.platformOrdersOnly && isDirectedOrderSource(o)) continue;
      if (input.directedOrdersOnly && !isDirectedOrderSource(o)) continue;
      items.push(orderToItem(o, "client", nameById));
    }
    if (!input.platformOrdersOnly && !input.directedOrdersOnly) {
      for (const b of bounties.filter((x) => x.publisherId === identityId)) {
        items.push(bountyToItem(b, "client"));
      }
    }
    if (input.directedOrdersOnly || (!input.platformOrdersOnly && !input.bountiesOnly)) {
      for (const d of input.draftOrders ?? []) {
        items.push(draftToItem(d, nameById));
      }
    }
    if (!input.platformOrdersOnly && !input.directedOrdersOnly) {
      for (const d of input.draftBounties ?? []) {
        items.push(draftBountyToItem(d));
      }
    }
    for (const s of input.scanOrders ?? []) {
      if (s.clientId === identityId && !input.directedOrdersOnly) {
        items.push(scanToItem(s, "client", nameById));
      }
    }
  } else {
    const designerOrders = orders.filter(
      (x) =>
        x.designerId === identityId ||
        (x.trackAssignments ?? []).some((a) => a.designerId === identityId),
    );
    for (const o of designerOrders) {
      if (input.platformOrdersOnly && isDirectedOrderSource(o)) continue;
      if (input.directedOrdersOnly && !isDirectedOrderSource(o)) continue;
      items.push(orderToItem(o, "designer", nameById));
    }
    if (!input.directedOrdersOnly) {
      for (const b of bounties) {
        if (b.applicants.some((a) => a.designerId === identityId)) {
          items.push(bountyToItem(b, "designer", true, identityId));
        }
      }
    }
    if (!input.directedOrdersOnly) {
      for (const s of input.scanOrders ?? []) {
        if (s.designerId === identityId) items.push(scanToItem(s, "designer", nameById));
      }
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

function itemMatchesClientBountyStatus(
  item: UnifiedProjectItem,
  status: BountyStatusFilter,
): boolean {
  if (status === "all") return true;
  if (item.kind === "draft") return false;

  if (status === "open" || status === "in_review" || status === "paused") {
    return item.status === status;
  }

  if (status === "cancelled") {
    return (
      item.status === "closed" ||
      item.status === "cancelled" ||
      item.order?.status === "cancelled"
    );
  }

  const order = item.order;
  if (order) {
    switch (status) {
      case "in_progress":
        return (
          isInProgressSupervisionOrder(order) && !needsClientReview(order)
        );
      case "pending_payment":
        return isAwaitingClientPaymentOrder(order);
      case "pending_client_sign":
        return isAwaitingClientSignOrder(order);
      case "pending_designer_sign":
        return isAwaitingDesignerSignOrder(order);
      case "pending_review":
        return isAwaitingReviewOrder(order);
      case "pending_client_review":
        return needsClientReview(order);
      case "in_revision":
        return isInRevisionSupervisionOrder(order);
      case "completed":
        return order.status === "completed" && !needsClientReview(order);
      default:
        return false;
    }
  }

  if (status === "pending_client_sign") {
    return item.status === "awarded";
  }
  if (status === "completed") {
    return item.status === "completed";
  }
  return false;
}

export function filterByBountyStatus(
  items: UnifiedProjectItem[],
  status: BountyStatusFilter,
): UnifiedProjectItem[] {
  return items.filter((item) => itemMatchesClientBountyStatus(item, status));
}

export function bountyStatusCounts(
  items: UnifiedProjectItem[],
): Record<BountyStatusFilter, number> {
  const counts = Object.fromEntries(
    BOUNTY_STATUS_FILTER_TABS.map((t) => [t.value, 0]),
  ) as Record<BountyStatusFilter, number>;
  for (const tab of BOUNTY_STATUS_FILTER_TABS) {
    counts[tab.value] = filterByBountyStatus(items, tab.value).length;
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
