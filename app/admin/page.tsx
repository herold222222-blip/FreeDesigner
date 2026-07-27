"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminPlatformDataCharts } from "@/components/domain/admin-platform-data-charts";
import {
  useAdminClients,
  useAdminDesigners,
  useBounties,
  useDisputeCounts,
  useOrders,
  useReviewItems,
} from "@/lib/use-data";
import { cn, formatCurrency } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  Award,
  ClipboardCheck,
  Coins,
  Gift,
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
  const { data: bounties } = useBounties();
  const { data: designers } = useAdminDesigners();
  const { data: clients } = useAdminClients();
  const { data: disputeCounts } = useDisputeCounts();

  const matchingOrderCount = orders.filter((o) => o.status === "matching").length;
  const openBountyCount = bounties.filter((b) => b.status === "open").length;

  const designerQueue = reviewQueue.filter(
    (r) => r.type === "designer" && r.status === "pending",
  );
  const promotionQueue = reviewQueue.filter(
    (r) => r.type === "designer_promotion" && r.status === "pending",
  );
  const levelPromotionQueue = reviewQueue.filter(
    (r) => r.type === "designer_level_promotion" && r.status === "pending",
  );

  const individualClients = clients.filter((c) => c.type !== "enterprise").length;
  const enterpriseClients = clients.filter((c) => c.type === "enterprise").length;

  const monthIncome = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return orders
      .filter((o) => {
        const created = o.createdAt ? new Date(o.createdAt) : null;
        return created && created >= monthStart;
      })
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
  }, [orders]);

  const stats: {
    label: string;
    value: number;
    hint: string;
    icon: typeof ClipboardCheck;
    tone: string;
    href: string;
  }[] = [
    {
      label: "待匹配委托",
      value: matchingOrderCount,
      hint: matchingOrderCount > 0 ? "点击查看并指派" : "暂无待处理",
      icon: PackageSearch,
      tone: "amber",
      href: `${base}/orders?status=matching`,
    },
    {
      label: "进行中悬赏",
      value: openBountyCount,
      hint: openBountyCount > 0 ? "点击查看悬赏项目" : "暂无进行中悬赏",
      icon: Gift,
      tone: "sky",
      href: "/bounties",
    },
    {
      label: "待审核入驻",
      value: designerQueue.length,
      hint: designerQueue.length > 0 ? "点击审核设计师入驻" : "暂无待审申请",
      icon: ClipboardCheck,
      tone: "amber",
      href: `${base}/reviews?tab=designer`,
    },
    {
      label: "待见习晋级",
      value: promotionQueue.length,
      hint: promotionQueue.length > 0 ? "点击查看并处理" : "暂无待处理",
      icon: TrendingUp,
      tone: "emerald",
      href: `${base}/reviews?tab=promotion`,
    },
    {
      label: "待等级晋级",
      value: levelPromotionQueue.length,
      hint: levelPromotionQueue.length > 0 ? "点击查看并处理" : "暂无待处理",
      icon: Award,
      tone: "violet",
      href: `${base}/reviews?tab=level_promotion`,
    },
    {
      label: "进行中纠纷",
      value: disputeCounts.active,
      hint: disputeCounts.active > 0 ? "点击处理纠纷" : "暂无进行中纠纷",
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => {
          const Icon = s.icon;
          const toneMap: Record<string, string> = {
            amber: "bg-amber-100 text-amber-700",
            emerald: "bg-emerald-100 text-emerald-700",
            violet: "bg-violet-100 text-violet-700",
            rose: "bg-rose-100 text-rose-700",
            sky: "bg-sky-100 text-sky-700",
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
                <p className="mt-2 text-[11px] text-ink-40">{s.hint}</p>
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
              <div className="text-2xl font-semibold text-ink">
                {designers.length.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-ink-60">入驻设计师</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-ink">
                {individualClients.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-ink-60">个人委托人</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-ink">
                {enterpriseClients.toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-ink-60">企业委托人</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Coins className="h-4 w-4 text-ink-60" />
            <h3 className="text-base font-semibold tracking-tight text-ink">
              本月平台订单额
            </h3>
          </div>
          <div className="text-3xl font-bold tracking-tight text-ink">
            {formatCurrency(monthIncome)}
          </div>
          <div className="mt-1 text-xs text-ink-60">
            本月新建委托订单金额合计 · 实时统计
          </div>
        </Card>
      </div>
    </div>
  );
}
