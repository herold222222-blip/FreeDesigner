import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_META,
  WORKLOAD_META,
  SPECIALTIES,
} from "@/lib/constants";
import type {
  OnlineStatus,
  OrderStatus,
  Specialty,
  WorkloadStatus,
} from "@/lib/types";
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
  matching: "muted",
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
}: {
  status: OrderStatus;
  label?: string;
}) {
  const variant = ORDER_VARIANT_MAP[status];
  return (
    <Badge variant={variant as any}>
      {label ?? ORDER_STATUS_META[status].label}
    </Badge>
  );
}

export function SpecialtyBadge({ specialty }: { specialty: Specialty }) {
  const meta = SPECIALTIES.find((s) => s.value === specialty)!;
  return <Badge variant="outline">{meta.label}</Badge>;
}
