"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchInboxUnreadCount } from "@/lib/api-client";
import { useRoleStore } from "@/store/role-store";

const POLL_MS = 30_000;

/** 全局未读站内信数量（顶栏铃铛 / 工作台侧栏共用） */
export function useInboxUnreadCount() {
  const role = useRoleStore((s) => s.role);
  const bootstrapped = useRoleStore((s) => s.bootstrapped);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!bootstrapped || role === "guest") {
      setCount(0);
      return;
    }
    try {
      const { count: next } = await fetchInboxUnreadCount();
      setCount(next);
    } catch {
      /* ignore */
    }
  }, [bootstrapped, role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!bootstrapped || role === "guest") return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("lezyou:inbox-changed", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("lezyou:inbox-changed", onFocus);
    };
  }, [bootstrapped, role, refresh]);

  return { count, refresh };
}

export function notifyInboxChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lezyou:inbox-changed"));
  }
}
