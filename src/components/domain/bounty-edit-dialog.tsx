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
import type { Bounty } from "@/lib/types";

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
    deadline: string;
    requirements: string[];
  }) => void;
  saving?: boolean;
}) {
  const [title, setTitle] = useState(bounty.title);
  const [description, setDescription] = useState(bounty.description);
  const [reward, setReward] = useState(String(bounty.reward));
  const [deadline, setDeadline] = useState(bounty.deadline);
  const [requirementsText, setRequirementsText] = useState(
    bounty.requirements.join("\n"),
  );

  useEffect(() => {
    if (open) {
      setTitle(bounty.title);
      setDescription(bounty.description);
      setReward(String(bounty.reward));
      setDeadline(bounty.deadline);
      setRequirementsText(bounty.requirements.join("\n"));
    }
  }, [open, bounty]);

  const handleSubmit = () => {
    const amount = Math.round(Number(reward));
    if (!title.trim() || !amount || amount <= 0) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      reward: amount,
      deadline,
      requirements: requirementsText
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>修改悬赏</DialogTitle>
          <DialogDescription>
            签约前可调整项目说明、悬赏金额与成果提交截止时间，保存后对外展示将同步更新。
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
          </div>
          <div>
            <Label htmlFor="bounty-desc">项目说明</Label>
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
                min={1}
                step={100}
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="bounty-deadline">成果提交截止</Label>
              <Input
                id="bounty-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
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
          <Button variant="brand" onClick={handleSubmit} disabled={saving}>
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
