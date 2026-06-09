"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnifiedProjectRow } from "@/components/domain/unified-project-row";
import {
  BOUNTY_STATUS_FILTER_TABS,
  type BountyStatusFilter,
} from "@/lib/bounty-manage";
import {
  CLIENT_ORDER_FOCUS_META,
  filterItemsByClientFocus,
  type ClientOrderFocus,
} from "@/lib/client-order-focus";
import {
  CLIENT_PLATFORM_STATUS_TABS,
  clientStatusCounts,
  filterItemsByClientStatus,
  type ClientOrderStatusFilter,
} from "@/lib/client-order-status-filter";
import {
  DESIGNER_PROJECT_STATUS_TABS,
  DESIGNER_STATUS_TAB_HIGHLIGHT,
  designerStatusCounts,
  filterItemsByDesignerStatus,
  type DesignerOrderStatusFilter,
} from "@/lib/designer-order-status-filter";
import { cn } from "@/lib/utils";
import {
  CLIENT_PLATFORM_CATEGORY_TABS,
  PLATFORM_SPECIALTY_FILTER_TABS,
  PROJECT_LIST_CATEGORY_TABS,
  bountyStatusCounts,
  buildUnifiedProjectList,
  categoryCounts,
  filterByBountyStatus,
  filterByCategory,
  filterBySpecialty,
  filterByStatus,
  isPlatformProjectItem,
  specialtyCounts,
  type PlatformSpecialtyFilter,
  type ProjectListCategory,
} from "@/lib/unified-project-list";
import type { ScanOrder } from "@/lib/scan-order";
import type { OrderStatus } from "@/lib/types";
import type { DraftOrderPayload } from "@/store/session-store";
import { useBounties, useClients, useDesigners, useOrders } from "@/lib/use-data";

type ListStatusFilter = ClientOrderStatusFilter | DesignerOrderStatusFilter;

function designerTabHighlightClass(
  value: DesignerOrderStatusFilter,
  count: number,
): string {
  if (count <= 0 || !DESIGNER_STATUS_TAB_HIGHLIGHT.includes(value)) return "";
  if (value === "pending_revision") {
    return "border-violet-400 bg-violet-50 text-violet-900 ring-1 ring-violet-300 data-[state=active]:border-violet-600 data-[state=active]:bg-violet-600 data-[state=active]:text-white";
  }
  return "border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-300 data-[state=active]:border-amber-600 data-[state=active]:bg-amber-600 data-[state=active]:text-white";
}

