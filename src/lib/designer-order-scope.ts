import { platformFeeAmountFromOrder } from "@/lib/directed-platform-fee";
import { resolveTrackLabels } from "@/lib/constants";
import {
  landscapeTimeTrackFromL3,
  type LandscapeTimeRateTrack,
} from "@/lib/designer-rates";
import { getMergedStageCollaborators } from "@/lib/stage-collaborator";
import { resolveStagePaymentSplits } from "@/lib/stage-payment-splits";
import { computeTimeLineBreakdown } from "@/lib/regular-entrust-quote";
import type {
  DeliverableFile,
  Designer,
  Order,
  OrderAuditAssignment,
  OrderQuoteLine,
  OrderTrackAssignment,
  PaymentStage,
  StageDesignerPaymentSplit,
} from "@/lib/types";

export type DesignerStagePaymentStatus =
  | "settled"
  | "client_paid"
  | "client_pending";

export const DESIGNER_STAGE_PAYMENT_META: Record<
  DesignerStagePaymentStatus,
  { label: string; tone: string }
> = {
  settled: { label: "已结算", tone: "bg-emerald-100 text-emerald-800" },
  client_paid: { label: "委托方已支付", tone: "bg-blue-100 text-blue-800" },
  client_pending: { label: "委托方待支付", tone: "bg-amber-100 text-amber-800" },
};

export function getDesignerStagePaymentStatus(
  stage: PaymentStage,
): DesignerStagePaymentStatus {
  if (stage.status === "released") return "settled";
  if (stage.status === "frozen" || stage.status === "paid") return "client_paid";
  return "client_pending";
}

/** 当前设计师负责的专业分工条目 */
export function getDesignerTrackAssignments(
  order: Order,
  designerId: string,
): OrderTrackAssignment[] {
  const assignments = order.trackAssignments ?? [];
  if (assignments.length === 0 && order.designerId === designerId) {
    return [];
  }
  return assignments.filter((a) => a.designerId === designerId);
}

export function getDesignerTrackIds(order: Order, designerId: string) {
  return new Set(getDesignerTrackAssignments(order, designerId).map((a) => a.id));
}

export function getDesignerSplitsForStage(
  order: Order,
  stage: PaymentStage,
  designerId: string,
): StageDesignerPaymentSplit[] {
  return resolveStagePaymentSplits(order, stage).filter(
    (s) => s.designerId === designerId && s.role !== "auditor" && s.role !== "project_manager",
  );
}

export function getDesignerGrossForStage(
  order: Order,
  stage: PaymentStage,
  designerId: string,
) {
  return getDesignerSplitsForStage(order, stage, designerId).reduce(
    (sum, s) => sum + s.amount,
    0,
  );
}

function allocateByStageRatios(
  total: number,
  stage: PaymentStage,
  stages: PaymentStage[],
) {
  const idx = stages.findIndex((s) => s.id === stage.id);
  if (idx < 0) return Math.round(total * stage.ratio);
  if (idx === stages.length - 1) {
    const prior = stages
      .slice(0, idx)
      .reduce((sum, s) => sum + Math.round(total * s.ratio), 0);
    return total - prior;
  }
  return Math.round(total * stage.ratio);
}

function isExplicitDesignerSplit(split: StageDesignerPaymentSplit) {
  return (
    split.fromReplacement === true ||
    split.role === "collaborator" ||
    split.role === "previous" ||
    split.role === "current"
  );
}

/**
 * 某付款阶段设计师应收 = 其负责专业基础服务费 × 阶段占比。
 * 不含平台管理费、税费，也不另扣订单手续费。
 * 各阶段四舍五入后由最后一阶段吃余数，保证合计等于基础服务费。
 * 不回落到委托人应支付的 stage.amount。
 */
export function getDesignerReceivableForStage(
  order: Order,
  stage: PaymentStage,
  designerId: string,
  options?: {
    designer?: Designer | null;
    involvedStages?: PaymentStage[];
  },
) {
  const total = sumDesignerOrderNetEarnings(
    order,
    designerId,
    options?.designer,
  );
  if (total > 0) {
    const stages =
      options?.involvedStages?.length ? options.involvedStages : [stage];
    return allocateByStageRatios(total, stage, stages);
  }

  const splits = getDesignerSplitsForStage(order, stage, designerId);
  if (
    splits.some(isExplicitDesignerSplit) ||
    (stage.designerPaymentSplits?.length && splits.length > 0)
  ) {
    return splits.reduce((sum, s) => sum + s.amount, 0);
  }
  return 0;
}

