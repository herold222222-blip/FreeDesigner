import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderRow } from "@/components/domain/order-row";
import type { UnifiedProjectItem } from "@/lib/unified-project-list";
import { ProjectIdCopy } from "@/components/domain/project-id-copy";
import { SpecialtyBadge } from "@/components/domain/status-badges";
import { isProjectId } from "@/lib/project-id";
import { ArrowRight, Coins, User2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export function UnifiedProjectRow({
  item,
  perspective,
  paymentHighlight = false,
  reviewHighlight = false,
}: {
  item: UnifiedProjectItem;
  perspective: "client" | "designer";
  paymentHighlight?: boolean;
  reviewHighlight?: boolean;
}) {
  if (item.order) {
    return (
      <OrderRow
        order={item.order}
        href={item.href}
        perspective={perspective}
        tags={item.tags}
        paymentHighlight={paymentHighlight}
        reviewHighlight={reviewHighlight}
      />
    );
  }

  return (
    <Card className="p-5 transition-all hover:border-ink hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {item.specialty ? <SpecialtyBadge specialty={item.specialty} /> : null}
            <Badge variant="muted">{item.statusLabel}</Badge>
            {item.tags.map((t) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t}
              </Badge>
            ))}
            {isProjectId(item.code) ? (
              <ProjectIdCopy code={item.code} compact />
            ) : (
              <span className="text-xs text-ink-40">{item.code}</span>
            )}
          </div>
          <Link href={item.href} className="block">
            <h3 className="text-base font-semibold leading-snug text-ink hover:text-brand">
              {item.title}
            </h3>
          </Link>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-60">
            {item.counterpartyName ? (
              <span className="inline-flex items-center gap-1.5">
                <User2 className="h-3.5 w-3.5" />
                {item.counterpartyName}
              </span>
            ) : null}
            {item.totalAmount > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5" />
                {formatCurrency(item.totalAmount)}
              </span>
            ) : (
              <span className="text-ink-40">面议 / 待确认</span>
            )}
            <span>创建 {formatDate(item.createdAt)}</span>
          </div>
        </div>
        <Link
          href={item.href}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:gap-2 transition-all"
        >
          查看详情 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
