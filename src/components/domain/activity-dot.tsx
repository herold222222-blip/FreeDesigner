"use client";

import { ACTIVITY_META } from "@/lib/constants";
import type { ActivityIndicator } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function ActivityDot({
  level,
  size = "md",
  className,
}: {
  level: ActivityIndicator;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = ACTIVITY_META[level];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "relative inline-flex items-center justify-center rounded-full",
              size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3",
              meta.color,
              className,
            )}
          >
            <span
              className={cn(
                "absolute inset-0 animate-ping rounded-full opacity-50",
                meta.color,
              )}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">登录活跃度 · {meta.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
