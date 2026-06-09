import { isOngoingOrderStatus } from "@/lib/admin-designer-list";
import { isOrderPaymentOverdue } from "@/lib/order-payment-overdue";
import type { Client, Designer, Order, OrderStatus, Specialty } from "@/lib/types";

export type AdminOrderStatusFilter =
  | OrderStatus
  | "all"
  | "payment_overdue"
  | "ongoing";

export type AdminOrderSpecialtyFilter = Specialty | "all";

export const ADMIN_ORDER_SPECIALTY_FILTERS: {
  value: Exclude<AdminOrderSpecialtyFilter, "all">;
  label: string;
}[] = [
  { value: "architecture", label: "建筑设计" },
  { value: "landscape", label: "景观设计" },
  { value: "interior", label: "室内设计" },
];

export const ADMIN_ORDER_STATUS_FILTERS: {
  value: AdminOrderStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "ongoing", label: "进行中订单" },
  { value: "payment_overdue", label: "超时订单" },
  { value: "matching", label: "待匹配" },
  { value: "pending_contract", label: "待签约" },
  { value: "in_progress", label: "进行中" },
  { value: "pending_review", label: "待成果确认" },
  { value: "in_revision", label: "返修中" },
  { value: "completed", label: "已完成" },
  { value: "terminated", label: "已终止" },
  { value: "cancelled", label: "已取消" },
];

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

export function filterAdminOrders(
  orders: Order[],
  query: string,
  statusFilter: AdminOrderStatusFilter,
  specialtyFilter: AdminOrderSpecialtyFilter,
  partyIndex: ReturnType<typeof buildAdminOrderPartyIndex>,
  designerId?: string,
  clientId?: string,
): Order[] {
  const q = normalizeSearchText(query);

  return orders.filter((order) => {
    if (designerId && order.designerId !== designerId) {
      return false;
    }
    if (clientId && order.clientId !== clientId) {
      return false;
    }
    if (statusFilter === "payment_overdue") {
      if (!isOrderPaymentOverdue(order)) return false;
    } else if (statusFilter === "ongoing") {
      if (!isOngoingOrderStatus(order.status)) return false;
    } else if (statusFilter !== "all" && order.status !== statusFilter) {
      return false;
    }
    if (specialtyFilter !== "all" && order.specialty !== specialtyFilter) {
      return false;
    }
    return matchesAdminOrderSearch(order, q, partyIndex);
  });
}

export function countAdminOrdersByStatus(
  orders: Order[],
  query: string,
  specialtyFilter: AdminOrderSpecialtyFilter,
  partyIndex: ReturnType<typeof buildAdminOrderPartyIndex>,
): Record<AdminOrderStatusFilter, number> {
  return ADMIN_ORDER_STATUS_FILTERS.reduce(
    (acc, item) => {
      acc[item.value] = filterAdminOrders(
        orders,
        query,
        item.value,
        specialtyFilter,
        partyIndex,
      ).length;
      return acc;
    },
    {} as Record<AdminOrderStatusFilter, number>,
  );
}

export function parseAdminOrderStatusParam(
  value: string | null,
): AdminOrderStatusFilter {
  if (!value) return "all";
  return ADMIN_ORDER_STATUS_FILTERS.some((item) => item.value === value)
    ? (value as AdminOrderStatusFilter)
    : "all";
}

export function countAdminOrdersBySpecialty(
  orders: Order[],
  query: string,
  statusFilter: AdminOrderStatusFilter,
  partyIndex: ReturnType<typeof buildAdminOrderPartyIndex>,
): Record<Exclude<AdminOrderSpecialtyFilter, "all">, number> {
  return ADMIN_ORDER_SPECIALTY_FILTERS.reduce(
    (acc, item) => {
      acc[item.value] = filterAdminOrders(
        orders,
        query,
        statusFilter,
        item.value,
        partyIndex,
      ).length;
      return acc;
    },
    {} as Record<Exclude<AdminOrderSpecialtyFilter, "all">, number>,
  );
}
