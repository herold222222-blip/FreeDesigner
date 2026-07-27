import type { ConsoleNavItem } from "@/components/layout/console-shell";
import type { ComponentType } from "react";

/** 在侧栏导航中插入「消息」项（默认放在账号设置前，否则末尾） */
export function withMessagesNavItem(
  nav: ConsoleNavItem[],
  href: string,
  icon: ComponentType<{ className?: string }>,
  unreadCount: number,
): ConsoleNavItem[] {
  const item: ConsoleNavItem = {
    href,
    label: "消息",
    icon,
    badge: unreadCount > 0 ? unreadCount : undefined,
  };
  const settingsIdx = nav.findIndex(
    (n) => n.href.endsWith("/settings") || n.label.includes("账号设置"),
  );
  if (settingsIdx >= 0) {
    return [
      ...nav.slice(0, settingsIdx),
      item,
      ...nav.slice(settingsIdx),
    ];
  }
  return [...nav, item];
}
