import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { RoleSwitcherFab } from "@/components/layout/role-switcher-fab";
import { AuthBootstrap } from "@/components/layout/auth-bootstrap";

export const metadata: Metadata = {
  title: "乐自由 · 工程设计服务对接平台",
  description:
    "建筑、景观、室内、效果图/动画、造价咨询五大设计专业的双向对接平台。委托人精准下单或悬赏招标，设计师在线交付、分阶段结算。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="font-sans">
      <body className="min-h-screen bg-background text-foreground">
        {children}
        <AuthBootstrap />
        <Toaster />
        <RoleSwitcherFab />
      </body>
    </html>
  );
}
