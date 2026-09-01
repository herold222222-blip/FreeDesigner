"use client";

import { CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOCKED_HINT = "各方确认费用并完成电子签约后方可扫码支付";

export function StagePayButton({
  unlocked,
  onClick,
  busy,
  label = "立即支付",
  className,
}: {
  unlocked: boolean;
  onClick: () => void;
  busy?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <Button
      variant={unlocked ? "brand" : "soft"}
      size="sm"
      className={cn(className)}
      disabled={!unlocked || busy}
      title={unlocked ? undefined : LOCKED_HINT}
      onClick={onClick}
    >
      <CircleDollarSign className="h-4 w-4" /> {label}
    </Button>
  );
}
