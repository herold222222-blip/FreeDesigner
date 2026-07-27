"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 接单档期已合并至个人主页，保留路由以免旧链接失效 */
export default function CalendarPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/designer/profile#schedule");
  }, [router]);
  return (
    <div className="py-20 text-center text-sm text-ink-60">
      正在前往个人主页接单档期...
    </div>
  );
}
