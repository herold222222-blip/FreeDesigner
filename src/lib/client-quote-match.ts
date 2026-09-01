import type {
  Designer,
  DesignerLevel,
  Order,
  OrderMatchPool,
  OrderMatchTrackPool,
  Specialty,
} from "@/lib/types";
import {
  designerCanAcceptOrders,
  designerCoversProjectType,
  getAcceptableProjectTypes,
} from "@/lib/designer-portfolio-readiness";
import { DESIGNER_LEVEL_META } from "@/lib/constants";
import { designerHasL3 } from "@/lib/bounty-tracks";
import { maskDesignerPublicName } from "@/lib/designer-contact-privacy";
import {
  extractOrderAssignTracks,
  listAllL3TracksForOrder,
  type OrderAssignTrack,
} from "@/lib/order-assign-tracks";
import {
  isRegularAreaHardscape,
  withAreaHardscapeRemark,
} from "@/lib/regular-entrust-quote";

const WORKLOAD_RANK: Record<string, number> = {
  available: 0,
  moderate: 1,
  busy: 2,
  full: 3,
};

function designerLevelOf(d: Designer): DesignerLevel {
  return d.level ?? "mid_v1";
}

/** 某三级专业槽位下，符合接单/专业/项目类型/L3 覆盖的设计师人数 */
export function countEligibleDesignersForTrack(
  designers: Designer[],
  order: Order,
  track: Pick<OrderAssignTrack, "l3">,
): number {
  return designers.filter((d) => {
    if (!designerEligibleForClientMatch(d, order)) return false;
    if (track.l3 && !designerHasL3(d, track.l3)) return false;
    return true;
  }).length;
}

export function listOrderTrackDesignerCounts(
  designers: Designer[],
  order: Order,
): Array<OrderAssignTrack & { eligibleCount: number }> {
  const tracks = listAllL3TracksForOrder(order);
  const slots = tracks.length ? tracks : [fallbackWholeOrderTrack(order)];
  return slots.map((track) => ({
    ...track,
    eligibleCount: countEligibleDesignersForTrack(designers, order, track),
  }));
}

/** 是否开启接单且具备作品/项目类型资格 */
export function designerEligibleForClientMatch(
  designer: Designer,
  order: Order,
): boolean {
  if (designer.acceptingOrders === false) return false;
  if (!designerCanAcceptOrders(designer)) return false;
  if (designer.specialty !== order.specialty) return false;
  if (!designerCoversProjectType(designer, order.projectType)) return false;
  return true;
}

function scoreDesigner(d: Designer, preferL3?: string): number {
  const workload = WORKLOAD_RANK[d.workloadStatus] ?? 2;
  const rating = d.rating ?? 0;
  const completed = d.completedProjects ?? 0;
  let bonus = 0;
  if (preferL3) {
    if (d.primaryTrack?.l3 === preferL3) bonus += 50;
    if (d.secondaryTracks?.some((t) => t.l3 === preferL3)) bonus += 25;
  }
  return rating * 100 + completed - workload * 10 + bonus;
}

/**
 * 在所选等级内选出最多 limit 名备选（可偏向某一三级专业）。
 */
export function pickCandidateDesigners(input: {
  designers: Designer[];
  order: Order;
  levels: DesignerLevel[];
  excludeIds?: Iterable<string>;
  limit?: number;
  preferL3?: string;
}): Array<Designer & { matchLevel: DesignerLevel }> {
  const exclude = new Set(input.excludeIds ?? []);
  const levelSet = new Set(input.levels);
  const limit = input.limit ?? 3;
  return input.designers
    .filter((d) => {
      if (exclude.has(d.id)) return false;
      if (!levelSet.has(designerLevelOf(d))) return false;
      if (!designerEligibleForClientMatch(d, input.order)) return false;
      if (input.preferL3 && !designerHasL3(d, input.preferL3)) return false;
      return true;
    })
    .map((d) => ({ ...d, matchLevel: designerLevelOf(d) }))
    .sort(
      (a, b) =>
        scoreDesigner(b, input.preferL3) - scoreDesigner(a, input.preferL3),
    )
    .slice(0, limit);
}

/** @deprecated 旧版按单一等级建池 */
export function buildMatchPools(input: {
  designers: Designer[];
  order: Order;
  levels: DesignerLevel[];
  quoteTotalByLevel: Partial<Record<DesignerLevel, number>>;
  excludeIds?: Iterable<string>;
}): OrderMatchPool[] {
  return input.levels.map((level) => {
    const candidates = pickCandidateDesigners({
      designers: input.designers,
      order: input.order,
      levels: [level],
      excludeIds: input.excludeIds,
      limit: 3,
    });
    return {
      level,
      quoteTotal: input.quoteTotalByLevel[level] ?? 0,
      candidates: candidates.map((d) => ({ designerId: d.id })),
    };
  });
}

