import { isOrderPaymentOverdue } from "@/lib/order-payment-overdue";
import {
  ADMIN_DEFAULT_TAB_PRIORITY,
  adminClientAllSortRank,
  compareByCreatedAtDesc,
  isActiveSupervisionOrderWithClientReview,
  isAwaitingClientPaymentOrder,
  isAwaitingClientSignOrder,
  isAwaitingDesignerSignOrder,
  isAwaitingMatchOrder,
  isAwaitingReviewOrder,
  isInProgressSupervisionOrder,
  isInRevisionSupervisionOrder,
  isMatchingInProgressOrder,
  type OrderSupervisionStatus,
} from "@/lib/order-supervision";
import { isAwaitingClientReviewOrder } from "@/lib/client-review";
import type { Client, Designer, Order, Specialty } from "@/lib/types";

export type AdminOrderStatusFilter = OrderSupervisionStatus | "payment_overdue";

export type AdminOrderSpecialtyFilter = Specialty | "all";

export type AdminOrderTypeFilter = "all" | "regular" | "bounty";

export const ADMIN_ORDER_TYPE_FILTERS: {
  value: AdminOrderTypeFilter;
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "regular", label: "常规委托" },
  { value: "bounty", label: "悬赏委托" },
];

export function isBountyEntrustOrder(order: Order): boolean {
  return order.orderSource === "bounty" || Boolean(order.bountyId);
}

export const ADMIN_ORDER_SPECIALTY_FILTERS: {
  value: Exclude<AdminOrderSpecialtyFilter, "all">;
  label: string;
}[] = [
  { value: "architecture", label: "建筑设计" },
  { value: "landscape", label: "景观设计" },
  { value: "interior", label: "室内设计" },
];

