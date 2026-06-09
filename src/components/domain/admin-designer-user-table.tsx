"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Snowflake, Star, Trash2, UserCheck } from "lucide-react";
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
import { ActivityDot } from "@/components/domain/activity-dot";
import { OnlineDot } from "@/components/domain/status-badges";
import { DesignerCodeCopy } from "@/components/domain/designer-code-copy";
import { AdminPhoneLink } from "@/components/domain/admin-phone-link";
import { AdminDesignerEditDialog } from "@/components/domain/admin-designer-edit-dialog";
import { useConsoleBasePath } from "@/components/layout/console-base-path";
import {
  getDesignerLevelLabel,
  getDesignerPrimaryL3Label,
  getDesignerSubjectTypeLabel,
  splitDesignerLocation,
} from "@/lib/admin-designer-list";
import {
  buildAdminUsersReturnTo,
  withReturnTo,
} from "@/lib/admin-return-to";
import {
  deleteAdminDesignerRequest,
  updateAdminDesignerRequest,
} from "@/lib/api-client";
import type { AdminDesignerRow, Designer } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";

export function AdminDesignerUserTable({
  designers,
  isSuperAdmin,
  onRefresh,
}: {
  designers: AdminDesignerRow[];
  isSuperAdmin: boolean;
  onRefresh: () => void;
}) {
  const base = useConsoleBasePath();
  const usersReturnTo = buildAdminUsersReturnTo(base);
  const push = useSessionStore((s) => s.pushNotification);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AdminDesignerRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDesignerRow | null>(null);

  const rows = useMemo(() => designers, [designers]);

  const handleToggleFreeze = async (d: AdminDesignerRow) => {
    const next = d.accountStatus === "disabled" ? "active" : "disabled";
    setBusyId(d.id);
    try {
      await updateAdminDesignerRequest(d.id, { accountStatus: next });
      push({
        title:
          next === "disabled"
            ? `已冻结「${d.name}」`
            : `已解冻「${d.name}」`,
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
    level: Designer["level"];
    designer: Designer;
  }) => {
    if (!editTarget) return;
    await updateAdminDesignerRequest(editTarget.id, {
      name: payload.name,
      phone: payload.phone || undefined,
      level: payload.level,
      designer: payload.designer,
    });
    push({ title: `已更新「${payload.name}」的资料`, variant: "success" });
    onRefresh();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await deleteAdminDesignerRequest(deleteTarget.id);
      push({
        title: `已删除设计师「${deleteTarget.name}」`,
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

  if (rows.length === 0) {
    return (
      <Card className="p-12 text-center text-sm text-ink-60">
        没有匹配的设计师，请调整筛选条件。
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead className="border-b border-ink-20 bg-ink-20/20 text-[10px] uppercase tracking-wider text-ink-40">
            <tr>
              <th className="px-2 py-2.5 text-left">设计师</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-left">
                注册时间
              </th>
              <th className="whitespace-nowrap px-2 py-2.5 text-left">类型</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-left">
                用户等级
              </th>
              <th className="whitespace-nowrap px-2 py-2.5 text-left">
                手机号
              </th>
              <th className="whitespace-nowrap px-2 py-2.5 text-left">编号</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-left">专业</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-left">
                所在地
              </th>
              <th className="whitespace-nowrap px-2 py-2.5 text-center">
                进行中订单
              </th>
              <th className="whitespace-nowrap px-2 py-2.5 text-center">
                操作
              </th>
            </tr>
          </thead>
            <tbody>
              {rows.map((d) => {
                const frozen = d.accountStatus === "disabled";
                const ongoing = d.ongoingOrdersCount ?? 0;
                const { province, district } = splitDesignerLocation(d.location);
                const subjectType = d.subjectType ?? "individual";
                const typeLabel = getDesignerSubjectTypeLabel(d);
                const levelLabel = getDesignerLevelLabel(d);
                return (
                  <tr
                    key={d.id}
                    className="border-b border-ink-20 last:border-b-0"
                  >
                    <td className="px-2 py-2.5">
                      <Link
                        href={withReturnTo(`/designers/${d.id}`, usersReturnTo)}
                        className="group flex min-w-0 items-center gap-2 rounded-lg transition-colors"
                      >
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={d.avatar} alt={d.name} />
                          <AvatarFallback className="text-[10px]">
                            {d.name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div
                            className="truncate font-medium text-ink transition-colors group-hover:text-brand"
                            title={d.name}
                          >
                            {d.name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-x-2 text-[10px] text-ink-60">
                            <span className="inline-flex shrink-0 items-center gap-0.5">
                              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                              {d.rating.toFixed(1)}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <OnlineDot status={d.onlineStatus} />
                              <ActivityDot
                                level={d.activityIndicator}
                                size="sm"
                              />
                            </span>
                            {frozen ? (
                              <span className="shrink-0 text-amber-700">
                                已冻结
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-[11px] text-ink-60">
                      {d.registeredAt ? formatDate(d.registeredAt) : "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <div
                        className="truncate text-ink"
                        title={typeLabel}
                      >
                        {typeLabel}
                      </div>
                      {(subjectType === "team" || subjectType === "company") &&
                      d.contactName ? (
                        <div
                          className="truncate text-[10px] text-ink-60"
                          title={d.contactName}
                        >
                          {d.contactName}
                        </div>
                      ) : null}
                    </td>
                    <td
                      className="truncate whitespace-nowrap px-2 py-2.5 text-ink"
                      title={levelLabel}
                    >
                      {levelLabel}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-ink-60">
                      <AdminPhoneLink
                        phone={d.phone}
                        className="!font-sans !text-xs !text-ink-60 hover:!text-ink-60 hover:!no-underline"
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-ink-60">
                      {d.code ? (
                        <DesignerCodeCopy
                          code={d.code}
                          compact
                          className="[&_button]:h-5 [&_button]:w-5 [&_span]:!font-sans [&_span]:!text-[10px] [&_span]:!text-ink-60"
                        />
                      ) : (
                        <span className="text-ink-40">—</span>
                      )}
                    </td>
                    <td
                      className="truncate px-2 py-2.5 text-ink"
                      title={getDesignerPrimaryL3Label(d)}
                    >
                      {getDesignerPrimaryL3Label(d)}
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
                          `${base}/orders?designerId=${d.id}&status=ongoing`,
                          usersReturnTo,
                        )}
                        className="font-medium text-brand hover:underline"
                      >
                        {ongoing}
                      </Link>
                    </td>
                    <td className="px-1 py-2.5">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-1.5 text-[11px]"
                          disabled={busyId === d.id || !d.userId}
                          title={!d.userId ? "未绑定登录账号" : undefined}
                          onClick={() => handleToggleFreeze(d)}
                        >
                          {frozen ? (
                            <>
                              <UserCheck className="h-3 w-3" />
                              解冻
                            </>
                          ) : (
                            <>
                              <Snowflake className="h-3 w-3" />
                              冻结
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-1.5 text-[11px]"
                          disabled={busyId === d.id}
                          onClick={() => setEditTarget(d)}
                        >
                          <Pencil className="h-3 w-3" />
                          编辑
                        </Button>
                        {isSuperAdmin ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 px-1.5 text-[11px] text-rose-600 hover:text-rose-700"
                            disabled={busyId === d.id}
                            onClick={() => setDeleteTarget(d)}
                          >
                            <Trash2 className="h-3 w-3" />
                            删除
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

      {editTarget ? (
        <AdminDesignerEditDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          designer={editTarget}
          onSave={handleSaveEdit}
        />
      ) : null}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除设计师</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-60">
            确定删除设计师「
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
