import "server-only";
import { prisma } from "./db";
import type { Designer } from "@/lib/types";

const TOUCH_THROTTLE_MS = 5 * 60 * 1000;

/** 刷新设计师最近活跃时间；登录 / 下线请传 force，心跳则节流 */
export async function touchDesignerPresence(
  userId: string,
  opts?: { force?: boolean },
) {
  if (!userId) return;
  const row = await prisma.designer.findUnique({ where: { userId } });
  if (!row) return;

  const designer = JSON.parse(row.data) as Designer;
  const now = Date.now();
  const prev = Date.parse(designer.lastActiveAt ?? "");
  if (
    !opts?.force &&
    Number.isFinite(prev) &&
    now - prev < TOUCH_THROTTLE_MS
  ) {
    return;
  }

  designer.lastActiveAt = new Date(now).toISOString();
  designer.onlineStatus = "online";
  await prisma.designer.update({
    where: { id: row.id },
    data: { data: JSON.stringify(designer) },
  });
}
