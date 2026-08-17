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
import { Textarea } from "@/components/ui/textarea";
import type { DeliverableFile } from "@/lib/types";
import { FileBox, Trash2, Upload } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_LABEL,
  oversizedAttachmentMessage,
} from "@/lib/attachment-limits";

const ACCEPT =
  ".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type RevisionAttachment = { name: string; url?: string; size?: number };

function isAllowed(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type === "application/pdf" ||
    type === "application/msword" ||
    type.includes("wordprocessingml") ||
    name.endsWith(".pdf") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx")
  );
}

function readAsAttachment(file: File): Promise<RevisionAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("读取失败"));
        return;
      }
      resolve({ name: file.name, url: reader.result, size: file.size });
    };
    reader.onerror = () => reject(new Error("读取失败"));
    reader.readAsDataURL(file);
  });
}

export function StageRevisionDialog({
  open,
  onOpenChange,
  file,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: DeliverableFile | null;
  submitting?: boolean;
  onSubmit: (payload: {
    description: string;
    attachments: RevisionAttachment[];
  }) => void;
}) {
  const push = useSessionStore((s) => s.pushNotification);
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<RevisionAttachment[]>([]);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (!open) {
      setDescription("");
      setAttachments([]);
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  const handleFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    if (picked.some((f) => !isAllowed(f))) {
      push({
        title: "文件类型不支持",
        description: "修改意见文档仅支持 Word 或 PDF。",
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
    Promise.all(picked.map(readAsAttachment))
      .then((items) => setAttachments((prev) => [...prev, ...items]))
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

  const canSubmit =
    (description.trim().length > 0 || attachments.length > 0) &&
    !reading &&
    !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>申请返修</DialogTitle>
          <DialogDescription>
            {file
              ? `针对「${file.name}」填写修改意见，或上传 Word / PDF 意见文档（单文件不超过 ${MAX_ATTACHMENT_LABEL}）。`
              : `填写修改意见，或上传 Word / PDF 意见文档（单文件不超过 ${MAX_ATTACHMENT_LABEL}）。`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请说明需要修改的内容…"
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={reading || submitting}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {reading ? "读取中..." : "上传意见文档（Word / PDF）"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {attachments.map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              className="flex items-center gap-2 rounded-xl border border-ink-20 bg-ink-20/10 px-3 py-2"
            >
              <FileBox className="h-4 w-4 shrink-0 text-ink-40" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {item.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() =>
                  setAttachments((prev) => prev.filter((_, j) => j !== i))
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            variant="brand"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({ description: description.trim(), attachments })
            }
          >
            {submitting ? "提交中..." : "提交返修"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
