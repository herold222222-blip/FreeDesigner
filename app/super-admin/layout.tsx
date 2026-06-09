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
  SlidersHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";

const NAV = [
  { href: "/super-admin", label: "工作台", icon: LayoutDashboard, exact: true },
  { href: "/super-admin/reviews", label: "入驻审核", icon: ClipboardCheck },
  { href: "/super-admin/orders", label: "订单监管", icon: PackageSearch },
  { href: "/super-admin/withdrawals", label: "提现审批", icon: ArrowDownToLine },
  { href: "/super-admin/contracts", label: "合同模板", icon: FileSignature },
  { href: "/super-admin/disputes", label: "纠纷处理", icon: AlertCircle },
  { href: "/super-admin/users", label: "用户管理", icon: Users },
  { href: "/super-admin/levels", label: "等级管理", icon: TrendingUp },
  { href: "/super-admin/content", label: "内容管理", icon: FileText },
  { href: "/super-admin/params", label: "参数中心", icon: SlidersHorizontal },
  { href: "/super-admin/calculator", label: "费用计算器", icon: Calculator },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConsoleBasePathProvider basePath="/super-admin">
      <ConsoleShell title="超级管理员后台" subtitle="全局参数与平台治理" nav={NAV}>
        {children}
      </ConsoleShell>
    </ConsoleBasePathProvider>
  );
}
