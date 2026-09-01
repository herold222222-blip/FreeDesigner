"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  WORKLOAD_META,
  ACTIVITY_META,
} from "@/lib/constants";
import type { Designer, WorkloadStatus } from "@/lib/types";
import { ActivityDot } from "./activity-dot";
import { useSessionStore } from "@/store/session-store";
import { updateDesignerProfileRequest } from "@/lib/api-client";
import { invalidateApiPath } from "@/lib/use-data";
import {
  designerCanAcceptOrders,
  portfolioReadinessHint,
} from "@/lib/designer-portfolio-readiness";
import { PencilLine, Plane, Wifi } from "lucide-react";
import Link from "next/link";

export function StatusControls({ designer }: { designer: Designer }) {
  const canAcceptOrders = designerCanAcceptOrders(designer);
  const readinessHint = portfolioReadinessHint(designer);
  const online = true;
  const [workload, setWorkload] = useState<WorkloadStatus>(designer.workloadStatus);
  const [travel, setTravel] = useState(designer.isOpenToTravel);
  const [hand, setHand] = useState(designer.supportsHandDrawing);
  const [savingKey, setSavingKey] = useState<"travel" | "hand" | null>(null);
  const push = useSessionStore((s) => s.pushNotification);

  const persistServiceFlag = async (
    key: "travel" | "hand",
    next: boolean,
    apply: (v: boolean) => void,
    patch: { isOpenToTravel?: boolean; supportsHandDrawing?: boolean },
    titleOn: string,
    titleOff: string,
  ) => {
    if (savingKey) return;
    const previous = key === "travel" ? travel : hand;
    apply(next);
    setSavingKey(key);
    try {
      await updateDesignerProfileRequest(designer.id, patch);
      invalidateApiPath(`/api/designers/${designer.id}`);
      invalidateApiPath("/api/designers");
      push({ title: next ? titleOn : titleOff, variant: next ? "success" : "default" });
    } catch (e) {
      apply(previous);
      push({
        title: "状态未保存",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const updateWorkload = (status: WorkloadStatus) => {
    setWorkload(status);
    push({
      title: `负荷状态已更新 · ${WORKLOAD_META[status].label}`,
      variant: "success",
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-ink">
          我的状态
        </h3>
        <div className="flex items-center gap-2 text-xs text-ink-60">
          <ActivityDot level={designer.activityIndicator} size="sm" />
          活跃度 · {ACTIVITY_META[designer.activityIndicator].label}
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {!canAcceptOrders ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <div className="font-medium">暂不可接单</div>
            <p className="mt-1 leading-relaxed text-amber-800/90">
              {readinessHint ||
                "请先在作品管理中上传项目类型案例，方可开启在线接单与平台匹配。"}
            </p>
            <Link
              href="/designer/portfolio"
              className="mt-2 inline-block font-medium text-brand hover:underline"
            >
              前往作品管理 →
            </Link>
          </div>
        ) : null}
        <div className="flex items-center justify-between rounded-xl border border-ink-20 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-20/40">
              <Wifi className="h-4 w-4 text-ink-60" />
            </div>
            <div>
              <div className="text-sm font-medium text-ink">在线状态</div>
              <div className="text-xs text-ink-60">
                登录后自动在线，下线后仍保持 2 小时
              </div>
            </div>
          </div>
          <Badge variant={online ? "emerald" : "muted"}>
            {online ? "在线" : "离线"}
          </Badge>
        </div>

        <div className="rounded-xl border border-ink-20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-ink">忙闲负荷</div>
              <div className="text-xs text-ink-60">
                让委托人知道你的排期情况
              </div>
            </div>
            <Badge variant="muted">
              当前 · {WORKLOAD_META[workload].label}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(WORKLOAD_META) as WorkloadStatus[]).map((k) => {
              const meta = WORKLOAD_META[k];
              const active = workload === k;
              return (
                <button
                  key={k}
                  onClick={() => updateWorkload(k)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border px-1.5 py-2 text-xs whitespace-nowrap transition-colors sm:gap-2 sm:px-2 sm:text-sm ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-ink-20 text-ink-60 hover:border-ink/40"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.color}`}
                  />
                  <span className="whitespace-nowrap">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3">
          <ToggleRow
            icon={Plane}
            label="支持出差 / 上门"
            checked={travel}
            disabled={savingKey === "travel"}
            onChange={(v) =>
              persistServiceFlag(
                "travel",
                v,
                setTravel,
                { isOpenToTravel: v },
                "已开启出差 / 上门",
                "已关闭出差 / 上门",
              )
            }
          />
          <ToggleRow
            icon={PencilLine}
            label="支持改图"
            checked={hand}
            disabled={savingKey === "hand"}
            onChange={(v) =>
              persistServiceFlag(
                "hand",
                v,
                setHand,
                { supportsHandDrawing: v },
                "已开启改图服务",
                "已关闭改图服务",
              )
            }
          />
        </div>
      </div>
    </Card>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-ink-20 px-3 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-ink">
        <Icon className="h-4 w-4 shrink-0 text-ink-60" />
        <span className="whitespace-nowrap">{label}</span>
      </div>
      <Switch
        className="shrink-0"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