export function designerInvolvedInStage(
  order: Order,
  stage: PaymentStage,
  designerId: string,
) {
  if (getDesignerSplitsForStage(order, stage, designerId).length > 0) {
    return true;
  }

  const trackIds = getDesignerTrackIds(order, designerId);
  if (trackIds.size > 0) return true;
  const onStage = (order.trackAssignments ?? []).some(
    (a) => a.designerId === designerId && a.stageId === stage.id,
  );
  if (onStage) return true;

  const collaborators = getMergedStageCollaborators(order, stage.id);
  if (
    collaborators.some(
      (c) =>
        c.primaryDesignerId === designerId ||
        c.collaboratorDesignerId === designerId,
    )
  ) {
    return true;
  }

  if ((order.trackAssignments ?? []).length === 0 && order.designerId === designerId) {
    return true;
  }

  return false;
}

export function getAssignmentDeliverables(
  order: Order,
  assignment: OrderTrackAssignment,
): DeliverableFile[] {
  const stage = order.stages.find((s) => s.id === assignment.stageId);
  if (!stage?.deliverables?.length) return [];
  if (!assignment.deliverableIds?.length) {
    return stage.deliverables.filter(
      (d) => d.designerId === assignment.designerId,
    );
  }
  return stage.deliverables.filter((d) =>
    assignment.deliverableIds!.includes(d.id),
  );
}

export function getDesignerOwnDeliverables(
  order: Order,
  stage: PaymentStage,
  designerId: string,
): DeliverableFile[] {
  const assignments = getDesignerTrackAssignments(order, designerId).filter(
    (a) => a.stageId === stage.id,
  );
  const allowedIds = new Set(
    assignments.flatMap((a) => a.deliverableIds ?? []),
  );

  return (stage.deliverables ?? []).filter(
    (f) =>
      f.designerId === designerId ||
      allowedIds.has(f.id) ||
      ((order.trackAssignments ?? []).length === 0 &&
        order.designerId === designerId),
  );
}

/** 仅本人作为原设计师时保留的历史成果 */
export function getDesignerOwnHistoricalDeliverables(
  order: Order,
  designerId: string,
  trackAssignmentId?: string,
): DeliverableFile[] {
  const seen = new Set<string>();
  const files: DeliverableFile[] = [];
  for (const record of order.designerReplacements ?? []) {
    if (record.previousDesignerId !== designerId) continue;
    if (trackAssignmentId && record.trackAssignmentId !== trackAssignmentId) {
      continue;
    }
    for (const file of record.previousDeliverables ?? []) {
      if (seen.has(file.id)) continue;
      seen.add(file.id);
      files.push(file);
    }
  }
  return files.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
}

export function getAuditsForDesignerTracks(
  order: Order,
  designerId: string,
): OrderAuditAssignment[] {
  const trackIds = getDesignerTrackIds(order, designerId);
  if (trackIds.size === 0) return [];
  return (order.auditAssignments ?? []).filter((a) =>
    trackIds.has(a.trackAssignmentId),
  );
}

export function designerHasProjectManagement(order: Order, designerId: string) {
  if (!order.withProjectManagement || !order.projectManagement) return false;
  return getDesignerTrackAssignments(order, designerId).length > 0;
}

/** 同项目其他专业的当前服务设计师（仅展示身份，不含金额与成果） */
export function getPeerTrackAssignments(
  order: Order,
  designerId: string,
): OrderTrackAssignment[] {
  const mine = getDesignerTrackIds(order, designerId);
  return (order.trackAssignments ?? []).filter(
    (a) => a.designerId !== designerId && !mine.has(a.id),
  );
}

function uniqueAssignedDesignerIds(order: Order) {
  return Array.from(
    new Set((order.trackAssignments ?? []).map((a) => a.designerId)),
  );
}

