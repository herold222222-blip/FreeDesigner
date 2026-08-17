"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminDesignerPickerDialog } from "@/components/domain/admin-designer-picker-dialog";
import type { Designer, Order } from "@/lib/types";
import { assignDesignerToOrderRequest } from "@/lib/api-client";
import { resolveTrackLabels } from "@/lib/constants";
import {
  extractOrderAssignTracks,
  type OrderAssignTrack,
} from "@/lib/order-assign-tracks";
import { formatCurrency } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { UserRoundSearch } from "lucide-react";

export function AdminAssignDesignerPanel({
  order,
  designers,
  onAssigned,
}: {
  order: Order;
  designers: Designer[];
  onAssigned: () => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const tracks = useMemo(() => extractOrderAssignTracks(order), [order]);
  const multiTrack = tracks.length > 1;

  const [pickerTrackKey, setPickerTrackKey] = useState<string | null>(null);
  const [designerByTrack, setDesignerByTrack] = useState<Record<string, string>>(
    {},
  );
  const [designerId, setDesignerId] = useState("");
  const [totalAmount, setTotalAmount] = useState(
    String(order.totalAmount > 1 ? order.totalAmount : ""),
  );
  const [busy, setBusy] = useState(false);

  const selected = designers.find((d) => d.id === designerId);
  const waitingAssignments = order.trackAssignments ?? [];

  if (order.status === "pending_designer_accept") {
    const waitingRows =
      waitingAssignments.length > 0
        ? waitingAssignments
        : order.designerId
          ? [
              {
                id: "legacy",
                l1: order.specialty,
                l2: "",
                l3: "",
                designerId: order.designerId,
                stageId: "",
                status: "pending_match" as const,
              },
            ]
          : [];

    return (
      <Card className="space-y-3 border-blue-200 bg-blue-50/70 p-5">
        <div>
          <div className="text-sm font-semibold text-blue-950">
            等待设计师确认委派
          </div>
          <p className="mt-1 text-xs text-blue-900/80">
            已向设计师发送站内信。对方同意后进入签约；若拒绝，订单将回到待匹配，您可重新委派。
            {waitingRows.length > 1
              ? " 多专业订单需全部相关设计师确认后才会进入签约。"
              : ""}
          </p>
        </div>
        <div className="space-y-2">
          {waitingRows.map((row) => {
            const designer = designers.find((d) => d.id === row.designerId);
            const labels =
              row.l2 && row.l3
                ? (() => {
                    const resolved = resolveTrackLabels(row.l1, row.l2, row.l3);
                    return `${resolved.l2Label} · ${resolved.l3Label}`;
                  })()
                : null;
            const accepted = row.status === "serving";
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-blue-200/80 bg-white/80 px-3 py-2.5"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={designer?.avatar}
                    alt={designer?.name ?? "设计师"}
                  />
                  <AvatarFallback>
                    {(designer?.name ?? "?").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">
                    {designer
                      ? `${designer.name}${designer.code ? ` · ${designer.code}` : ""}`
                      : "设计师"}
                  </div>
                  <div className="text-xs text-ink-60">
                    {labels ? `${labels} · ` : ""}
                    {accepted ? "已确认接单" : "待确认"}
                    {" · "}
                    确认费用 {formatCurrency(order.totalAmount)}
                  </div>
                </div>
                <span
                  className={
                    accepted
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                      : "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                  }
                >
                  {accepted ? "已同意" : "待确认"}
                </span>
              </div>
            );
          })}
          {waitingRows.length === 0 ? (
            <p className="text-sm text-ink-60">已委派设计师，等待确认中…</p>
          ) : null}
        </div>
      </Card>
    );
  }

  if (order.status !== "matching") return null;

  const allTracksPicked =
    !multiTrack || tracks.every((t) => Boolean(designerByTrack[t.key]));
  const canSubmit = multiTrack
    ? allTracksPicked && !busy
    : Boolean(designerId) && !busy;

  const handleAssign = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const amount = Number(totalAmount);
      if (multiTrack) {
        await assignDesignerToOrderRequest(order.id, {
          totalAmount: amount > 0 ? amount : undefined,
          assignments: tracks.map((t) => ({
            l1: t.l1,
            l2: t.l2,
            l3: t.l3,
            designerId: designerByTrack[t.key]!,
          })),
        });
      } else {
        const only = tracks[0];
        await assignDesignerToOrderRequest(order.id, {
          designerId: designerId || (only ? designerByTrack[only.key] : ""),
          totalAmount: amount > 0 ? amount : undefined,
          assignments:
            only && (designerId || designerByTrack[only.key])
              ? [
                  {
                    l1: only.l1,
                    l2: only.l2,
                    l3: only.l3,
                    designerId: designerId || designerByTrack[only.key]!,
                  },
                ]
              : undefined,
        });
      }
      push({
        title: "已发送委派",
        description: multiTrack
          ? "相关设计师将收到站内信，全部确认后进入签约流程。"
          : "设计师将收到站内信，确认后进入签约流程。",
        variant: "success",
      });
      setDesignerId("");
      setDesignerByTrack({});
      onAssigned();
    } catch (e) {
      push({
        title: "委派失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const openPickerFor = (track: OrderAssignTrack | null) => {
    setPickerTrackKey(track?.key ?? "__single__");
  };

  const activeTrack =
    pickerTrackKey && pickerTrackKey !== "__single__"
      ? tracks.find((t) => t.key === pickerTrackKey) ?? null
      : null;

  const pickerSelectedId =
    pickerTrackKey && pickerTrackKey !== "__single__"
      ? designerByTrack[pickerTrackKey] ?? ""
      : designerId;

  return (
    <>
      <Card className="space-y-4 border-amber-200 bg-amber-50/60 p-5">
        <div>
          <div className="text-sm font-semibold text-amber-950">
            常规委托 · 待匹配设计师
          </div>
          <p className="mt-1 text-xs text-amber-900/80">
            {multiTrack
              ? "本订单含多个专业，请为每个专业分别选择设计师；确认费用后一并发送委派。"
              : "从设计师列表筛选并选择人选，确认费用后发送委派；设计师同意后进入双方签约。"}
            {order.totalAmount <= 1
              ? " 委托人尚未填写预算，请在此确认订单总额。"
              : ` 参考预算 ${formatCurrency(order.totalAmount)}。`}
          </p>
        </div>

        {multiTrack ? (
          <div className="space-y-3">
            {tracks.map((track) => {
              const selectedDesigner = designers.find(
                (d) => d.id === designerByTrack[track.key],
              );
              return (
                <div
                  key={track.key}
                  className="rounded-xl border border-amber-200/80 bg-white/80 p-3"
                >
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-ink">
                        {track.l3Label}
                      </div>
                      <div className="text-[11px] text-ink-40">
                        {track.l2Label}
                        {track.quantityHint ? ` · ${track.quantityHint}` : ""}
                      </div>
                    </div>
                  </div>
                  <Label className="sr-only">委派设计师 · {track.l3Label}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-between border-ink-20 bg-white px-4 font-normal"
                    onClick={() => openPickerFor(track)}
                  >
                    <span
                      className={
                        selectedDesigner ? "text-ink" : "text-ink-40"
                      }
                    >
                      {selectedDesigner
                        ? `${selectedDesigner.name}${
                            selectedDesigner.code
                              ? ` · ${selectedDesigner.code}`
                              : ""
                          }`
                        : "选择设计师"}
                    </span>
                    <UserRoundSearch className="h-4 w-4 text-ink-40" />
                  </Button>
                </div>
              );
            })}
            <div className="space-y-1.5">
              <Label>确认订单总额（元）</Label>
              <Input
                type="number"
                min={1}
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="例如 50000"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                委派设计师
                {tracks[0] ? ` · ${tracks[0].l3Label}` : ""}
              </Label>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-between border-ink-20 bg-white px-4 font-normal"
                onClick={() => openPickerFor(tracks[0] ?? null)}
              >
                <span className={selected ? "text-ink" : "text-ink-40"}>
                  {selected
                    ? `${selected.name}${selected.code ? ` · ${selected.code}` : ""}`
                    : "选择设计师"}
                </span>
                <UserRoundSearch className="h-4 w-4 text-ink-40" />
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>确认订单总额（元）</Label>
              <Input
                type="number"
                min={1}
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="例如 50000"
              />
            </div>
          </div>
        )}

        <Button
          variant="brand"
          size="sm"
          disabled={!canSubmit}
          onClick={handleAssign}
        >
          {busy ? "委派中..." : "确认费用并委派"}
        </Button>
      </Card>

      <AdminDesignerPickerDialog
        open={pickerTrackKey != null}
        onOpenChange={(open) => {
          if (!open) setPickerTrackKey(null);
        }}
        order={order}
        designers={designers}
        selectedId={pickerSelectedId}
        preferL2={activeTrack?.l2}
        preferL3={activeTrack?.l3}
        title={
          activeTrack
            ? `选择设计师 · ${activeTrack.l3Label}`
            : "选择设计师"
        }
        onSelect={(d) => {
          if (pickerTrackKey && pickerTrackKey !== "__single__") {
            setDesignerByTrack((prev) => ({
              ...prev,
              [pickerTrackKey]: d.id,
            }));
          } else {
            setDesignerId(d.id);
            if (tracks[0]) {
              setDesignerByTrack((prev) => ({
                ...prev,
                [tracks[0]!.key]: d.id,
              }));
            }
          }
        }}
      />
    </>
  );
}
