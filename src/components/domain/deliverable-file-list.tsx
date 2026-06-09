"use client";

import type { DeliverableFile, Designer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileBox, Lock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";

export function DeliverableFileList({
  files,
  getDesigner,
  compact,
  unlocked = true,
}: {
  files: DeliverableFile[];
  getDesigner?: (id: string) => Designer | undefined;
  compact?: boolean;
  /** 是否已验收解锁下载 */
  unlocked?: boolean;
}) {
  const push = useSessionStore((s) => s.pushNotification);

  if (files.length === 0) return null;

  return (
    <div className={compact ? "grid gap-2" : "grid gap-2 md:grid-cols-2"}>
      {files.map((file) => {
        const uploader =
          file.designerId && getDesigner ? getDesigner(file.designerId) : undefined;
        return (
          <div
            key={file.id}
            className="flex items-center gap-3 rounded-xl border border-ink-20 bg-white p-3"
          >
            {file.thumbnail ? (
              <img
                src={file.thumbnail}
                alt={file.name}
                className={compact ? "h-10 w-10 rounded-lg object-cover" : "h-11 w-11 rounded-lg object-cover"}
              />
            ) : (
              <div
                className={
                  compact ?
                    "flex h-10 w-10 items-center justify-center rounded-lg bg-ink-20"
                  : "flex h-11 w-11 items-center justify-center rounded-lg bg-ink-20"
                }
              >
                <FileBox className="h-4 w-4 text-ink-60" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{file.name}</div>
              <div className="text-[11px] text-ink-60">
                {file.size} · {formatDateTime(file.uploadedAt)}
                {uploader ? ` · ${uploader.name}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() =>
                  push({ title: "已打开成果预览", description: file.name })
                }
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() =>
                  unlocked ?
                    push({ title: "下载已开始", description: file.name })
                  : push({
                      title: "需先验收确认才能下载",
                      variant: "destructive",
                    })
                }
              >
                {unlocked ?
                  <Download className="h-3.5 w-3.5" />
                : <Lock className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
