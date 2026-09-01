import { SPECIALTY_TRACKS, resolveTrackLabels } from "@/lib/constants";
import { getL3Label, normalizeBountyTrack } from "@/lib/bounty-tracks";
import { parseRegularEntrustDescription } from "@/lib/entrust-description";
import type { BountyTrack, Order, Specialty } from "@/lib/types";

/** 管理员委派时按订单拆出的专业分支（通常为三级专业） */
export interface OrderAssignTrack {
  key: string;
  l1: Specialty;
  l2: string;
  l3: string;
  l2Label: string;
  l3Label: string;
  /** 如「10 工日」 */
  quantityHint?: string;
}

/** 在一级专业树中为三级专业解析二级；可优先匹配描述里的二级专业文案 */
export function resolveL2ForL3(
  l1: Specialty,
  l3: string,
  preferredL2Labels?: string[],
): string {
  const root = SPECIALTY_TRACKS.find((t) => t.value === l1);
  if (!root) return "";
  const candidates = root.l2.filter((node) =>
    node.l3.some((x) => x.value === l3),
  );
  if (candidates.length === 0) return "";
  if (preferredL2Labels?.length) {
    const hit = candidates.find((c) => preferredL2Labels.includes(c.label));
    if (hit) return hit.value;
  }
  // 景观园建等同时挂在扩初与施工图下时，优先施工图
  const cd = candidates.find((c) => c.value === "construction_doc");
  if (cd) return cd.value;
  return candidates[0]!.value;
}

function preferredL2LabelsFromDescription(description: string): string[] {
  const parsed = parseRegularEntrustDescription(description);
  const labels: string[] = [];
  for (const line of parsed.billing?.detailLines ?? []) {
    if (line.startsWith("二级专业：")) {
      const raw = line.slice("二级专业：".length).trim();
      for (const part of raw.split(/[、,，]/)) {
        const t = part.trim();
        if (t && t !== "—") labels.push(t);
      }
    }
  }
  return labels;
}

function buildTrack(
  l1: Specialty,
  l3: string,
  preferredL2: string[],
  quantityHint?: string,
  l3LabelOverride?: string,
): OrderAssignTrack | null {
  const l2 = resolveL2ForL3(l1, l3, preferredL2);
  if (!l2) return null;
  const labels = resolveTrackLabels(l1, l2, l3);
  return {
    key: `${l2}:${l3}`,
    l1,
    l2,
    l3,
    l2Label: labels.l2Label,
    l3Label: l3LabelOverride ?? labels.l3Label,
    quantityHint,
  };
}

/** 从报价单 / 委托说明中提取需单独委派的专业列表 */
export function extractOrderAssignTracks(order: Order): OrderAssignTrack[] {
  const l1 = order.specialty;
  const preferredL2 = preferredL2LabelsFromDescription(order.description ?? "");
  const seen = new Set<string>();
  const out: OrderAssignTrack[] = [];

  const push = (track: OrderAssignTrack | null) => {
    if (!track || seen.has(track.key)) return;
    seen.add(track.key);
    out.push(track);
  };

  if (order.quote?.lines?.length) {
    for (const line of order.quote.lines) {
      if (!line.l3) continue;
      const unitLabel =
        line.unit === "month" ? "个月" : line.unit === "sqm" ? "㎡" : "工日";
      push(
        buildTrack(
          l1,
          line.l3,
          preferredL2,
          `${line.quantity} ${unitLabel}`,
          line.l3Label,
        ),
      );
    }
    if (out.length) return out;
  }

  const parsed = parseRegularEntrustDescription(order.description ?? "");
  const detailLines = parsed.billing?.detailLines ?? [];

  for (const line of detailLines) {
    // 「景观园建专业（含简单结构）：10 工日」
    const sep = line.indexOf("：");
    if (sep > 0 && !line.startsWith("二级专业") && !line.startsWith("面积")) {
      const label = line.slice(0, sep).trim();
      const rest = line.slice(sep + 1).trim();
      const l3 = findL3ByLabel(l1, label);
      if (l3) {
        push(buildTrack(l1, l3, preferredL2, rest || undefined, label));
      }
    }

    // 「面积：100 ㎡ · 三级专业：A、B」或单独「三级专业：A、B」
    const areaMatch = line.match(/三级专业：(.+)$/);
    if (areaMatch) {
      for (const part of areaMatch[1]!.split(/[、,，]/)) {
        const label = part.trim();
        if (!label || label === "—") continue;
        const l3 = findL3ByLabel(l1, label);
        if (l3) push(buildTrack(l1, l3, preferredL2, undefined, label));
      }
    }
  }

  return out;
}

