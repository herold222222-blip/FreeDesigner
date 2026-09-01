"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useContractSignaturePad } from "@/components/domain/contract-signature-pad";

export function ContractSignDialog({
  open,
  onOpenChange,
  partyLabel,
  signerName,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyLabel: string;
  signerName: string;
  submitting?: boolean;
  onConfirm: (signature: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>手写签名</DialogTitle>
          <DialogDescription>
            请先在下方画板用手写或鼠标写下「{signerName}」作为{partyLabel}
            签名。写完后点「确认手写」，回到合同页再点「完成签署」。
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <SignaturePadBody
            submitting={submitting}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SignaturePadBody({
  submitting,
  onConfirm,
  onCancel,
}: {
  submitting?: boolean;
  onConfirm: (signature: string) => void;
  onCancel: () => void;
}) {
  const { canvas, clear, exportImage, hasStroke } = useContractSignaturePad();

  return (
    <>
      <div className="rounded-2xl border-2 border-dashed border-ink-20 bg-[#FAFAFA] p-3">
        <div className="mb-2 text-xs font-medium text-ink-60">
          在此手写或鼠标书写姓名
        </div>
        {canvas}
        <p className="mt-2 text-xs text-ink-40">
          {hasStroke
            ? "手写已完成，请点「确认手写」，再回合同页点「完成签署」。"
            : "请先写完姓名。未手写前无法确认。"}
        </p>
      </div>
      <DialogFooter>
        <Button
          variant="ghost"
          type="button"
          onClick={onCancel}
          disabled={submitting}
        >
          取消
        </Button>
        <Button variant="outline" type="button" onClick={clear} disabled={submitting}>
          重写
        </Button>
        <Button
          variant={hasStroke ? "brand" : "outline"}
          type="button"
          disabled={submitting || !hasStroke}
          onClick={() => {
            if (!hasStroke) return;
            const image = exportImage();
            if (!image) return;
            onConfirm(image);
          }}
        >
          {submitting ? "保存中..." : "确认手写"}
        </Button>
      </DialogFooter>
    </>
  );
}
