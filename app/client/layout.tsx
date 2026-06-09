"use client";

import { ConsoleShell } from "@/components/layout/console-shell";
import { ConsoleSidebarActions } from "@/components/layout/console-sidebar-actions";
import { useClient } from "@/lib/use-data";
import { useRoleStore } from "@/store/role-store";
import {
  LayoutDashboard,
  PackageSearch,
  Megaphone,
  Wallet,
  Heart,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/client", label: "工作台", icon: LayoutDashboard, exact: true },
  { href: "/client/orders", label: "平台订单", icon: PackageSearch },
  { href: "/client/bounties", label: "我的悬赏", icon: Megaphone },
  { href: "/client/wallet", label: "钱包 · 支付", icon: Wallet },
  { href: "/client/favorites", label: "收藏的设计师", icon: Heart },
  { href: "/client/settings", label: "账号设置", icon: Settings },
];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identityId = useRoleStore((s) => s.identityId) || "client_lin";
  const { data: client } = useClient(identityId);

  return (
    <ConsoleShell
      title="委托人工作台"
      subtitle={client ? `委托人 · ${client.name}` : "委托人工作台"}
      nav={NAV}
      sidebarBottom={<ConsoleSidebarActions consoleKind="client" />}
    >
      {children}
    </ConsoleShell>
  );
}
