"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DesignerCodeCopy({
  code,
  className,
  compact = false,
  prefix,
}: {
  code: string;
  className?: string;
  /** 卡片等紧凑场景：仅显示编号与图标 */
  compact?: boolean;
  /** 紧凑模式下编号前的标签，如 ID: */
  prefix?: string;
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
          compact ? "font-sans text-ink-60" : "font-mono text-ink-60",
          "text-xs",
        )}
      >
        {compact ? `${prefix ? `${prefix} ` : ""}${code}` : `编号 ${code}`}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(compact ? "h-5 w-5" : "h-6 w-6")}
        onClick={copy}
        title="复制编号"
        aria-label={`复制编号 ${code}`}
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
