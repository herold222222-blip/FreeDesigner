import {
  newStageId,
  paymentStagesValid,
  type ScanPaymentStageDraft,
} from "@/lib/scan-order";
import type { Bounty, BountyPaymentStage } from "@/lib/types";

export function defaultBountyPaymentStageDrafts(): ScanPaymentStageDraft[] {
  return [
    {
      id: newStageId(),
      name: "项目款",
      ratio: 100,
      note: "双方签约后支付本笔款项，资金由平台托管。",
    },
  ];
}

export function draftsFromBountyStages(
  stages: BountyPaymentStage[] | undefined,
): ScanPaymentStageDraft[] {
  if (!stages?.length) return defaultBountyPaymentStageDrafts();
  return stages.map((stage) => ({
    id: newStageId(),
    name: stage.name,
    ratio: stage.ratio,
    note: stage.note ?? "",
  }));
}

export function toBountyPaymentStages(
  drafts: ScanPaymentStageDraft[],
): BountyPaymentStage[] {
  return drafts.map((stage) => ({
    name: stage.name.trim() || "付款阶段",
    ratio: stage.ratio,
    note: stage.note?.trim() || undefined,
  }));
}

export function parseBountyPaymentStages(
  raw: unknown,
): BountyPaymentStage[] | null {
  if (!Array.isArray(raw) || raw.length < 1) return null;
  const stages: BountyPaymentStage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as { name?: unknown; ratio?: unknown; note?: unknown };
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const ratio = Number(row.ratio);
    const note = typeof row.note === "string" ? row.note.trim() : "";
    if (!name || !note || !Number.isFinite(ratio) || ratio <= 0) return null;
    stages.push({
      name,
      ratio: Math.round(ratio),
      note,
    });
  }
  if (!paymentStagesValid(stages.map((stage, i) => ({ ...stage, id: `s${i}` })))) {
    return null;
  }
  return stages;
}

export function resolveBountyPaymentStages(
  bounty: Pick<Bounty, "paymentStages">,
): BountyPaymentStage[] {
  if (bounty.paymentStages?.length) return bounty.paymentStages;
  return [{ name: "项目款", ratio: 100 }];
}
