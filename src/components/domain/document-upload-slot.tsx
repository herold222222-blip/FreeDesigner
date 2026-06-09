"use client";

import { Upload, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function DocumentUploadSlot({
  label,
  uploaded,
  fileName,
  icon: Icon,
  emptyHint,
  onUpload,
  onRemove,
  className,
}: {
  label: string;
  uploaded: boolean;
  fileName: string;
  icon: LucideIcon;
  emptyHint: string;
  onUpload: () => void;
  onRemove: () => void;
  className?: string;
}) {
  if (uploaded) {
    return (
      <div
        className={cn(
          "flex items-start justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <div className="text-sm font-medium text-emerald-900">{fileName}</div>
            <div className="mt-0.5 text-xs text-emerald-700">已上传 · 等待审核</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-emerald-700 hover:text-emerald-900"
          aria-label={`移除${label}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onUpload}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-20 bg-ink-20/20 p-8 text-ink-60 hover:border-ink/40 hover:text-ink",
        className,
      )}
    >
      <Upload className="h-6 w-6" />
      <div className="text-sm font-medium">{emptyHint}</div>
      <div className="text-xs text-ink-40">支持 JPG / PNG / PDF · 单文件不超过 10MB</div>
    </button>
  );
}
