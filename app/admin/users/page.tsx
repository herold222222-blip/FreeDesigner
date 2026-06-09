"use client";

import { Suspense, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DesignerFiltersPanel } from "@/components/domain/designer-filters-panel";
import { AdminDesignerUserTable } from "@/components/domain/admin-designer-user-table";
import { AdminClientUserTable } from "@/components/domain/admin-client-user-table";
import { PlatformAdminsPanel } from "@/components/domain/platform-admins-panel";
import { isOngoingOrderStatus } from "@/lib/admin-designer-list";
import { useDesignerFilters } from "@/lib/designer-filters";
import {
  useAdminClients,
  useAdminDesigners,
  useOrders,
  usePlatformAdmins,
} from "@/lib/use-data";
import { clientWalletByOwnerId } from "@/mocks/wallet";
import { clients as mockClients } from "@/mocks/clients";
import { designers as mockDesigners } from "@/mocks/designers";
import type { AdminClientRow, AdminDesignerRow } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function sumClientTotalPaid(clientId: string) {
  const txs = clientWalletByOwnerId[clientId] ?? [];
  return Math.abs(
    txs
      .filter((t) => t.type === "income" && t.amount < 0)
      .reduce((acc, t) => acc + t.amount, 0),
  );
}

function AdminUsersInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSuperAdminConsole = pathname.startsWith("/super-admin");
  const defaultTab = searchParams.get("tab") ?? "designers";

  const { data: designersRaw, refresh } = useAdminDesigners();
  const { data: clientsRaw, refresh: refreshClients } = useAdminClients();
  const { data: orders } = useOrders();
  const {
    data: platformAdmins,
    loading: platformAdminsLoading,
    refresh: refreshPlatformAdmins,
  } = usePlatformAdmins(isSuperAdminConsole);

  const designers: AdminDesignerRow[] = useMemo(() => {
    const base =
      designersRaw.length > 0
        ? designersRaw
        : mockDesigners.map((d) => ({
            ...d,
            accountStatus: "active" as const,
            ongoingOrdersCount: 0,
          }));

    if (designersRaw.length > 0) return base;

    const ongoingByDesigner = new Map<string, number>();
    for (const o of orders) {
      if (isOngoingOrderStatus(o.status)) {
        ongoingByDesigner.set(
          o.designerId,
          (ongoingByDesigner.get(o.designerId) ?? 0) + 1,
        );
      }
    }
    return base.map((d, i) => {
      const row = d as AdminDesignerRow;
      return {
        ...row,
        ongoingOrdersCount: ongoingByDesigner.get(row.id) ?? 0,
        registeredAt:
          row.registeredAt ??
          `2025-${String((i % 12) + 1).padStart(2, "0")}-${String(8 + (i % 20)).padStart(2, "0")}`,
      };
    });
  }, [designersRaw, orders]);

  const clients: AdminClientRow[] = useMemo(() => {
    const base =
      clientsRaw.length > 0
        ? clientsRaw
        : mockClients.map((c) => ({
            ...c,
            accountStatus: "active" as const,
            ongoingOrdersCount: 0,
            totalPaidAmount: 0,
          }));

    if (clientsRaw.length > 0) return base;

    const ongoingByClient = new Map<string, number>();
    for (const o of orders) {
      if (isOngoingOrderStatus(o.status)) {
        ongoingByClient.set(
          o.clientId,
          (ongoingByClient.get(o.clientId) ?? 0) + 1,
        );
      }
    }

    return base.map((c) => ({
      ...c,
      ongoingOrdersCount: ongoingByClient.get(c.id) ?? 0,
      totalPaidAmount: sumClientTotalPaid(c.id),
      registeredAt: c.joinedAt,
    }));
  }, [clientsRaw, orders]);

  const { filters, patchFilters, resetFilters, filtered } =
    useDesignerFilters(designers);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          用户管理
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          查看所有设计师与委托人账号，管理状态与权限。
          {isSuperAdminConsole ? "超级管理员还可管理平台管理员账号。" : ""}
          设计师列表支持与「找设计」相同的全部筛选条件。
        </p>
      </div>

      <Tabs defaultValue={defaultTab} key={defaultTab}>
        <TabsList>
          <TabsTrigger value="designers">
            设计师 · {filtered.length}/{designers.length}
          </TabsTrigger>
          <TabsTrigger value="clients">委托人 · {clients.length}</TabsTrigger>
          {isSuperAdminConsole ? (
            <TabsTrigger value="admins">
              管理员 · {platformAdmins.length}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="designers" className="space-y-4">
          <DesignerFiltersPanel
            layout="toolbar"
            sticky={false}
            filters={filters}
            onPatch={patchFilters}
            onReset={resetFilters}
            resultCount={filtered.length}
          />

          <AdminDesignerUserTable
            designers={filtered}
            isSuperAdmin={isSuperAdminConsole}
            onRefresh={refresh}
          />
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <AdminClientUserTable
            clients={clients}
            isSuperAdmin={isSuperAdminConsole}
            onRefresh={refreshClients}
          />
        </TabsContent>

        {isSuperAdminConsole ? (
          <TabsContent value="admins">
            <PlatformAdminsPanel
              admins={platformAdmins}
              loading={platformAdminsLoading}
              refresh={refreshPlatformAdmins}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">加载中…</div>
      }
    >
      <AdminUsersInner />
    </Suspense>
  );
}
