"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DesignerName } from "@/components/domain/designer-name";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionStore } from "@/store/session-store";
import { useDesigners } from "@/lib/use-data";
import { SpecialtyBadge } from "@/components/domain/status-badges";
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Clock,
  PauseCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Hire {
  id: string;
  designerId: string;
  startedAt: string;
  currentMonthEndsAt: string;
  monthlyRate: number;
  totalMonths: number;
  status: "active" | "renewal_window" | "expired";
  autoRenew: boolean;
}

const HIRES: Hire[] = [
  {
    id: "h_1",
    designerId: "designer_li",
    startedAt: "2026-01-22",
    currentMonthEndsAt: "2026-05-21",
    monthlyRate: 36000,
    totalMonths: 4,
    status: "renewal_window",
    autoRenew: true,
  },
  {
    id: "h_2",
    designerId: "designer_zhao",
    startedAt: "2026-04-12",
    currentMonthEndsAt: "2026-05-11",
    monthlyRate: 32000,
    totalMonths: 1,
    status: "active",
    autoRenew: false,
  },
  {
    id: "h_3",
    designerId: "designer_wang",
    startedAt: "2025-09-20",
    currentMonthEndsAt: "2026-03-19",
    monthlyRate: 28000,
    totalMonths: 6,
    status: "expired",
    autoRenew: false,
  },
];

export default function MonthlyHirePage() {
  const push = useSessionStore((s) => s.pushNotification);
  const { data: designers } = useDesigners();
  const getDesignerById = (id: string) => designers.find((d) => d.id === id);

  const handleRenew = (h: Hire, designer: any) => {
    push({
      title: `已续约 · ${designer?.name}`,
      description: `${formatCurrency(h.monthlyRate)} 已托管,服务延续到 ${formatDate(addMonths(h.currentMonthEndsAt, 1))}。`,
      variant: "success",
    });
  };

  const handlePause = (h: Hire, designer: any) => {
    push({
      title: `已确认不续约 · ${designer?.name}`,
      description: "本月服务结束后自动终止。可随时重新发起按月雇佣。",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          按月雇佣 · 续费中心
        </h2>
        <p className="mt-1 text-sm text-ink-60">
          首月签约预付，此后每月 25 号前支付下一个月服务费；逾期未付则次月服务自动终止。
        </p>
      </div>

      <Card className="overflow-hidden bg-amber-50 border-amber-200 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-900">
              本月续费提醒(2026 年 5 月)
            </div>
            <div className="mt-1 text-xs text-amber-800">
              你有 <strong>1 项</strong> 雇佣处于续费窗口期,请在 5 月 25 号前支付 6 月服务费。
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            进行中 <Badge variant="muted">{HIRES.filter(h => h.status !== "expired").length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="expired" className="gap-2">
            已终止 <Badge variant="muted">{HIRES.filter(h => h.status === "expired").length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <div className="space-y-4">
            {HIRES.filter(h => h.status !== "expired").map((h) => {
              const designer = getDesignerById(h.designerId);
              if (!designer) return null;
              const inWindow = h.status === "renewal_window";

              return (
                <Card key={h.id} className={`p-6 ${inWindow ? "border-amber-300 bg-amber-50/40" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex flex-1 items-start gap-4">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={designer.avatar} alt={designer.name} />
                        <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-ink">
                            <DesignerName designer={designer} />
                          </h3>
                          <SpecialtyBadge specialty={designer.specialty} />
                          {inWindow ? (
                            <Badge variant="amber" className="gap-1">
                              <Clock className="h-3 w-3" /> 续约窗口期
                            </Badge>
                          ) : (
                            <Badge variant="emerald" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" /> 服务中
                            </Badge>
                          )}
                          {h.autoRenew && (
                            <Badge variant="muted" className="gap-1">
                              <RefreshCw className="h-3 w-3" /> 自动续约
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-ink-60">
                          <span>开始于 {formatDate(h.startedAt)}</span>
                          <span>已雇佣 {h.totalMonths} 个月</span>
                          <span>本月期满 {formatDate(h.currentMonthEndsAt)}</span>
                          <span>月度 <strong className="text-ink">{formatCurrency(h.monthlyRate)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {inWindow ? (
                        <>
                          <Button variant="brand" onClick={() => handleRenew(h, designer)}>
                            <RefreshCw className="h-4 w-4" /> 立即续约下月
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handlePause(h, designer)}>
                            <PauseCircle className="h-3.5 w-3.5" /> 暂不续约
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm">
                            提前续约
                          </Button>
                          <span className="text-xs text-ink-40">
                            5 月 25 号前可预付下月
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {inWindow && (
                    <div className="mt-5 rounded-xl border border-amber-200 bg-white p-4 text-xs text-ink-60">
                      <div className="flex items-start gap-2">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 text-amber-600" />
                        <div>
                          <strong className="text-ink">续费规则:</strong>{" "}
                          每月 25 号前支付下一个月服务费,服务自动延续;
                          未按时续费,本月期满后自动终止次月服务。
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="expired">
          <div className="space-y-4">
            {HIRES.filter(h => h.status === "expired").map((h) => {
              const designer = getDesignerById(h.designerId);
              if (!designer) return null;
              return (
                <Card key={h.id} className="p-6 opacity-80">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={designer.avatar} alt={designer.name} />
                        <AvatarFallback>{designer.name.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-ink">
                            <DesignerName designer={designer} />
                          </h3>
                          <Badge variant="muted">已终止</Badge>
                        </div>
                        <div className="mt-1 text-xs text-ink-60">
                          雇佣 {h.totalMonths} 个月 · {formatDate(h.startedAt)} - {formatDate(h.currentMonthEndsAt)}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <CalendarRange className="h-3.5 w-3.5" /> 重新雇佣
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}
