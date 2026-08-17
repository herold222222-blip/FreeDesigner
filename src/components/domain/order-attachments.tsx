import { Button } from "@/components/ui/button";
import type { BountyAttachment } from "@/lib/types";
import { Download, FileBox } from "lucide-react";

function formatFileSize(size?: number) {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function OrderAttachmentsList({
  attachments,
}: {
  attachments?: BountyAttachment[] | null;
}) {
  const items = attachments ?? [];
  return (
    <div className="mt-5">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-40">
        项目附件
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-ink-40">暂无附件</div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((a, i) => (
            <div
              key={`${a.name}-${i}`}
              className="flex items-center justify-between rounded-xl border border-ink-20 bg-ink-20/20 p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileBox className="h-4 w-4 shrink-0 text-ink-60" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">
                    {a.name}
                  </div>
                  {formatFileSize(a.size) ? (
                    <div className="text-[11px] text-ink-40">
                      {formatFileSize(a.size)}
                    </div>
                  ) : null}
                </div>
              </div>
              {a.url ? (
                <Button size="sm" variant="ghost" asChild>
                  <a href={a.url} download={a.name}>
                    <Download className="h-3.5 w-3.5" /> 下载
                  </a>
                </Button>
              ) : (
                <Button size="sm" variant="ghost" disabled>
                  <Download className="h-3.5 w-3.5" /> 不可用
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
