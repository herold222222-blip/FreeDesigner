import { getL3Label } from "@/lib/bounty-tracks";
import { DESIGNER_LEVEL_META, SUBJECT_TYPE_META } from "@/lib/constants";
import type { Designer, OrderStatus } from "@/lib/types";

/** 未完结订单状态（用于「进行中订单数」） */
export const ONGOING_ORDER_STATUSES: OrderStatus[] = [
  "matching",
  "pending_schedule",
  "pending_contract",
  "in_progress",
  "pending_review",
  "in_revision",
];

export function isOngoingOrderStatus(status: OrderStatus) {
  return ONGOING_ORDER_STATUSES.includes(status);
}

export function getDesignerPrimaryL3Label(designer: Designer): string {
  const track = designer.primaryTrack;
  if (!track?.l3) return "—";
  return getL3Label(track.l1, track.l3);
}

export function getDesignerSubjectTypeLabel(designer: Designer): string {
  const type = designer.subjectType ?? "individual";
  return SUBJECT_TYPE_META[type]?.label ?? SUBJECT_TYPE_META.individual.label;
}

export function getDesignerLevelLabel(designer: Designer): string {
  const level = designer.level ?? "intern";
  return DESIGNER_LEVEL_META[level]?.label ?? DESIGNER_LEVEL_META.intern.label;
}

/** 拆分设计师所在地：上行省/直辖市，下行地级市/区 */
export function splitDesignerLocation(location?: string): {
  province: string;
  district: string;
} {
  if (!location?.trim()) {
    return { province: "—", district: "—" };
  }
  const segments = location
    .split(/[ ··]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length >= 2) {
    return {
      province: segments[0],
      district: segments.slice(1).join(" · "),
    };
  }
  return { province: segments[0] ?? "—", district: "—" };
}
