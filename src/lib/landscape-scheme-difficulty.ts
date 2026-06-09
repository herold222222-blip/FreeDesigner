import {
  LANDSCAPE_SCHEME_DIFFICULTY,
  type LandscapeSchemeDifficultyKey,
} from "@/lib/constants";
import type {
  LandscapeSchemeDifficultyOption,
  PlatformPricingConfig,
} from "@/lib/platform-pricing";

export type SchemeDifficultyOption = LandscapeSchemeDifficultyOption;

export function getSchemeDifficultyOptions(
  config?: PlatformPricingConfig,
): SchemeDifficultyOption[] {
  return [...(config?.landscapeSchemeDifficulty ?? LANDSCAPE_SCHEME_DIFFICULTY)];
}

/** 根据单方造价（元/㎡）推断方案难度档位 */
export function inferSchemeDifficultyFromCostPerSqm(
  costPerSqm: number,
  config?: PlatformPricingConfig,
): LandscapeSchemeDifficultyKey {
  const options = getSchemeDifficultyOptions(config);
  const ultraHigh = options.find((o) => o.key === "ultra_high");
  const ultraMin = ultraHigh?.minCostPerSqm ?? 1500;
  if (costPerSqm >= ultraMin) return "ultra_high";
  for (const opt of options) {
    if (opt.key === "ultra_high") continue;
    const min = opt.minCostPerSqm ?? 0;
    const max = opt.maxCostPerSqm ?? Infinity;
    if (costPerSqm >= min && costPerSqm < max) return opt.key;
  }
  return "very_low";
}

export function getSchemeDifficultyCoefficient(
  key: LandscapeSchemeDifficultyKey,
  config?: PlatformPricingConfig,
): number {
  const opt = getSchemeDifficultyOptions(config).find((o) => o.key === key);
  return opt?.coefficient ?? 1;
}
