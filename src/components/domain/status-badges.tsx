import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_META,
  WORKLOAD_META,
  SPECIALTIES,
} from "@/lib/constants";
import type {
  OnlineStatus,
  Order,
  OrderStatus,
  Specialty,
  WorkloadStatus,
} from "@/lib/types";
import { resolveDisplayOrderStatus } from "@/lib/order-lifecycle";
import { needsClientReview } from "@/lib/client-review";
import { isAwaitingClientPaymentOrder, needsCsQuoteConfirm } from "@/lib/order-supervision";
import { scanQuoteStatusLabel } from "@/lib/scan-order";
import { cn } from "@/lib/utils";

export function OnlineDot({ status }: { status: OnlineStatus }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        status === "online" ? "bg-emerald-500" : "bg-ink-40",
      )}
    />
  );
}

/** 设计师是否开启接单（acceptingOrders 缺省视为正常接单） */
export function AcceptingOrdersBadge({
  accepting,
  className,
  /** overlay：卡片封面半透明白底；solid：实色更醒目（主页姓名旁） */
  tone = "overlay",
}: {
  accepting?: boolean;
  className?: string;
  tone?: "overlay" | "solid";
}) {
  const on = accepting !== false;
  return (
    <Badge
      variant={tone === "solid" ? (on ? "emerald" : "amber") : "default"}
      className={cn(
        "gap-1.5",
        tone === "overlay" && "bg-white/90 text-ink",
        tone === "solid" && "px-2.5 py-1 text-xs font-semibold",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full",
          tone === "solid" ? "h-2 w-2" : "h-1.5 w-1.5",
          on ? "bg-emerald-500" : "bg-amber-500",
          tone === "solid" && on && "bg-emerald-700",
          tone === "solid" && !on && "bg-amber-700",
        )}
      />
      {on ? "正常接单" : "暂停接单"}
    </Badge>
  );
}

export function WorkloadBadge({ status }: { status: WorkloadStatus }) {
  const meta = WORKLOAD_META[status];
  return (
    <Badge variant="outline" className="gap-1.5">
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", meta.color)} />
      {meta.label}
    </Badge>
  );
}

const ORDER_VARIANT_MAP = {
  pending_quote: "amber",
  matching: "muted",
  pending_designer_accept: "blue",
  pending_schedule: "blue",
  pending_contract: "amber",
  in_progress: "brand",
  pending_review: "blue",
  in_revision: "violet",
  completed: "emerald",
  terminated: "rose",
  cancelled: "muted",
} as const;

export function OrderStatusBadge({
  status,
  label,
  order,
}: {
  status?: OrderStatus;
  label?: string;
  order?: Pick<
    Order,
    | "status"
    | "clientSignedContract"
    | "designerSignedContract"
    | "clientReviewed"
    | "reviewExpired"
    | "reviewDeadlineAt"
    | "settlementConfirmedAt"
    | "stages"
    | "orderSource"
    | "scanQuoteProposedAt"
    | "scanQuoteLastActor"
    | "selfOrderPendingClaim"
    | "clientId"
    | "levelQuotes"
    | "quote"
    | "csQuoteConfirmedAt"
  >;
}) {
  const awaitingReview = !!order && needsClientReview(order as Order);
  const resolved = order
    ? resolveDisplayOrderStatus(order)
    : (status as OrderStatus);
  const scanLabel = order ? scanQuoteStatusLabel(order) : null;
  const paymentAlsoShown =
    !!order &&
    "stages" in order &&
    Array.isArray(order.stages) &&
    isAwaitingClientPaymentOrder(order as Order);
  const deemphasizeInProgress =
    paymentAlsoShown && resolved === "in_progress";
  const variant = awaitingReview
    ? "amber"
    : deemphasizeInProgress
      ? "amber"
      : ORDER_VARIANT_MAP[resolved];
  const statusText =
    label ??
    (awaitingReview
      ? "待评价"
      : scanLabel ??
        (order && needsCsQuoteConfirm(order)
          ? "待客服确认报价"
          : ORDER_STATUS_META[resolved].label));
  const showAwaitingMatch =
    !!order &&
    needsCsQuoteConfirm(order) &&
    statusText !== "待匹配";
  return (
    <>
      <Badge
        variant={variant as any}
        className={deemphasizeInProgress ? "bg-amber-100 text-ink" : undefined}
      >
        {statusText}
      </Badge>
      {showAwaitingMatch ? (
        <Badge variant="muted">待匹配</Badge>
      ) : null}
    </>
  );
}

export function AwaitingClientPaymentBadge({
  perspective = "client",
}: {
  perspective?: "client" | "designer" | "admin";
}) {
  return (
    <Badge variant="brand">
      {perspective === "designer" ? "待委托人支付" : "待支付"}
    </Badge>
  );
}

export function SpecialtyBadge({ specialty }: { specialty: Specialty }) {
  const meta = SPECIALTIES.find((s) => s.value === specialty)!;
  return <Badge variant="outline">{meta.label}</Badge>;
}