function designerOwnsOrderShare(order: Order, designerId: string) {
  if (order.designerId === designerId) return true;
  return getDesignerTrackAssignments(order, designerId).length > 0;
}

function trackOfAssignment(assignment: OrderTrackAssignment) {
  return landscapeTimeTrackFromL3(assignment.l3);
}

function getDesignerQuoteLines(order: Order, designerId: string): OrderQuoteLine[] {
  const lines = order.quote?.lines ?? [];
  if (!lines.length) return [];
  const mine = getDesignerTrackAssignments(order, designerId);
  if (mine.length === 0) {
    if (order.designerId === designerId) return lines;
    return [];
  }

  const l3s = new Set(mine.map((a) => a.l3));
  const byL3 = lines.filter((line) => line.l3 && l3s.has(line.l3));
  if (byL3.length) return byL3;

  const peerTracks = new Set(
    (order.trackAssignments ?? [])
      .filter((a) => a.designerId !== designerId)
      .map(trackOfAssignment)
      .filter((track): track is LandscapeTimeRateTrack => Boolean(track)),
  );
  const exclusiveTracks = new Set(
    mine
      .map(trackOfAssignment)
      .filter((track): track is LandscapeTimeRateTrack => {
        if (!track) return false;
        return !peerTracks.has(track);
      }),
  );
  if (exclusiveTracks.size > 0) {
    const byTrack = lines.filter(
      (line) =>
        Boolean(line.track) &&
        exclusiveTracks.has(line.track as LandscapeTimeRateTrack),
    );
    if (byTrack.length) return byTrack;
  }

  if (uniqueAssignedDesignerIds(order).length <= 1) return lines;
  return [];
}

function lineBasicServiceFee(
  order: Order,
  line: OrderQuoteLine,
  designer?: Designer | null,
): number {
  return (
    computeTimeLineBreakdown(order, line, designer)?.basicFee ?? line.basicFee
  );
}

/** 从订单总额扣除平台手续费后的设计师实收 */
export function designerNetFromGross(
  order: Pick<Order, "orderSource" | "feeRate" | "taxCoefficient" | "quote">,
  amount: number,
) {
  const gross = Math.max(0, Math.round(amount) || 0);
  if (gross <= 0) return 0;
  const fee = platformFeeAmountFromOrder(order, gross);
  return Math.max(0, gross - fee);
}

/**
 * 设计师「预计实收」= 其负责专业的基础服务费之和。
 * 基础服务费 = 单价基数 × 工时 × 等级系数 × 地区系数 × 服务范围系数 × 难度系数 × 客户等级系数。
 * 远程服务地区系数统一 1.0，客户等级按委托人实际等级。
 * 不含平台管理费、商务费、审图/项目管理费与税费。
 * 扫码 / 定向下单等无报价单时，按订单总额扣除平台手续费。
 */
export function sumDesignerOrderNetEarnings(
  order: Order,
  designerId: string,
  designer?: Designer | null,
) {
  const lines = getDesignerQuoteLines(order, designerId);
  if (lines.length > 0) {
    return lines.reduce(
      (sum, line) => sum + lineBasicServiceFee(order, line, designer),
      0,
    );
  }
  if (!designerOwnsOrderShare(order, designerId)) return 0;

  const basic = order.quote?.basicFee ?? 0;
  if (basic > 0) {
    const assignments = order.trackAssignments ?? [];
    const mine = getDesignerTrackAssignments(order, designerId);
    const unique = uniqueAssignedDesignerIds(order);
    if (unique.length > 1 && mine.length > 0 && assignments.length > 0) {
      return Math.round(basic * (mine.length / assignments.length));
    }
    return basic;
  }

  return designerNetFromGross(order, order.totalAmount ?? 0);
}

export function canDesignerRequestWithdraw(
  order: Order,
  stage: PaymentStage,
  designerId: string,
) {
  const status = getDesignerStagePaymentStatus(stage);
  if (status !== "settled" && status !== "client_paid") return false;
  return getDesignerGrossForStage(order, stage, designerId) > 0;
}

export function trackLabel(assignment: OrderTrackAssignment) {
  const labels = resolveTrackLabels(assignment.l1, assignment.l2, assignment.l3);
  return `${labels.l1Label} · ${labels.l3Label}`;
}
