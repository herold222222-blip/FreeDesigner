import { Badge } from "@/components/ui/badge";
import {
  CLIENT_LEVEL_META,
  DESIGNER_LEVEL_META,
  REGION_TIER_META,
} from "@/lib/constants";
import type { ClientLevel, DesignerLevel, RegionTier } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Award, BadgeCheck, Crown, Sparkle } from "lucide-react";

const LEVEL_ICON: Record<DesignerLevel, typeof Sparkle> = {
  intern: Sparkle,
  mid_v1: BadgeCheck,
  senior_v1: Award,
  specialist: Crown,
};

export function DesignerLevelBadge({
  level,
  showCoefficient = false,
}: {
  level: DesignerLevel;
  showCoefficient?: boolean;
}) {
  const meta = DESIGNER_LEVEL_META[level];
  const Icon = LEVEL_ICON[level];
  return (
    <Badge variant={meta.tone} className="gap-1">
      <Icon className="h-3 w-3" />
      {meta.label}
      {showCoefficient && (
        <span className="ml-0.5 opacity-70">· {Math.round(meta.coefficient * 100)}%</span>
      )}
    </Badge>
  );
}

/** 等级对应取费系数 —— 显眼红色徽章（卡片 / 主页等） */
export function DesignerLevelCoefficientBadge({
  level,
  className,
}: {
  level: DesignerLevel;
  className?: string;
}) {
  const coeff = DESIGNER_LEVEL_META[level].coefficient;
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.75rem] items-center justify-center rounded-lg bg-brand px-2 py-0.5 text-xs font-bold tabular-nums tracking-tight text-white shadow-sm ring-1 ring-black/[0.06]",
        className,
      )}
      title={`v1.1 设计师等级取费系数：${Math.round(coeff * 100)}%`}
    >
      {Math.round(coeff * 100)}%
    </span>
  );
}

export function ClientLevelBadge({ level }: { level: ClientLevel }) {
  const meta = CLIENT_LEVEL_META[level];
  return (
    <Badge variant={level === "graylist" ? "rose" : level === "strategic" ? "violet" : "muted"}>
      {meta.label}
    </Badge>
  );
}

export function RegionTierBadge({ tier }: { tier: RegionTier }) {
  const meta = REGION_TIER_META[tier];
  return (
    <Badge variant="outline" className="gap-1">
      {meta.label}
      <span className="opacity-60">· {Math.round(meta.coefficient * 100)}%</span>
    </Badge>
  );
}