export function UnifiedProjectList({
  perspective,
  identityId,
  draftOrders = [],
  draftBounties = [],
  scanOrders = [],
  emptyLabel = "暂无项目",
  initialFocus,
  platformOrdersOnly = false,
  bountiesOnly = false,
}: {
  perspective: "client" | "designer";
  identityId?: string;
  draftOrders?: Array<{
    id: string;
    designerId: string;
    createdAt: string;
    payload: DraftOrderPayload;
  }>;
  draftBounties?: Array<{ id: string; createdAt: string; payload: Record<string, unknown> }>;
  scanOrders?: ScanOrder[];
  emptyLabel?: string;
  initialFocus?: ClientOrderFocus | null;
  /** 委托人平台订单：仅常规委托，不含悬赏 */
  platformOrdersOnly?: boolean;
  /** 委托人我的悬赏：仅悬赏项目 */
  bountiesOnly?: boolean;
}) {
  const [category, setCategory] = useState<ProjectListCategory>("all");
  const [status, setStatus] = useState<ListStatusFilter>("all");
  const useClientPlatformStatus =
    perspective === "client" && platformOrdersOnly && !initialFocus;
  const useDesignerProjectStatus =
    perspective === "designer" && !initialFocus && !bountiesOnly;
  const [bountyStatus, setBountyStatus] = useState<BountyStatusFilter>("all");
  const [specialty, setSpecialty] = useState<PlatformSpecialtyFilter>("all");
  const listFilterMode = platformOrdersOnly || bountiesOnly;
  const focusMeta =
    perspective === "client" && initialFocus
      ? CLIENT_ORDER_FOCUS_META[initialFocus]
      : null;

  const { data: orders, loading: ordersLoading } = useOrders();
  const { data: bounties, loading: bountiesLoading } = useBounties();
  const listLoading = bountiesOnly ? bountiesLoading : ordersLoading;
  const { data: designers } = useDesigners();
  const { data: clients } = useClients();

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of designers) map.set(d.id, d.name);
    for (const c of clients) map.set(c.id, c.name);
    return (id?: string) => (id ? map.get(id) : undefined);
  }, [designers, clients]);

  const categoryTabs =
    listFilterMode ? CLIENT_PLATFORM_CATEGORY_TABS : PROJECT_LIST_CATEGORY_TABS;

  const allItems = useMemo(() => {
    const built = buildUnifiedProjectList({
      perspective,
      identityId,
      orders: bountiesOnly ? [] : orders,
      bounties,
      nameById,
      draftOrders:
        perspective === "client" && !platformOrdersOnly && !bountiesOnly
          ? draftOrders
          : [],
      draftBounties:
        perspective === "client" && (bountiesOnly || !platformOrdersOnly)
          ? draftBounties
          : [],
      scanOrders: bountiesOnly ? [] : scanOrders,
      platformOrdersOnly,
      bountiesOnly,
    });
    if (platformOrdersOnly) return built.filter(isPlatformProjectItem);
    return built;
  }, [
    perspective,
    identityId,
    orders,
    bounties,
    nameById,
    draftOrders,
    draftBounties,
    scanOrders,
    platformOrdersOnly,
    bountiesOnly,
  ]);

  const counts = useMemo(() => categoryCounts(allItems), [allItems]);
  const specialtyCountMap = useMemo(
    () => specialtyCounts(allItems),
    [allItems],
  );
  const bountyStatusCountMap = useMemo(
    () => bountyStatusCounts(allItems),
    [allItems],
  );
  const clientStatusCountMap = useMemo(
    () => clientStatusCounts(allItems),
    [allItems],
  );
  const designerStatusCountMap = useMemo(
    () => designerStatusCounts(allItems),
    [allItems],
  );

  const filtered = useMemo(() => {
    let list = allItems;
    if (perspective === "client" && initialFocus) {
      list = filterItemsByClientFocus(list, initialFocus);
    } else {
      if (!bountiesOnly) {
        list = filterByCategory(list, category);
      }
      if (bountiesOnly) {
        list = filterByBountyStatus(list, bountyStatus);
      } else if (useClientPlatformStatus) {
        list = filterItemsByClientStatus(list, status as ClientOrderStatusFilter);
      } else if (useDesignerProjectStatus) {
        list = filterItemsByDesignerStatus(list, status as DesignerOrderStatusFilter);
      } else if (perspective === "client") {
        list = filterItemsByClientStatus(list, status as ClientOrderStatusFilter);
      } else {
        list = filterByStatus(list, status as OrderStatus | "all");
      }
      if (listFilterMode) {
        list = filterBySpecialty(list, specialty);
      }
    }
    return list;
  }, [
    allItems,
    category,
    status,
    bountyStatus,
    specialty,
    listFilterMode,
    bountiesOnly,
    perspective,
    initialFocus,
    useClientPlatformStatus,
    useDesignerProjectStatus,
  ]);

  const statusTabs = useClientPlatformStatus
    ? CLIENT_PLATFORM_STATUS_TABS
    : useDesignerProjectStatus
      ? DESIGNER_PROJECT_STATUS_TABS
      : CLIENT_PLATFORM_STATUS_TABS;

  return (
    <div className="space-y-5">
      {focusMeta ? (
        <Card className="border-brand/20 bg-brand/5 p-4 text-sm text-ink">
          <div className="font-medium text-ink">{focusMeta.label}</div>
          <p className="mt-1 text-xs text-ink-60">{focusMeta.description}</p>
        </Card>
      ) : null}

      {!initialFocus && !bountiesOnly ? (
      <Tabs value={category} onValueChange={(v) => setCategory(v as ProjectListCategory)}>
        <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
          {categoryTabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="gap-1.5 rounded-full border border-ink-20 bg-white px-3 py-1.5 text-xs data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-white"
            >
              {t.label}
              <span className="rounded-full bg-ink-20/50 px-1.5 py-0 text-[10px] font-medium tabular-nums text-ink-60 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                {counts[t.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      ) : null}

      {!initialFocus && bountiesOnly ? (
        <Tabs
          value={bountyStatus}
          onValueChange={(v) => setBountyStatus(v as BountyStatusFilter)}
        >
          <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
            {BOUNTY_STATUS_FILTER_TABS.map((s) => (
              <TabsTrigger
                key={s.value}
                value={s.value}
                className="gap-1.5 rounded-full border border-ink-20 bg-white px-3 py-1.5 text-xs data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-white"
              >
                {s.label}
                <span className="rounded-full bg-ink-20/50 px-1.5 py-0 text-[10px] font-medium tabular-nums text-ink-60 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {bountyStatusCountMap[s.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      {!initialFocus && !bountiesOnly ? (
      <Tabs
        value={status}
        onValueChange={(v) => setStatus(v as ListStatusFilter)}
      >
        <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
          {statusTabs.map((s) => {
            const designerCount = useDesignerProjectStatus
              ? designerStatusCountMap[s.value as DesignerOrderStatusFilter]
              : 0;
            return (
              <TabsTrigger
                key={s.value}
                value={s.value}
                className={cn(
                  "gap-1.5 rounded-full border border-ink-20 bg-white px-3 py-1.5 text-xs data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-white",
                  useDesignerProjectStatus &&
                    designerTabHighlightClass(
                      s.value as DesignerOrderStatusFilter,
                      designerCount,
                    ),
                )}
              >
                {s.label}
                {useClientPlatformStatus ? (
                  <span className="rounded-full bg-ink-20/50 px-1.5 py-0 text-[10px] font-medium tabular-nums text-ink-60 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                    {clientStatusCountMap[s.value as ClientOrderStatusFilter]}
                  </span>
                ) : null}
                {useDesignerProjectStatus ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 text-[10px] font-medium tabular-nums",
                      DESIGNER_STATUS_TAB_HIGHLIGHT.includes(
                        s.value as DesignerOrderStatusFilter,
                      ) && designerCount > 0
                        ? "bg-amber-200/80 text-amber-900 data-[state=active]:bg-white/25 data-[state=active]:text-white"
                        : "bg-ink-20/50 text-ink-60 data-[state=active]:bg-white/20 data-[state=active]:text-white",
                    )}
                  >
                    {designerCount}
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      ) : null}

      {status === "pending_payment" && filtered.length > 0 ? (
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-amber-950">待支付提醒</div>
              <p className="mt-1 text-xs text-amber-800">
                以下 {filtered.length} 笔订单有待付款项，请尽快完成支付以保障项目进度。
              </p>
            </div>
            <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {filtered.length} 笔待付
            </span>
          </div>
        </Card>
      ) : null}

      {status === "pending_review" && filtered.length > 0 ? (
        <Card className="border-blue-300 bg-gradient-to-br from-blue-50 to-sky-50/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-blue-950">待成果确认</div>
              <p className="mt-1 text-xs text-blue-800">
                以下 {filtered.length} 笔订单设计师已上传成果，请预览确认后解锁下载或付款。
              </p>
            </div>
            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              {filtered.length} 笔待确认
            </span>
          </div>
        </Card>
      ) : null}

      {!initialFocus && listFilterMode ? (
        <Tabs
          value={specialty}
          onValueChange={(v) => setSpecialty(v as PlatformSpecialtyFilter)}
        >
          <TabsList className="flex h-auto flex-wrap gap-1 bg-transparent p-0">
            {PLATFORM_SPECIALTY_FILTER_TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="gap-1.5 rounded-full border border-ink-20 bg-white px-3 py-1.5 text-xs data-[state=active]:border-ink data-[state=active]:bg-ink data-[state=active]:text-white"
              >
                {t.label}
                <span className="rounded-full bg-ink-20/50 px-1.5 py-0 text-[10px] font-medium tabular-nums text-ink-60 data-[state=active]:bg-white/20 data-[state=active]:text-white">
                  {specialtyCountMap[t.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <div className="space-y-4">
        {listLoading && allItems.length === 0 ? (
          <Card className="p-16 text-center text-ink-60">正在加载项目...</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-16 text-center text-ink-60">{emptyLabel}</Card>
        ) : (
          filtered.map((item) => (
            <UnifiedProjectRow
              key={`${item.kind}-${item.id}`}
              item={item}
              perspective={perspective}
              paymentHighlight={status === "pending_payment"}
              reviewHighlight={status === "pending_review"}
            />
          ))
        )}
      </div>
    </div>
  );
}
