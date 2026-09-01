import type { Designer, OnlineStatus } from "@/lib/types";

/** 下线后仍显示在线的宽限期 */
export const DESIGNER_ONLINE_GRACE_MS = 2 * 60 * 60 * 1000;

export function designerPresenceFromLastActive(
  lastActiveAt?: string | null,
  now = Date.now(),
): OnlineStatus {
  const t = lastActiveAt ? Date.parse(lastActiveAt) : NaN;
  if (!Number.isFinite(t)) return "offline";
  return now - t <= DESIGNER_ONLINE_GRACE_MS ? "online" : "offline";
}

export function applyDesignerPresence<T extends Pick<Designer, "lastActiveAt" | "onlineStatus">>(
  designer: T,
  now = Date.now(),
): T {
  return {
    ...designer,
    onlineStatus: designerPresenceFromLastActive(designer.lastActiveAt, now),
  };
}
