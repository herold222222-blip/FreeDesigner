"use client";

import { ConsoleBasePathProvider } from "@/components/layout/console-base-path";
import { ConsoleShell } from "@/components/layout/console-shell";
import {
  AlertCircle,
  ArrowDownToLine,
  Calculator,
  ClipboardCheck,
  FileSignature,
  FileText,
  LayoutDashboard,
  PackageSearch,
  Users,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "工作台", icon: LayoutDashboard, exact: true },
  { href: "/admin/reviews", label: "入驻审核", icon: ClipboardCheck },
  { href: "/admin/orders", label: "订单监管", icon: PackageSearch },
  { href: "/admin/withdrawals", label: "提现审批", icon: ArrowDownToLine },
  { href: "/admin/contracts", label: "合同模板", icon: FileSignature },
  { href: "/admin/disputes", label: "纠纷处理", icon: AlertCircle },
  { href: "/admin/users", label: "用户管理", icon: Users },
  { href: "/admin/content", label: "内容管理", icon: FileText },
  { href: "/admin/calculator", label: "费用计算器", icon: Calculator },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConsoleBasePathProvider basePath="/admin">
      <ConsoleShell title="管理员后台" subtitle="平台总后台" nav={NAV}>
        {children}
      </ConsoleShell>
    </ConsoleBasePathProvider>
  );
}
