import {
  LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES,
  LANDSCAPE_SCHEME_PAYMENT_STAGES,
} from "@/lib/constants";

export type PlatformPaymentStageDef = {
  name: string;
  ratio: number;
  note: string;
};

/** 景观按面积：根据二级专业选择平台付款阶段规则 */
export function resolveLandscapeAreaPaymentStages(
  selectedL2: string[],
): PlatformPaymentStageDef[] {
  const schemeOnly =
    selectedL2.length > 0 && selectedL2.every((l2) => l2 === "scheme");
  if (schemeOnly) {
    return LANDSCAPE_SCHEME_PAYMENT_STAGES.map((s) => ({ ...s }));
  }
  return LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES.map((s) => ({ ...s }));
}

export function landscapeConstructionPaymentStageRatios(): {
  name: string;
  ratio: number;
}[] {
  return LANDSCAPE_CONSTRUCTION_PAYMENT_STAGES.map((s) => ({
    name: s.name,
    ratio: s.ratio,
  }));
}
