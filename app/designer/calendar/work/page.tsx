"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 工作日历已合并至个人主页 · 接单档期 */
export default function DesignerWorkCalendarPage() {
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
