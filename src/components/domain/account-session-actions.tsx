"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, RefreshCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";

type Props = {
  className?: string;
};

export function AccountSessionActions({ className }: Props) {
  const router = useRouter();
  const logout = useRoleStore((s) => s.logout);
  const push = useSessionStore((s) => s.pushNotification);
  const [busy, setBusy] = useState<"logout" | "switch" | null>(null);

  const endSession = async (mode: "logout" | "switch") => {
    if (busy) return;
    setBusy(mode);
    try {
      await logout();
      push({
        title: mode === "switch" ? "已退出，请登录其他账号" : "已退出登录",
        variant: "success",
      });
      router.replace(mode === "switch" ? "/login" : "/");
      router.refresh();
    } catch (e) {
      push({
        title: "操作失败",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className={className ?? "p-6"}>
      <h3 className="text-base font-semibold text-ink">登录与安全</h3>
      <p className="mt-1 text-sm text-ink-60">
        退出当前会话，或切换到其他账号重新登录。
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={busy !== null}
          onClick={() => endSession("switch")}
        >
          <RefreshCcw className="h-4 w-4" />
          {busy === "switch" ? "正在切换..." : "切换账号"}
        </Button>
        <Button
          variant="outline"
          className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          disabled={busy !== null}
          onClick={() => endSession("logout")}
        >
          <LogOut className="h-4 w-4" />
          {busy === "logout" ? "正在退出..." : "退出登录"}
        </Button>
      </div>
    </Card>
  );
}
