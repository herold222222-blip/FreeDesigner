"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { canViewMemberContent } from "@/lib/guest-access";
import { useRoleStore } from "@/store/role-store";
import { useSessionStore } from "@/store/session-store";
import { ArrowRight } from "lucide-react";

/** 首页主 CTA：设计师进悬赏大厅，其他人浏览设计师；游客点击则提醒注册入驻 */
export function HomeHeroBrowseCta() {
  const role = useRoleStore((s) => s.role);
  const bootstrapped = useRoleStore((s) => s.bootstrapped);
  const promptGuestAccess = useSessionStore((s) => s.promptGuestAccess);
  const isDesigner = bootstrapped && role === "designer";
  const label = isDesigner ? "浏览悬赏项目" : "浏览全部设计师";
  const href = isDesigner ? "/bounties" : "/designers";

  if (!bootstrapped || !canViewMemberContent(role)) {
    return (
      <Button
        size="lg"
        variant="outline"
        type="button"
        onClick={() => promptGuestAccess()}
      >
        {label} <ArrowRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button asChild size="lg" variant="outline">
      <Link href={href}>
        {label} <ArrowRight className="h-4 w-4" />
      </Link>
    </Button>
  );
}
