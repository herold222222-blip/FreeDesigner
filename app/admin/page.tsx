"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminPlatformDataCharts } from "@/components/domain/admin-platform-data-charts";
import { useDisputeCounts, useOrders, useReviewItems } from "@/lib/use-data";
import { cn, formatCurrency } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  Award,
  ClipboardCheck,
  Coins,
  PackageSearch,
  TrendingUp,
  Users,
} from "lucide-react";
import { useConsoleBasePath } from "@/components/layout/console-base-path";

export default function AdminDashboardPage() {
  const base = useConsoleBasePath();
  const isSuper = base === "/super-admin";
  const { data: reviewQueue } = useReviewItems();
  const { data: orders } = useOrders();
  const { data: disputeCounts } = useDisputeCounts();
  const matchingOrderCount = orders.filter((o) => o.status === "matching").length;

  const designerQueue = reviewQueue.filter(
    (r) => r.type === "designer" && r.status === "pending",
  );
  const promotionQueue = reviewQueue.filter(
    (r) => r.type === "designer_promotion" && r.status === "pending",
  );
  const levelPromotionQueue = reviewQueue.filter(
    (r) => r.type === "designer_level_promotion" && r.status === "pending",
  );

  const stats: {
    label: string;
    value: number;
    icon: typeof ClipboardCheck;
    tone: string;
    href: string;
  }[] = [
    {
      label: "待匹配订单",
      value: matchingOrderCount,
      icon: PackageSearch,
      tone: "amber",
      href: `${base}/orders?status=matching`,
    },
    {
      label: "待审核入驻",
      value: designerQueue.length,
      icon: ClipboardCheck,
      tone: "amber",
      href: `${base}/reviews?tab=designer`,
    },
    {
      label: "待见习晋级",
      value: promotionQueue.length,
      icon: TrendingUp,
      tone: "emerald",
      href: `${base}/reviews?tab=promotion`,
    },
    {
      label: "待等级晋级",
      value: levelPromotionQueue.length,
      icon: Award,
      tone: "violet",
      href: `${base}/reviews?tab=level_promotion`,
    },
    {
      label: "进行中纠纷",
      value: disputeCounts.active,
      icon: AlertCircle,
      tone: "rose",
      href: `${base}/disputes`,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            {isSuper ? "超级管理员工作台" : "管理员工作台"}
          </h2>
          <p className="mt-1 text-sm text-ink-60">
            {isSuper
              ? "除常规后台能力外，可在「参数中心」调整全局计费规则。"
              : "审核入驻申请、监管订单与资金、处理用户纠纷。"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`${base}/orders`}>
              订单监管 <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="brand">
            <Link href={`${base}/disputes`}>处理纠纷</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          const toneMap: Record<string, string> = {
            amber: "bg-amber-100 text-amber-700",
            emerald: "bg-emerald-100 text-emerald-700",
            violet: "bg-violet-100 text-violet-700",
            rose: "bg-rose-100 text-rose-700",
          };
          return (
            <Link key={s.label} href={s.href} className="block">
              <Card
                className={cn(
                  "p-5 transition-all hover:border-ink hover:shadow-md",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-ink-40">
                    {s.label}
                  </span>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${toneMap[s.tone]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-ink">
                  {s.value}
                </div>
                <p className="mt-2 text-[11px] text-ink-40">
                  演示案例 · 点击查看并处理
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      <AdminPlatformDataCharts />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-ink-60" />
            <h3 className="text-base font-semibold tracking-tight text-ink">
              用户体量
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-semibold text-ink">1,860</div>
              <div className="mt-1 text-xs text-ink-60">入驻设计师</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-ink">12,400</div>
              <div className="mt-1 text-xs text-ink-60">个人委托人</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-ink">468</div>
              <div className="mt-1 text-xs text-ink-60">企业委托人</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Coins className="h-4 w-4 text-ink-60" />
            <h3 className="text-base font-semibold tracking-tight text-ink">
              本月平台收入
            </h3>
          </div>
          <div className="text-3xl font-bold tracking-tight text-ink">
            {formatCurrency(348000)}
          </div>
          <div className="mt-1 text-xs text-ink-60">
            较上月 +12.4%
          </div>
        </Card>
      </div>
    </div>
  );
}
