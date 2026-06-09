"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionStore } from "@/store/session-store";
import { useDesigners, useClients, useDisputes } from "@/lib/use-data";
import {
  acceptDisputeRequest,
  resolveDisputeRequest,
} from "@/lib/api-client";
import type { Dispute } from "@/lib/types";
import { useConsoleBasePath } from "@/components/layout/console-base-path";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Coins,
  MessageCircle,
  Scale,
  Shield,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function AdminDisputesPage() {
  const base = useConsoleBasePath();
  const push = useSessionStore((s) => s.pushNotification);
  const { data: disputes, loading, refresh } = useDisputes();
  const { data: designers } = useDesigners();
  const { data: clients } = useClients();
  const getDesignerById = (id: string) => designers.find((d) => d.id === id);
  const getClientById = (id: string) => clients.find((c) => c.id === id);
  const [activeTab, setActiveTab] = useState<"open" | "in_review" | "resolved">(
    "open",
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      open: disputes.filter((d) => d.status === "open").length,
      in_review: disputes.filter((d) => d.status === "in_review").length,
      resolved: disputes.filter((d) => d.status === "resolved").length,
    }),
    [disputes],
  );

  const filtered = disputes.filter((d) => d.status === activeTab);

  const run = async (id: string, fn: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    try {
      await fn();
      push({ title: success, variant: "success" });
      refresh();
    } catch (e) {
      push({
        title: "操作失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = (d: Dispute) =>
    run(d.id, () => acceptDisputeRequest(d.id), "已受理，进入处理中");

  const handleResolve = (d: Dispute, resolution: "client" | "designer") =>
    run(
      d.id,
      () => resolveDisputeRequest(d.id, { resolution }),
      resolution === "client"
        ? `已支持委托人 · 订单 ${d.orderCode}`
        : `已支持设计师 · 订单 ${d.orderCode}`,
    );

  const handleSplit = (d: Dispute) => {
    const pct = Number(
      window.prompt("请输入委托人承担比例（0–100）", "60") ?? "",
    );
    if (Number.isNaN(pct) || pct < 0 || pct > 100) return;
    run(
      d.id,
      () =>
        resolveDisputeRequest(d.id, {
          resolution: "split",
          clientSharePercent: pct,
        }),
      `部分裁决完成 · 委托人 ${pct}%`,
    );
  };

  if (loading) {
    return <div className="py-20 text-center text-ink-60">加载纠纷列表...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          纠纷处理
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          针对设计师与委托人的服务争议，平台依据沟通记录、阶段成果、付款记录介入裁决。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="待受理" value={counts.open} icon={AlertCircle} tone="rose" />
        <StatCard label="处理中" value={counts.in_review} icon={Clock} tone="amber" />
        <StatCard label="已解决" value={counts.resolved} icon={CheckCircle2} tone="emerald" />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="open" className="gap-2">
            待受理 <Badge variant="rose">{counts.open}</Badge>
          </TabsTrigger>
          <TabsTrigger value="in_review" className="gap-2">
            处理中 <Badge variant="amber">{counts.in_review}</Badge>
          </TabsTrigger>
          <TabsTrigger value="resolved" className="gap-2">
            已解决 <Badge variant="emerald">{counts.resolved}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <Card className="p-16 text-center text-ink-60">
                该状态下暂无纠纷。
              </Card>
            ) : (
              filtered.map((d) => {
                const client = getClientById(d.clientId);
                const designer = getDesignerById(d.designerId);
                const busy = busyId === d.id;
                return (
                  <Card key={d.id} className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="rose">{d.type}</Badge>
                          <Badge variant="outline">
                            发起方:
                            {d.raisedBy === "client" ? "委托人" : "设计师"}
                          </Badge>
                          <Link
                            href={`${base}/orders/${d.orderId}`}
                            className="text-xs text-brand hover:underline"
                          >
                            {d.orderCode}
                          </Link>
                        </div>
                        <h3 className="text-base font-semibold text-ink">
                          {d.title}
                        </h3>
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-60">
                          <span>
                            涉及金额{" "}
                            <strong className="text-ink">
                              {formatCurrency(d.amount)}
                            </strong>
                          </span>
                          <span>发起 {formatDateTime(d.raisedAt)}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`${base}/orders/${d.orderId}`}>
                          <MessageCircle className="h-3.5 w-3.5" /> 查看订单
                        </Link>
                      </Button>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                          争议描述
                        </div>
                        <p className="mt-2 text-sm text-ink-80">{d.description}</p>

                        {d.evidence.length > 0 && (
                          <div className="mt-4">
                            <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                              证据材料
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {d.evidence.map((e, i) => (
                                <Badge key={i} variant="muted">
                                  📎 {e.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 rounded-xl border border-ink-20 bg-ink-20/20 p-4">
                        <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                          双方信息
                        </div>
                        <PartyRow
                          label="委托人"
                          name={client?.name ?? ""}
                          avatar={client?.avatar ?? ""}
                        />
                        <PartyRow
                          label="设计师"
                          name={designer?.name ?? ""}
                          avatar={designer?.avatar ?? ""}
                        />

                        {d.status === "open" && (
                          <div className="border-t border-ink-20 pt-3">
                            <Button
                              variant="brand"
                              size="sm"
                              className="w-full"
                              disabled={busy}
                              onClick={() => handleAccept(d)}
                            >
                              受理工单
                            </Button>
                          </div>
                        )}

                        {d.status === "in_review" && (
                          <div className="space-y-2 border-t border-ink-20 pt-3">
                            <div className="text-xs font-medium uppercase tracking-wider text-ink-40">
                              裁决操作
                            </div>
                            <Button
                              variant="brand"
                              size="sm"
                              className="w-full"
                              disabled={busy}
                              onClick={() => handleResolve(d, "client")}
                            >
                              <Shield className="h-3.5 w-3.5" /> 支持委托人 · 退款
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={busy}
                              onClick={() => handleResolve(d, "designer")}
                            >
                              <Coins className="h-3.5 w-3.5" /> 支持设计师 · 解冻
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-ink-60"
                              disabled={busy}
                              onClick={() => handleSplit(d)}
                            >
                              <Scale className="h-3.5 w-3.5" /> 部分裁决 · 各承担
                            </Button>
                          </div>
                        )}

                        {d.status === "resolved" && (
                          <div className="rounded-lg bg-emerald-100 px-3 py-2 text-xs text-emerald-800">
                            <CheckCircle2 className="mr-1 inline h-3 w-3" />
                            已结案
                            {d.resolution === "split" && d.clientSharePercent != null
                              ? ` · 委托人承担 ${d.clientSharePercent}%`
                              : d.resolution === "client"
                                ? " · 支持委托人"
                                : d.resolution === "designer"
                                  ? " · 支持设计师"
                                  : ""}
                            {d.resolutionNote ? ` — ${d.resolutionNote}` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "rose" | "amber" | "emerald";
}) {
  const map = {
    rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-ink-40">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${map[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</div>
    </Card>
  );
}

function PartyRow({ label, name, avatar }: { label: string; name: string; avatar: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-60">{label}</span>
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium text-ink">{name}</span>
      </div>
    </div>
  );
}
