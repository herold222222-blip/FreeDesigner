"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Snowflake, Trash2, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DesignerCodeCopy } from "@/components/domain/designer-code-copy";
import { AdminPhoneLink } from "@/components/domain/admin-phone-link";
import { AdminClientEditDialog } from "@/components/domain/admin-client-edit-dialog";
import {
  AdminClientFiltersBar,
  type AdminClientTypeFilter,
} from "@/components/domain/admin-client-filters-bar";
import { useConsoleBasePath } from "@/components/layout/console-base-path";
import { splitDesignerLocation } from "@/lib/admin-designer-list";
import {
  buildAdminUsersReturnTo,
  withReturnTo,
} from "@/lib/admin-return-to";
import {
  deleteAdminClientRequest,
  updateAdminClientRequest,
} from "@/lib/api-client";
import { CLIENT_LEVEL_META } from "@/lib/constants";
import type { AdminClientRow, Client, ClientLevel } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";

export function AdminClientUserTable({
  clients,
  isSuperAdmin,
  onRefresh,
}: {
  clients: AdminClientRow[];
  isSuperAdmin: boolean;
  onRefresh: () => void;
}) {
  const base = useConsoleBasePath();
  const usersReturnTo = buildAdminUsersReturnTo(base, "clients");
  const push = useSessionStore((s) => s.pushNotification);
  const [typeFilter, setTypeFilter] = useState<AdminClientTypeFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AdminClientRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminClientRow | null>(null);

  const counts = useMemo(
    () => ({
      all: clients.length,
      individual: clients.filter((c) => c.type === "individual").length,
      enterprise: clients.filter((c) => c.type === "enterprise").length,
    }),
    [clients],
  );

  const rows = useMemo(() => {
    if (typeFilter === "all") return clients;
    return clients.filter((c) => c.type === typeFilter);
  }, [clients, typeFilter]);

  const handleToggleFreeze = async (c: AdminClientRow) => {
    const next = c.accountStatus === "disabled" ? "active" : "disabled";
    setBusyId(c.id);
    try {
      await updateAdminClientRequest(c.id, { accountStatus: next });
      push({
        title:
          next === "disabled" ? `已冻结「${c.name}」` : `已解冻「${c.name}」`,
        variant: "success",
      });
      onRefresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "操作失败",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveEdit = async (payload: {
    name: string;
    phone: string;
    level: ClientLevel;
    client: Client;
  }) => {
    if (!editTarget) return;
    await updateAdminClientRequest(editTarget.id, {
      name: payload.name,
      phone: payload.phone || undefined,
      level: payload.level,
      client: payload.client,
    });
    push({ title: `已更新「${payload.name}」的资料`, variant: "success" });
    onRefresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteAdminClientRequest(deleteTarget.id);
      push({
        title: `已删除委托人「${deleteTarget.name}」`,
        variant: "success",
      });
      setDeleteTarget(null);
      onRefresh();
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "删除失败",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <AdminClientFiltersBar
        value={typeFilter}
        onChange={setTypeFilter}
        counts={counts}
      />

      {rows.length === 0 ? (
        <Card className="p-12 text-center text-sm text-ink-60">
          没有匹配的委托人，请调整筛选条件。
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[7%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="border-b border-ink-20 bg-ink-20/20 text-[10px] uppercase tracking-wider text-ink-40">
              <tr>
                <th className="px-2 py-2.5 text-left">名称</th>
                <th className="px-2 py-2.5 text-left">类型</th>
                <th className="whitespace-nowrap px-2 py-2.5 text-left">
                  注册时间
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-left">
                  等级
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-left">
                  手机号
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-left">
                  编号
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-left">
                  所在地
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-center">
                  进行中订单
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-center">
                  累计支付
                </th>
                <th className="whitespace-nowrap px-2 py-2.5 text-center">
                  操作
                </th>
              </tr>
            </thead>
              <tbody>
                {rows.map((c) => {
                  const frozen = c.accountStatus === "disabled";
                  const ongoing = c.ongoingOrdersCount ?? 0;
                  const totalPaid = c.totalPaidAmount ?? 0;
                  const { province, district } = splitDesignerLocation(c.location);
                  const levelLabel =
                    CLIENT_LEVEL_META[c.level ?? "normal"]?.label ?? "普通客户";
                  const typeLabel = c.type === "enterprise" ? "公司" : "个人";

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-ink-20 last:border-b-0"
                    >
                      <td className="px-2 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={c.avatar} alt={c.name} />
                            <AvatarFallback className="text-[10px]">
                              {c.name.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div
                              className="truncate font-medium text-ink"
                              title={c.name}
                            >
                              {c.name}
                            </div>
                            {frozen ? (
                              <div className="text-[10px] text-amber-700">
                                已冻结
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="truncate text-ink" title={typeLabel}>
                          {typeLabel}
                        </div>
                        {c.type === "enterprise" && c.contactName ? (
                          <div
                            className="truncate text-[10px] text-ink-60"
                            title={c.contactName}
                          >
                            {c.contactName}
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-ink-60">
                        {c.registeredAt
                          ? formatDate(c.registeredAt)
                          : c.joinedAt
                            ? formatDate(c.joinedAt)
                            : "—"}
                      </td>
                      <td
                        className="truncate whitespace-nowrap px-2 py-2.5 text-ink"
                        title={levelLabel}
                      >
                        {levelLabel}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-ink-60">
                        <AdminPhoneLink
                          phone={c.phone}
                          className="!font-sans !text-xs !text-ink-60 hover:!text-ink-60 hover:!no-underline"
                        />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-ink-60">
                        {c.code ? (
                          <DesignerCodeCopy
                            code={c.code}
                            compact
                            className="[&_button]:h-5 [&_button]:w-5 [&_span]:!font-sans [&_span]:!text-[10px] [&_span]:!text-ink-60"
                          />
                        ) : (
                          <span className="text-ink-40">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="leading-tight">
                          <div
                            className="truncate text-ink"
                            title={province}
                          >
                            {province}
                          </div>
                          <div
                            className="truncate text-[10px] text-ink-60"
                            title={district}
                          >
                            {district}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-center">
                        <Link
                          href={withReturnTo(
                            `${base}/orders?clientId=${c.id}&status=ongoing`,
                            usersReturnTo,
                          )}
                          className="font-medium text-brand hover:underline"
                        >
                          {ongoing}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-center">
                        <Link
                          href={withReturnTo(
                            `${base}/clients/${c.id}/payments`,
                            usersReturnTo,
                          )}
                          className="font-medium text-brand hover:underline"
                          title={formatCurrency(totalPaid)}
                        >
                          {formatCurrency(totalPaid)}
                        </Link>
                      </td>
                      <td className="px-1 py-2.5">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={busyId === c.id || !c.userId}
                            title={
                              !c.userId
                                ? "未绑定登录账号"
                                : frozen
                                  ? "解冻"
                                  : "冻结"
                            }
                            onClick={() => handleToggleFreeze(c)}
                          >
                            {frozen ? (
                              <UserCheck className="h-3.5 w-3.5" />
                            ) : (
                              <Snowflake className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            disabled={busyId === c.id}
                            title="编辑"
                            onClick={() => setEditTarget(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isSuperAdmin ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-rose-600 hover:text-rose-700"
                              disabled={busyId === c.id}
                              title="删除"
                              onClick={() => setDeleteTarget(c)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </Card>
      )}

      {editTarget ? (
        <AdminClientEditDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          client={editTarget}
          onSave={handleSaveEdit}
        />
      ) : null}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除委托人</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-60">
            确定删除委托人「
            <strong className="text-ink">{deleteTarget?.name}</strong>
            」及其登录账号？该操作不可恢复。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={busyId === deleteTarget?.id}
              onClick={handleDelete}
            >
              {busyId === deleteTarget?.id ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
