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
import {
  designerCanAcceptOrders,
  portfolioReadinessHint,
} from "@/lib/designer-portfolio-readiness";
import { Briefcase, PencilLine, Plane, Wifi } from "lucide-react";
import Link from "next/link";

export function StatusControls({ designer }: { designer: Designer }) {
  const canAcceptOrders = designerCanAcceptOrders(designer);
  const readinessHint = portfolioReadinessHint(designer);
  const [online, setOnline] = useState(
    designer.onlineStatus === "online" && canAcceptOrders,
  );
  const [workload, setWorkload] = useState<WorkloadStatus>(designer.workloadStatus);
  const [travel, setTravel] = useState(designer.isOpenToTravel);
  const [hand, setHand] = useState(designer.supportsHandDrawing);
  const push = useSessionStore((s) => s.pushNotification);

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
                在线时优先曝光于设计师列表顶部
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-60">
              {online ? "在线" : "离线"}
            </span>
            <Switch
              checked={online}
              disabled={!canAcceptOrders && !online}
              onCheckedChange={(v) => {
                if (v && !canAcceptOrders) {
                  push({
                    title: "请先上传项目类型案例",
                    description: readinessHint,
                    variant: "destructive",
                  });
                  return;
                }
                setOnline(v);
                push({
                  title: v ? "已上线 · 开放接单" : "已离线",
                  variant: v ? "success" : "default",
                });
              }}
            />
          </div>
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
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(WORKLOAD_META) as WorkloadStatus[]).map((k) => {
              const meta = WORKLOAD_META[k];
              const active = workload === k;
              return (
                <button
                  key={k}
                  onClick={() => updateWorkload(k)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    active
                      ? "border-ink bg-ink text-white"
                      : "border-ink-20 text-ink-60 hover:border-ink/40"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${meta.color}`}
                  />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            icon={Plane}
            label="支持出差 / 上门"
            checked={travel}
            onChange={(v) => {
              setTravel(v);
              push({ title: v ? "已开启出差服务" : "已关闭出差服务" });
            }}
          />
          <ToggleRow
            icon={PencilLine}
            label="支持手改图"
            checked={hand}
            onChange={(v) => {
              setHand(v);
              push({ title: v ? "已开启手改图服务" : "已关闭手改图服务" });
            }}
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
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-20 p-3">
      <div className="flex items-center gap-2 text-sm text-ink">
        <Icon className="h-4 w-4 text-ink-60" /> {label}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
