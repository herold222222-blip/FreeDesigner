"use client";

import { ConsoleShell } from "@/components/layout/console-shell";
import { ConsoleSidebarActions } from "@/components/layout/console-sidebar-actions";
import { DesignerPricingBaseSidebarCard } from "@/components/domain/designer-pricing-base-sidebar";
import { DesignerPortfolioPromptDialog } from "@/components/domain/designer-portfolio-prompt-dialog";
import { useDesigner } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import {
  CalendarDays,
  CalendarRange,
  ImagePlus,
  LayoutDashboard,
  Megaphone,
  PackageCheck,
  Percent,
  QrCode,
  Settings,
  UserCircle,
  Wallet,
} from "lucide-react";

const NAV = [
  { href: "/designer", label: "工作台", icon: LayoutDashboard, exact: true },
  { href: "/designer/orders", label: "我的项目", icon: PackageCheck },
  { href: "/designer/bounties", label: "悬赏报名", icon: Megaphone },
  { href: "/designer/portfolio", label: "作品管理", icon: ImagePlus },
  { href: "/designer/calendar", label: "接单档期", icon: CalendarRange, exact: true },
  { href: "/designer/rates", label: "我的费率", icon: Percent },
  { href: "/designer/calendar/work", label: "工作日历", icon: CalendarDays },
  { href: "/designer/scan-orders", label: "扫码下单", icon: QrCode },
  { href: "/designer/wallet", label: "钱包 · 提现", icon: Wallet },
  { href: "/designer/profile", label: "个人主页", icon: UserCircle },
  { href: "/designer/settings", label: "账号设置", icon: Settings },
];

export default function DesignerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identityId = useRoleStore((s) => s.identityId) || "designer_chen";
  const { data: designer } = useDesigner(identityId);

  return (
    <ConsoleShell
      title="设计师工作台"
      subtitle={designer ? `设计师 · ${designer.name}` : "设计师工作台"}
      nav={NAV}
      sidebarTop={<DesignerPricingBaseSidebarCard />}
      sidebarBottom={<ConsoleSidebarActions consoleKind="designer" />}
    >
      <DesignerPortfolioPromptDialog designer={designer} />
      {children}
    </ConsoleShell>
  );
}
