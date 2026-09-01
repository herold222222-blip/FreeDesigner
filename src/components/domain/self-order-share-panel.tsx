"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildSelfOrderShareUrl } from "@/lib/self-order-share";
import type { Order } from "@/lib/types";
import { Check, Copy, Link2 } from "lucide-react";
import { useSessionStore } from "@/store/session-store";

export function SelfOrderSharePanel({ order }: { order: Order }) {
  const push = useSessionStore((s) => s.pushNotification);
  const [copied, setCopied] = useState<"url" | "code" | null>(null);
  const url = useMemo(
    () =>
      order.selfOrderShareId
        ? buildSelfOrderShareUrl(order.selfOrderShareId)
        : "",
    [order.selfOrderShareId],
  );

  const copy = async (text: string, kind: "url" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      push({
        title: kind === "url" ? "链接已复制" : "验证码已复制",
        variant: "success",
      });
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      push({ title: "复制失败，请手动选择", variant: "destructive" });
    }
  };

  if (!order.selfOrderShareId || !order.selfOrderShareCode) return null;

  return (
    <Card className="space-y-4 border-brand/25 bg-brand/5 p-5">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 h-5 w-5 text-brand" />
        <div>
          <h3 className="text-sm font-semibold text-ink">发给委托人确认</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-60">
            委托人打开链接并输入 4 位验证码后，订单将绑定其账号，双方即可签约。
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-ink-40">确认链接</div>
        <div className="flex gap-2">
          <Input readOnly value={url} className="font-mono text-xs" />
          <Button
            type="button"
            variant="outline"
            onClick={() => copy(url, "url")}
          >
            {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            复制
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs text-ink-40">验证码</div>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-semibold tracking-[0.3em] text-ink">
            {order.selfOrderShareCode}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copy(order.selfOrderShareCode ?? "", "code")}
          >
            {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