/** 订单监管 Tab 展示顺序 */
export const ADMIN_ORDER_STATUS_FILTERS: {
  value: AdminOrderStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "in_progress", label: "进行中" },
  { value: "pending_payment", label: "待支付" },
  { value: "awaiting_match", label: "待匹配" },
  { value: "matching", label: "匹配中" },
  { value: "pending_client_sign", label: "待委托人签约" },
  { value: "pending_review", label: "待成果确认" },
  { value: "pending_client_review", label: "待委托人评价" },
  { value: "pending_designer_sign", label: "待设计师签约" },
  { value: "in_revision", label: "返修中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

export { ADMIN_DEFAULT_TAB_PRIORITY };

export function orderContractSearchLabel(order: Order): string {
  return `乐自由工程设计服务合同 ${order.contractId}`;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

export function buildAdminOrderPartyIndex(
  designers: Designer[],
  clients: Client[],
) {
  const designerById = new Map(designers.map((d) => [d.id, d]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  return { designerById, clientById };
}

function matchesAdminOrderSearch(
  order: Order,
  q: string,
  partyIndex: ReturnType<typeof buildAdminOrderPartyIndex>,
) {
  if (!q) return true;

  const designer = partyIndex.designerById.get(order.designerId);
  const client = partyIndex.clientById.get(order.clientId);
  const contractLabel = orderContractSearchLabel(order);

  const haystack = [
    order.id,
    order.code,
    order.title,
    order.contractId,
    contractLabel,
    designer?.name,
    designer?.phone,
    client?.name,
    client?.companyName,
    client?.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function matchesAdminStatus(
  order: Order,
  statusFilter: AdminOrderStatusFilter,
): boolean {
  switch (statusFilter) {
    case "all":
      return isActiveSupervisionOrderWithClientReview(order);
    case "payment_overdue":
      return (
        order.status !== "cancelled" &&
        order.status !== "terminated" &&
        isOrderPaymentOverdue(order)
      );
    case "in_progress":
      return (
        isInProgressSupervisionOrder(order) &&
        !isAwaitingClientReviewOrder(order)
      );
    case "pending_payment":
      return isAwaitingClientPaymentOrder(order);
    case "awaiting_match":
      return isAwaitingMatchOrder(order);
    case "matching":
      return isMatchingInProgressOrder(order);
    case "pending_client_sign":
      return isAwaitingClientSignOrder(order);
    case "pending_designer_sign":
      return isAwaitingDesignerSignOrder(order);
    case "pending_review":
      return isAwaitingReviewOrder(order);
    case "pending_client_review":
      return isAwaitingClientReviewOrder(order);
    case "in_revision":
      return isInRevisionSupervisionOrder(order);
    case "completed":
      return order.status === "completed" && !isAwaitingClientReviewOrder(order);
    case "cancelled":
      return order.status === "cancelled";
    default:
      return false;
  }
}

function matchesAdminType(
  order: Order,
  typeFilter: AdminOrderTypeFilter,
): boolean {
  if (typeFilter === "all") return true;
  const isBounty = isBountyEntrustOrder(order);
  return typeFilter === "bounty" ? isBounty : !isBounty;
}

export function filterAdminOrders(
  orders: Order[],
  query: string,
  statusFilter: AdminOrderStatusFilter,
  specialtyFilter: AdminOrderSpecialtyFilter,
  partyIndex: ReturnType<typeof buildAdminOrderPartyIndex>,
  designerId?: string,
  clientId?: string,
  typeFilter: AdminOrderTypeFilter = "all",
): Order[] {
  const q = normalizeSearchText(query);

  const list = orders.filter((order) => {
    if (designerId && order.designerId !== designerId) {
      return false;
    }
    if (clientId && order.clientId !== clientId) {
      return false;
    }
    if (!matchesAdminType(order, typeFilter)) return false;
    if (!matchesAdminStatus(order, statusFilter)) return false;
    if (specialtyFilter !== "all" && order.specialty !== specialtyFilter) {
      return false;
    }
    return matchesAdminOrderSearch(order, q, partyIndex);
  });

  if (statusFilter === "all") {
    return list.sort((a, b) => {
      const rank = adminClientAllSortRank(a) - adminClientAllSortRank(b);
      if (rank !== 0) return rank;
      return compareByCreatedAtDesc(a, b);
    });
  }
  return list;
}

export function countAdminOrdersByStatus(
  orders: Order[],
  query: string,
  specialtyFilter: AdminOrderSpecialtyFilter,
  partyIndex: ReturnType<typeof buildAdminOrderPartyIndex>,
  typeFilter: AdminOrderTypeFilter = "all",
): Record<AdminOrderStatusFilter, number> {
  const keys = [
    ...ADMIN_ORDER_STATUS_FILTERS.map((item) => item.value),
    "payment_overdue" as const,
  ];
  return keys.reduce(
    (acc, value) => {
      acc[value] = filterAdminOrders(
        orders,
        query,
        value,
        specialtyFilter,
        partyIndex,
        undefined,
        undefined,
        typeFilter,
      ).length;
      return acc;
    },
    {} as Record<AdminOrderStatusFilter, number>,
  );
}

const LEGACY_STATUS_MAP: Record<string, AdminOrderStatusFilter> = {
  pending_quote: "awaiting_match",
  pending_designer_accept: "matching",
  pending_schedule: "matching",
  pending_contract: "pending_client_sign",
  ongoing: "in_progress",
};

export function parseAdminOrderStatusParam(
  value: string | null,
): AdminOrderStatusFilter {
  if (!value) return "all";
  if (value === "payment_overdue") return "payment_overdue";
  if (LEGACY_STATUS_MAP[value]) return LEGACY_STATUS_MAP[value];
  return ADMIN_ORDER_STATUS_FILTERS.some((item) => item.value === value)
    ? (value as AdminOrderStatusFilter)
    : "all";
}

export function countAdminOrdersBySpecialty(
  orders: Order[],
  query: string,
  statusFilter: AdminOrderStatusFilter,
  partyIndex: ReturnType<typeof buildAdminOrderPartyIndex>,
  typeFilter: AdminOrderTypeFilter = "all",
): Record<Exclude<AdminOrderSpecialtyFilter, "all">, number> {
  return ADMIN_ORDER_SPECIALTY_FILTERS.reduce(
    (acc, item) => {
      acc[item.value] = filterAdminOrders(
        orders,
        query,
        statusFilter,
        item.value,
        partyIndex,
        undefined,
        undefined,
        typeFilter,
      ).length;
      return acc;
    },
    {} as Record<Exclude<AdminOrderSpecialtyFilter, "all">, number>,
  );
}

export function countAdminOrdersByType(
  orders: Order[],
  query: string,
  statusFilter: AdminOrderStatusFilter,
  specialtyFilter: AdminOrderSpecialtyFilter,
  partyIndex: ReturnType<typeof buildAdminOrderPartyIndex>,
): Record<AdminOrderTypeFilter, number> {
  return ADMIN_ORDER_TYPE_FILTERS.reduce(
    (acc, item) => {
      acc[item.value] = filterAdminOrders(
        orders,
        query,
        statusFilter,
        specialtyFilter,
        partyIndex,
        undefined,
        undefined,
        item.value,
      ).length;
      return acc;
    },
    {} as Record<AdminOrderTypeFilter, number>,
  );
}
