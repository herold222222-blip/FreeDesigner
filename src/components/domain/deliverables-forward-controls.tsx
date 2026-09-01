"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { ensureDeliverablesConfirmShareRequest } from "@/lib/api-client";
import { ForwardDeliverablesConfirmDialog } from "@/components/domain/forward-deliverables-confirm-dialog";

export function DeliverablesForwardControls({
  orderId,
  stageId,
  title,
  enabled,
  confirmable,
  confirmLabel,
}: {
  orderId: string;
  stageId: string;
  title: string;
  enabled: boolean;
  confirmable?: boolean;
  confirmLabel?: string;
}) {
  const [share, setShare] = useState<{
    code: string;
    shareId: string;
    url: string;
  } | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setShare(null);
      return;
    }
    let active = true;
    ensureDeliverablesConfirmShareRequest(orderId, stageId)
      .then((next) => {
        if (active) setShare(next);
      })
      .catch(() => {
        if (active) setShare(null);
      });
    return () => {
      active = false;
    };
  }, [enabled, orderId, stageId]);

  if (!enabled) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {share?.code ? (
          <div className="rounded-lg border border-ink-20 bg-white px-2.5 py-1">
            <div className="text-[10px] leading-none text-ink-40">验证码</div>
            <div className="mt-0.5 font-mono text-sm font-semibold tracking-[0.28em] text-ink">
              {share.code}
            </div>
          </div>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          disabled={!share?.url}
          onClick={() => setForwardOpen(true)}
        >
          <Share2 className="h-3.5 w-3.5" />
          转发
        </Button>
      </div>
      {share ? (
        <ForwardDeliverablesConfirmDialog
          open={forwardOpen}
          onOpenChange={setForwardOpen}
          url={share.url}
          code={share.code}
          title={title}
          confirmLabel={confirmable ? confirmLabel : undefined}
          description={
            confirmable && confirmLabel
              ? `将下方链接或二维码转发出去。对方打开后可查看本阶段全部成果（初步、最终、返修）；若需「${confirmLabel}」，须输入验证码。`
              : "将下方链接或二维码转发出去。对方打开后可查看本阶段全部成果（初步、最终、返修）。验证码请一并转给对方，便于核对链接。"
          }
        />
      ) : null}
    </>
  );
}
