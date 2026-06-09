"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRoleStore } from "@/store/role-store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Crown,
  Lightbulb,
  Repeat,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import {
  DEMO_IDENTITIES,
  inferDemoIdentityKey,
  type DemoIdentityKey,
} from "@/lib/demo-accounts";
import type { Role } from "@/lib/types";

const ICON_BY_KEY: Record<DemoIdentityKey, typeof User> = {
  client: User,
  designer: Sparkles,
  designer_team: Users,
  designer_company: Building2,
  admin: ShieldCheck,
  super_admin: Crown,
  guest: Lightbulb,
};

export function RoleSwitcherFab() {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [switching, setSwitching] = useState(false);
  const router = useRouter();
  const { role, identityId, setRole } = useRoleStore();

  useEffect(() => setHydrated(true), []);
  if (!hydrated) return null;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "off") return null;

  const currentKey = inferDemoIdentityKey(role, identityId);
  const current =
    DEMO_IDENTITIES.find((d) => d.key === currentKey) ??
    DEMO_IDENTITIES[DEMO_IDENTITIES.length - 1];

  const handleSwitch = async (key: DemoIdentityKey) => {
    if (switching) return;
    const opt = DEMO_IDENTITIES.find((d) => d.key === key);
    if (!opt) return;

    setSwitching(true);
    try {
      const res = await apiFetch<{ role: Role; identityId: string }>(
        "/api/auth/demo-login",
        { method: "POST", body: JSON.stringify({ role: key }) },
      );
      setRole(res.role, res.identityId);
    } catch {
      setRole(opt.sessionRole, opt.designerId);
    } finally {
      setSwitching(false);
      setOpen(false);
      router.push(opt.route);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="group fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-ink-20 bg-white pl-3 pr-4 py-2 shadow-2xl shadow-ink/10 transition-all hover:border-ink hover:shadow-ink/20">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white">
            <Repeat className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-ink-40">
              演示身份切换
            </div>
            <div className="text-xs font-semibold text-ink">{current.label}</div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>演示身份切换</DialogTitle>
          <DialogDescription>
            原型阶段的便利功能：一键切换委托人、个人设计师、设计团队、设计公司、管理员与超级管理员，
            查看同一笔订单在不同视角下的呈现。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2.5">
          {DEMO_IDENTITIES.map((opt) => {
            const Icon = ICON_BY_KEY[opt.key];
            const isCurrent = opt.key === currentKey;
            return (
              <button
                key={opt.key}
                disabled={switching}
                onClick={() => handleSwitch(opt.key)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  isCurrent
                    ? "border-ink bg-ink-20/30"
                    : "border-ink-20 hover:border-ink/40 hover:bg-ink-20/10"
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">
                    {opt.label}
                  </div>
                  <div className="text-xs text-ink-60">{opt.description}</div>
                </div>
                {isCurrent ? (
                  <span className="text-xs font-medium text-brand">当前身份</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
