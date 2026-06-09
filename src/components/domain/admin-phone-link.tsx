"use client";

import { cn } from "@/lib/utils";

/** 管理员后台手机号：移动端可点击拨打 */
export function AdminPhoneLink({
  phone,
  className,
}: {
  phone?: string | null;
  className?: string;
}) {
  if (!phone) {
    return <span className={cn("text-xs text-ink-40", className)}>—</span>;
  }

  const display = phone.replace(/\s/g, "");

  return (
    <>
      <a
        href={`tel:${display}`}
        className={cn(
          "font-mono text-sm text-brand underline-offset-2 hover:underline sm:hidden",
          className,
        )}
      >
        {display}
      </a>
      <span
        className={cn("hidden font-mono text-sm text-ink-60 sm:inline", className)}
      >
        {display}
      </span>
    </>
  );
}
