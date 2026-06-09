"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { parseAdminUsersReturnTo } from "@/lib/admin-return-to";

export function AdminConsoleReturnBar({
  returnTo,
  label = "返回用户管理",
}: {
  returnTo?: string | null;
  label?: string;
}) {
  const href = parseAdminUsersReturnTo(returnTo ?? null);
  if (!href) return null;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-ink-20 bg-white px-4 py-2 text-sm text-ink-60 shadow-sm transition-colors hover:border-ink/30 hover:text-ink"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}
