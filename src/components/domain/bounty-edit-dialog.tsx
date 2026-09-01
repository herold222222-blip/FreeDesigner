"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isBountyRewardValid } from "@/lib/bounty-manage";
import {
  BOUNTY_INVOICE_OPTIONS,
  resolveBountyInvoiceType,
} from "@/lib/bounty-invoice";
import type {
  Bounty,
  BountyInvoiceType,
  BountyPaymentStage,
  BountyTitleVisibility,
} from "@/lib/types";
import { parseBountyTitleVisibility } from "@/lib/bounty-hall-privacy";
import { cn } from "@/lib/utils";
import {
  parseRegularEntrustDescription,
  replaceEntrustBrief,
} from "@/lib/entrust-description";
import { ScanPaymentStagesEditor } from "@/components/domain/scan-payment-stages-editor";
import { paymentStagesValid } from "@/lib/scan-order";
import {
  draftsFromBountyStages,
  toBountyPaymentStages,
} from "@/lib/bounty-payment-stages";
import { BountyDeadlineField } from "@/components/domain/bounty-deadline-field";
import { BountyTitleVisibilityField } from "@/components/domain/bounty-title-visibility-field";
import { BountyValidUntilField } from "@/components/domain/bounty-valid-until-field";
import {
  deadlineFromDraft,
  draftFromDeadline,
  draftFromValidUntil,
  isDeadlineDraftComplete,
  isValidUntilDraftComplete,
  normalizeBountyDeadline,
  normalizeBountyValidUntil,
  validUntilFromDraft,
  type BountyDeadlineDraft,
  type BountyValidUntilDraft,
} from "@/lib/bounty-validity";

export function BountyEditDialog({
  open,
  onOpenChange,
  bounty,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bounty: Bounty;
  onSave: (payload: {
    title: string;
    description: string;
    reward: number;
    invoiceType: BountyInvoiceType;
    paymentStages: BountyPaymentStage[];
    deadline: string;
    validUntil: string | null;
    titleVisibility: BountyTitleVisibility;
    requirements: string[];
  }) => void;
  saving?: boolean;
}) {
  const [title, setTitle] = useState(bounty.title);
  const [titleVisibility, setTitleVisibility] = useState<BountyTitleVisibility>(
    () => parseBountyTitleVisibility(bounty.titleVisibility),
  );
  const [description, setDescription] = useState(
    () => parseRegularEntrustDescription(bounty.description).brief,
  );
  const [reward, setReward] = useState(String(bounty.reward));
  const [invoiceType, setInvoiceType] = useState<BountyInvoiceType>(() =>
    resolveBountyInvoiceType(bounty),
  );
  const [paymentStages, setPaymentStages] = useState(() =>
    draftsFromBountyStages(bounty.paymentStages),
  );
  const [deadlineDraft, setDeadlineDraft] = useState<BountyDeadlineDraft>(() =>
    draftFromDeadline(bounty.deadline),
  );
  const [validUntilDraft, setValidUntilDraft] = useState<BountyValidUntilDraft>(
    () => draftFromValidUntil(bounty.validUntil),
  );
  const [requirementsText, setRequirementsText] = useState(
    bounty.requirements.join("\n"),
  );

  useEffect(() => {
    if (open) {
      setTitle(bounty.title);
      setTitleVisibility(parseBountyTitleVisibility(bounty.titleVisibility));
      setDescription(parseRegularEntrustDescription(bounty.description).brief);
      setReward(String(bounty.reward));
      setInvoiceType(resolveBountyInvoiceType(bounty));
      setPaymentStages(draftsFromBountyStages(bounty.paymentStages));
      setDeadlineDraft(draftFromDeadline(bounty.deadline));
      setValidUntilDraft(draftFromValidUntil(bounty.validUntil));
      setRequirementsText(bounty.requirements.join("\n"));
    }
  }, [open, bounty]);

  const handleSubmit = () => {
    const amount = Math.round(Number(reward));
    if (!title.trim() || !isBountyRewardValid(amount)) return;
    if (!paymentStagesValid(paymentStages)) return;
    if (!isValidUntilDraftComplete(validUntilDraft)) return;
    if (!isDeadlineDraftComplete(deadlineDraft)) return;
    const validUntilResult = normalizeBountyValidUntil(
      validUntilFromDraft(validUntilDraft),
      { requireFuture: validUntilDraft.mode === "until" },
    );
    if (!validUntilResult.ok) return;
    const deadlineResult = normalizeBountyDeadline(deadlineFromDraft(deadlineDraft));
    if (!deadlineResult.ok) return;
    onSave({
      title: title.trim(),
      description: replaceEntrustBrief(bounty.description, description),
      reward: amount,
      invoiceType,
      paymentStages: toBountyPaymentStages(paymentStages),
      deadline: deadlineResult.value,
      validUntil: validUntilResult.value,
      titleVisibility,
      requirements: requirementsText
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>修改悬赏</DialogTitle>
          <DialogDescription>
            签约前可调整项目说明、悬赏金额、付款阶段、悬赏有效期与成果提交截止时间，保存后对外展示将同步更新。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bounty-title">项目标题</Label>
            <Input
              id="bounty-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2"
            />
            <div className="mt-2">
              <BountyTitleVisibilityField
                value={titleVisibility}
                onChange={setTitleVisibility}
                title={title}
                primaryTrack={bounty.primaryTrack}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bounty-desc">项目备注</Label>
            <Textarea
              id="bounty-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-2"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="bounty-reward">悬赏金额（元）</Label>
              <Input
                id="bounty-reward"
                type="number"
                min={101}
                step={1}
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                className="mt-2"
              />
              <p className="mt-1.5 text-xs text-ink-40">须大于 ¥100</p>
            </div>
            <div>
              <Label>发票信息</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {BOUNTY_INVOICE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setInvoiceType(opt.value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs transition-colors",
                      invoiceType === opt.value
                        ? "border-ink bg-ink text-white"
                        : "border-ink-20 text-ink-60 hover:border-ink/40",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label>成果提交时间</Label>
            <div className="mt-2">
              <BountyDeadlineField
                value={deadlineDraft}
                onChange={setDeadlineDraft}
              />
            </div>
          </div>
          <div>
            <Label>悬赏有效期</Label>
            <div className="mt-2">
              <BountyValidUntilField
                value={validUntilDraft}
                onChange={setValidUntilDraft}
              />
            </div>
          </div>
          <ScanPaymentStagesEditor
            stages={paymentStages}
            onChange={setPaymentStages}
            totalAmount={Math.max(0, Math.round(Number(reward)) || 0)}
          />
          <div>
            <Label htmlFor="bounty-req">设计师要求（每行一条）</Label>
            <Textarea
              id="bounty-req"
              value={requirementsText}
              onChange={(e) => setRequirementsText(e.target.value)}
              rows={3}
              className="mt-2"
              placeholder="例如：3 个同类案例"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="brand"
            onClick={handleSubmit}
            disabled={
              saving ||
              !paymentStagesValid(paymentStages) ||
              !isValidUntilDraftComplete(validUntilDraft) ||
              !isDeadlineDraftComplete(deadlineDraft)
            }
          >
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
