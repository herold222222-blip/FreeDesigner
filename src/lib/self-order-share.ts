/** 设计师自己下单、待委托人认领时的占位 clientId（不对应真实委托人） */
export const SELF_ORDER_PENDING_CLIENT_ID = "client_self_order_pending";

export function isSelfOrderPendingClaim(
  order: {
    selfOrderPendingClaim?: boolean;
    clientId?: string;
  } | null | undefined,
): boolean {
  if (!order) return false;
  return (
    order.selfOrderPendingClaim === true ||
    order.clientId === SELF_ORDER_PENDING_CLIENT_ID
  );
}

export interface SelfOrderShare {
  code: string;
  shareId: string;
  url: string;
}

export interface SelfOrderShareStage {
  name: string;
  ratio: number;
  amount: number;
  note?: string;
}

export interface SelfOrderShareView {
  shareId: string;
  confirmed: boolean;
  canConfirm: boolean;
  order: {
    id: string;
    code: string;
    title: string;
    projectType: string;
    billingMode: string;
    serviceMode: string;
    expectedDeliveryAt?: string;
    specialty?: string;
    description?: string;
    totalAmount: number;
    projectAreaSqm?: number;
  };
  designer: {
    id: string;
    name: string;
    avatar?: string | null;
  };
  stages: SelfOrderShareStage[];
}

export function buildSelfOrderShareUrl(shareId: string, origin = "") {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/confirm-self-order/${shareId}`;
}