/**
 * 客服确认用：在订单已解析的二级专业下，列出全部三级专业。
 * 报价未勾选的专业也保留，便于展示「0 人」。
 */
export function listAllL3TracksForOrder(order: Order): OrderAssignTrack[] {
  const extracted = extractOrderAssignTracks(order);
  const l1 = order.specialty;
  const root = SPECIALTY_TRACKS.find((t) => t.value === l1);
  if (!root) return extracted;

  const l2Values = new Set(extracted.map((t) => t.l2).filter(Boolean));
  if (l2Values.size === 0) {
    for (const label of preferredL2LabelsFromDescription(order.description ?? "")) {
      const node = root.l2.find((n) => n.label === label);
      if (node) l2Values.add(node.value);
    }
  }
  const l2Nodes = l2Values.size
    ? root.l2.filter((n) => l2Values.has(n.value))
    : root.l2;

  const byL3 = new Map(extracted.map((t) => [t.l3, t]));
  const out: OrderAssignTrack[] = [];
  const seen = new Set<string>();
  for (const l2 of l2Nodes) {
    for (const l3 of l2.l3) {
      const key = `${l2.value}:${l3.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = byL3.get(l3.value);
      if (existing && existing.l2 === l2.value) {
        out.push(existing);
        continue;
      }
      out.push({
        key,
        l1,
        l2: l2.value,
        l3: l3.value,
        l2Label: l2.label,
        l3Label: l3.label,
        quantityHint:
          existing?.l2 === l2.value ? existing.quantityHint : undefined,
      });
    }
  }
  return out;
}

function findL3ByLabel(l1: Specialty, label: string): string | null {
  const root = SPECIALTY_TRACKS.find((t) => t.value === l1);
  if (!root) return null;
  const normalized = label.replace(/（不含结构图）/g, "").trim();
  for (const l2 of root.l2) {
    const hit = l2.l3.find((x) => x.label === normalized || x.label === label);
    if (hit) return hit.value;
  }
  // 宽松：去掉空白后再比一次
  const compact = normalized.replace(/\s/g, "");
  for (const l2 of root.l2) {
    const hit = l2.l3.find((x) => x.label.replace(/\s/g, "") === compact);
    if (hit) return hit.value;
  }
  return null;
}

export function orderAssignTrackTitle(track: OrderAssignTrack) {
  return `${track.l2Label} · ${track.l3Label}`;
}

/** 订单是否涉及该设计师（主设计师或专业分工） */
export function orderInvolvesDesigner(order: Order, designerId: string) {
  if (order.designerId === designerId) return true;
  return (order.trackAssignments ?? []).some((a) => a.designerId === designerId);
}

export function formatAssignTrackLabel(l1: Specialty, l2: string, l3: string) {
  const labels = resolveTrackLabels(l1, l2, l3);
  return `${labels.l2Label} · ${labels.l3Label || getL3Label(l1, l3)}`;
}

export function orderHasSpecialtyLevels(track?: BountyTrack | null) {
  if (!track) return false;
  const normalized = normalizeBountyTrack(track);
  return normalized.l2.length > 0 || normalized.l3.length > 0;
}

/** 订单详情「专业需求」卡片：一级 / 二级 / 三级 */
export function bountyTrackFromOrder(order: Order): BountyTrack {
  const stored = order.primaryTrack
    ? normalizeBountyTrack(order.primaryTrack)
    : null;
  const l2 = new Set<string>(stored?.l2 ?? []);
  const l3 = new Set<string>(stored?.l3 ?? []);
  for (const track of extractOrderAssignTracks(order)) {
    if (track.l2) l2.add(track.l2);
    if (track.l3) l3.add(track.l3);
  }
  for (const a of order.trackAssignments ?? []) {
    if (a.l2) l2.add(a.l2);
    if (a.l3) l3.add(a.l3);
  }
  for (const line of order.quote?.lines ?? []) {
    if (line.l3) l3.add(line.l3);
  }
  if (l2.size === 0) {
    const root = SPECIALTY_TRACKS.find((t) => t.value === order.specialty);
    if (root) {
      for (const label of preferredL2LabelsFromDescription(
        order.description ?? "",
      )) {
        const node = root.l2.find((n) => n.label === label);
        if (node) l2.add(node.value);
      }
    }
  }
  return {
    l1: stored?.l1 ?? order.specialty,
    l2: [...l2],
    l3: [...l3],
  };
}
