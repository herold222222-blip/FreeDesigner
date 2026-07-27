"use client";

import { useMemo } from "react";
import { ConsoleShell } from "@/components/layout/console-shell";
import { ConsoleSidebarActions } from "@/components/layout/console-sidebar-actions";
import { DesignerPricingBaseSidebarCard } from "@/components/domain/designer-pricing-base-sidebar";
import { DesignerPortfolioPromptDialog } from "@/components/domain/designer-portfolio-prompt-dialog";
import { useDesigner } from "@/lib/use-data";
import { withMessagesNavItem } from "@/lib/inbox-nav";
import { useInboxUnreadCount } from "@/lib/use-inbox-unread";
import { useRoleStore } from "@/store/role-store";
import {
  ImagePlus,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  PackageCheck,
  Percent,
  QrCode,
  Settings,
  UserCircle,
  Wallet,
} from "lucide-react";

const BASE_NAV = [
  { href: "/designer", label: "工作台", icon: LayoutDashboard, exact: true },
  { href: "/designer/orders", label: "我的项目", icon: PackageCheck },
  { href: "/designer/bounties", label: "悬赏报名", icon: Megaphone },
  { href: "/designer/portfolio", label: "作品管理", icon: ImagePlus },
  { href: "/designer/rates", label: "我的费率", icon: Percent },
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
  const identityId = useRoleStore((s) => s.identityId);
  const { data: designer } = useDesigner(identityId || null);
  const { count: unread } = useInboxUnreadCount();
  const nav = useMemo(
    () =>
      withMessagesNavItem(
        BASE_NAV,
        "/designer/messages",
        MessageSquare,
        unread,
      ),
    [unread],
  );

  return (
    <ConsoleShell
      title="设计师工作台"
      subtitle={designer ? `设计师 · ${designer.name}` : "设计师工作台"}
      nav={nav}
      sidebarTop={<DesignerPricingBaseSidebarCard />}
      sidebarBottom={<ConsoleSidebarActions consoleKind="designer" />}
    >
      <DesignerPortfolioPromptDialog designer={designer} />
      {children}
    </ConsoleShell>
  );
}
