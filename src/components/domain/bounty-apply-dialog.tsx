"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyBountyRequest } from "@/lib/api-client";
import {
  designerEligibleL3s,
  getL3Label,
  normalizeBountyTrack,
} from "@/lib/bounty-tracks";
import type { Bounty, Designer } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BountyApplyDialog({
  bounty,
  designer,
  open,
  onOpenChange,
  onSuccess,
}: {
  bounty: Bounty;
  designer: Designer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const track = normalizeBountyTrack(bounty.primaryTrack);
  const eligibleL3s = useMemo(
    () => (designer ? designerEligibleL3s(designer, track.l3) : []),
    [designer, track.l3],
  );

  const [appliedL3, setAppliedL3] = useState("");
  const [proposal, setProposal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAppliedL3(eligibleL3s.length === 1 ? eligibleL3s[0] : "");
    setProposal("");
    setError("");
  }, [open, eligibleL3s]);

  const handleSubmit = async () => {
    if (!appliedL3) {
      setError("请选择要承接的三级专业");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await applyBountyRequest(bounty.id, {
        appliedL3,
        proposal: proposal.trim(),
        quotedAmount: bounty.reward,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "报名失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>报名悬赏</DialogTitle>
          <DialogDescription className="text-left">
            请选择您要承接的三级专业。发布方将按专业方向筛选合作设计师。
          </DialogDescription>
        </DialogHeader>

        {!designer ? (
          <p className="text-sm text-ink-60">请先登录设计师账号。</p>
        ) : eligibleL3s.length === 0 ? (
          <p className="text-sm text-destructive">
            您的注册专业与悬赏要求的三级专业不匹配，无法报名。
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-ink-40">承接三级专业 *</Label>
              {eligibleL3s.length === 1 ? (
                <p className="mt-2 text-sm font-medium text-ink">
                  {getL3Label(bounty.specialty, eligibleL3s[0])}
                </p>
              ) : (
                <Select value={appliedL3} onValueChange={setAppliedL3}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="选择三级专业" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleL3s.map((l3) => (
                      <SelectItem key={l3} value={l3}>
                        {getL3Label(bounty.specialty, l3)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label className="text-xs text-ink-40">报名说明（选填）</Label>
              <Textarea
                className="mt-2"
                rows={3}
                placeholder="简要说明您的方案思路、团队配置或相关案例"
                value={proposal}
                onChange={(e) => setProposal(e.target.value)}
              />
            </div>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="brand"
            disabled={submitting || !designer || eligibleL3s.length === 0}
            onClick={handleSubmit}
            className={cn(submitting && "opacity-70")}
          >
            {submitting ? "提交中..." : "确认报名"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