function fallbackWholeOrderTrack(order: Order): OrderAssignTrack {
  return {
    key: "whole",
    l1: order.specialty,
    l2: "",
    l3: "",
    l2Label: "整单",
    l3Label: "项目服务",
  };
}

/** 按订单三级专业拆分备选池；无专业明细时退化为整单槽位 */
export function buildTrackMatchPools(input: {
  designers: Designer[];
  order: Order;
  levels: DesignerLevel[];
  excludeIds?: Iterable<string>;
}): OrderMatchTrackPool[] {
  const tracks = extractOrderAssignTracks(input.order);
  const slots = tracks.length ? tracks : [fallbackWholeOrderTrack(input.order)];
  return slots.map((track) => {
    const candidates = pickCandidateDesigners({
      designers: input.designers,
      order: input.order,
      levels: input.levels,
      excludeIds: input.excludeIds,
      limit: 3,
      preferL3: track.l3 || undefined,
    });
    return {
      trackKey: track.key,
      l1: track.l1,
      l2: track.l2,
      l3: track.l3,
      l2Label: track.l2Label,
      l3Label: track.l3Label,
      quantityHint: track.quantityHint,
      candidates: candidates.map((d) => ({
        designerId: d.id,
        level: d.matchLevel,
      })),
    };
  });
}

/** 某专业槽位拒绝后，再找下一位 */
export function pickRematchDesignerForTrack(input: {
  designers: Designer[];
  order: Order;
  levels: DesignerLevel[];
  excludeIds: Iterable<string>;
  preferL3?: string;
}): { designer: Designer; level: DesignerLevel } | null {
  const next = pickCandidateDesigners({
    ...input,
    limit: 1,
  });
  const hit = next[0];
  if (!hit) return null;
  return { designer: hit, level: hit.matchLevel };
}

/** @deprecated */
export function pickRematchDesigner(input: {
  designers: Designer[];
  order: Order;
  level: DesignerLevel;
  excludeIds: Iterable<string>;
}): Designer | null {
  const next = pickRematchDesignerForTrack({
    designers: input.designers,
    order: input.order,
    levels: [input.level],
    excludeIds: input.excludeIds,
  });
  return next?.designer ?? null;
}

export function explainClientMatchFailure(input: {
  designers: Designer[];
  order: Order;
  levels: DesignerLevel[];
  excludeIds?: Iterable<string>;
}): string {
  const exclude = new Set(input.excludeIds ?? []);
  const levelLabels = input.levels
    .map((l) => DESIGNER_LEVEL_META[l]?.label ?? l)
    .join("、");
  const projectType = input.order.projectType?.trim() || "";

  const inLevels = input.designers.filter(
    (d) => !exclude.has(d.id) && input.levels.includes(designerLevelOf(d)),
  );
  if (inLevels.length === 0) {
    return `所选「${levelLabels}」档当前没有对应等级的设计师，请换一档或稍后再试。`;
  }

  const sameSpecialty = inLevels.filter(
    (d) => d.specialty === input.order.specialty,
  );
  if (sameSpecialty.length === 0) {
    return `所选等级有设计师，但专业与本单不一致，请换档或调整委托专业。`;
  }

  const accepting = sameSpecialty.filter((d) => d.acceptingOrders !== false);
  if (accepting.length === 0) {
    const names = sameSpecialty
      .slice(0, 3)
      .map((d) => maskDesignerPublicName(d.name))
      .join("、");
    return `所选等级的设计师（如 ${names}）目前均为暂停接单，请稍后再试或换一档。`;
  }

  const withPortfolio = accepting.filter((d) => designerCanAcceptOrders(d));
  if (withPortfolio.length === 0) {
    return `所选等级已开启接单的设计师尚未上传作品案例，暂无法匹配。`;
  }

  if (projectType) {
    const covering = withPortfolio.filter((d) =>
      designerCoversProjectType(d, projectType),
    );
    if (covering.length === 0) {
      const covered = [
        ...new Set(withPortfolio.flatMap((d) => getAcceptableProjectTypes(d))),
      ].slice(0, 6);
      const names = withPortfolio
        .slice(0, 3)
        .map((d) => maskDesignerPublicName(d.name))
        .join("、");
      const coveredNote = covered.length
        ? `他们当前可接单类型为：${covered.join("、")}。`
        : "";
      return `有合适等级且已开启接单的设计师（如 ${names}），但尚未上传「${projectType}」案例，无法匹配。${coveredNote}可将订单项目类型改为上述类型，或请设计师补充「${projectType}」作品后再试。`;
    }
  }

  return `当前所选等级暂无符合条件的设计师，请换一档或稍后再试。`;
}

export function trackPoolTitle(
  pool: OrderMatchTrackPool,
  billingMode?: string,
) {
  const l3Label = withAreaHardscapeRemark(
    pool.l3Label || "项目服务",
    isRegularAreaHardscape({ billingMode, l3: pool.l3 }),
  );
  if (!pool.l3) return l3Label;
  return pool.l2Label ? `${pool.l2Label} · ${l3Label}` : l3Label;
}
