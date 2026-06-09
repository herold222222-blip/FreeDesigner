"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProjectIdCopy({
  code,
  className,
  compact = false,
}: {
  code: string;
  className?: string;
  /** 列表等紧凑场景：仅显示 ID 与复制按钮 */
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (!code) return null;

  return (
    <div
      className={cn("inline-flex items-center gap-1", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className={cn(
          "font-mono text-ink-60",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        {compact ? code : `项目ID ${code}`}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(compact ? "h-5 w-5" : "h-6 w-6")}
        onClick={copy}
        title="复制项目ID"
        aria-label={`复制项目ID ${code}`}
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-600" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}
