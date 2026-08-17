"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DeliverableFile, PaymentStage } from "@/lib/types";
import { FileBox, ImageIcon, Trash2, Upload } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_LABEL,
  oversizedAttachmentMessage,
} from "@/lib/attachment-limits";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.pdf";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedFile(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type.startsWith("image/") ||
    type === "application/pdf" ||
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif")
  );
}

function readFileAsDeliverable(file: File): Promise<DeliverableFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("读取失败"));
        return;
      }
      const isImage = file.type.startsWith("image/");
      resolve({
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
        uploadedAt: new Date().toISOString(),
        url: reader.result,
        thumbnail: isImage ? reader.result : undefined,
        locked: false,
      });
    };
    reader.onerror = () => reject(new Error("读取失败"));
    reader.readAsDataURL(file);
  });
}

export function StageDeliverableUploadDialog({
  open,
  onOpenChange,
  stage,
  revising,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: PaymentStage | null;
  revising?: boolean;
  submitting?: boolean;
  onConfirm: (files: DeliverableFile[]) => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<DeliverableFile[]>([]);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  const handleFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    const invalid = picked.find((f) => !isAllowedFile(f));
    if (invalid) {
      push({
        title: "文件类型不支持",
        description: "请上传图片（JPG / PNG / WebP / GIF）或 PDF。",
        variant: "destructive",
      });
      return;
    }
    const oversized = picked.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (oversized) {
      push({
        title: "文件过大",
        description: oversizedAttachmentMessage(oversized.name),
        variant: "destructive",
      });
      return;
    }
    setReading(true);
    Promise.all(picked.map(readFileAsDeliverable))
      .then((items) => setFiles((prev) => [...prev, ...items]))
      .catch(() =>
        push({
          title: "读取失败",
          description: "请重新选择文件后再试。",
          variant: "destructive",
        }),
      )
      .finally(() => {
        setReading(false);
        if (fileRef.current) fileRef.current.value = "";
      });
  };

  const canConfirm = files.length > 0 && !reading && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {revising ? "上传返修成果" : "上传本阶段成果"}
          </DialogTitle>
          <DialogDescription>
            {stage ? `「${stage.name}」` : "本阶段"}请上传成果或确认单，仅支持图片或 PDF，单文件不超过 {MAX_ATTACHMENT_LABEL}。至少上传 1 个文件后才能确认。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={reading || submitting}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {reading ? "读取中..." : "选择图片或 PDF"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {files.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-20 bg-ink-20/10 px-3 py-6 text-center text-xs text-ink-40">
              尚未选择文件
            </p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2"
                >
                  {file.thumbnail ? (
                    <img
                      src={file.thumbnail}
                      alt={file.name}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                      {file.type === "application/pdf" ? (
                        <FileBox className="h-4 w-4 text-ink-60" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-ink-60" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-ink">{file.name}</div>
                    <div className="text-[11px] text-ink-40">{file.size}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={submitting}
                    onClick={() =>
                      setFiles((prev) => prev.filter((f) => f.id !== file.id))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            variant="brand"
            disabled={!canConfirm}
            onClick={() => onConfirm(files)}
          >
            {submitting ? "提交中..." : "确认上传"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
