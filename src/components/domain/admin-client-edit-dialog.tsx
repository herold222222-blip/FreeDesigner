"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CLIENT_LEVEL_META } from "@/lib/constants";
import type { AdminClientRow, ClientLevel } from "@/lib/types";
import { useSessionStore } from "@/store/session-store";
import { ImagePlus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: AdminClientRow;
  onSave: (payload: {
    name: string;
    phone: string;
    level: ClientLevel;
    client: AdminClientRow;
  }) => Promise<void>;
}

export function AdminClientEditDialog({
  open,
  onOpenChange,
  client,
  onSave,
}: Props) {
  const push = useSessionStore((s) => s.pushNotification);
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone ?? "");
  const [level, setLevel] = useState<ClientLevel>(client.level ?? "normal");
  const [type, setType] = useState<"individual" | "enterprise">(client.type);
  const [avatar, setAvatar] = useState(client.avatar);
  const [location, setLocation] = useState(client.location ?? "");
  const [companyName, setCompanyName] = useState(client.companyName ?? "");
  const [contactName, setContactName] = useState(client.contactName ?? "");
  const [verified, setVerified] = useState(client.verified);
  const [gender, setGender] = useState<"male" | "female" | "">(
    client.gender ?? "",
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(client.name);
      setPhone(client.phone ?? "");
      setLevel(client.level ?? "normal");
      setType(client.type);
      setAvatar(client.avatar);
      setLocation(client.location ?? "");
      setCompanyName(client.companyName ?? "");
      setContactName(client.contactName ?? "");
      setVerified(client.verified);
      setGender(client.gender ?? "");
    }
  }, [open, client]);

  const handleSave = async () => {
    if (!name.trim()) {
      push({ title: "请填写名称", variant: "destructive" });
      return;
    }
    if (phone && !/^1\d{10}$/.test(phone)) {
      push({ title: "请输入正确的手机号", variant: "destructive" });
      return;
    }
    if (type === "enterprise" && !companyName.trim()) {
      push({ title: "请填写企业全称", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        level,
        client: {
          ...client,
          name: name.trim(),
          avatar,
          type,
          verified,
          location: location.trim() || undefined,
          companyName:
            type === "enterprise" ? companyName.trim() || name.trim() : undefined,
          contactName:
            type === "enterprise" ? contactName.trim() || undefined : undefined,
          gender:
            type === "individual" && gender
              ? gender
              : undefined,
          level,
        },
      });
      onOpenChange(false);
    } catch (e) {
      push({
        title: e instanceof Error ? e.message : "保存失败",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑委托人 · {client.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border border-ink-20">
              {avatar ? (
                <Image
                  src={avatar}
                  alt={name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-ink-20/40 text-ink-40">
                  <ImagePlus className="h-5 w-5" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="client-avatar">头像 URL</Label>
              <Input
                id="client-avatar"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>主体类型</Label>
              <select
                className="h-10 w-full rounded-md border border-ink-20 bg-white px-3 text-sm"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "individual" | "enterprise")
                }
              >
                <option value="individual">个人委托人</option>
                <option value="enterprise">公司委托人</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>用户等级</Label>
              <select
                className="h-10 w-full rounded-md border border-ink-20 bg-white px-3 text-sm"
                value={level}
                onChange={(e) => setLevel(e.target.value as ClientLevel)}
              >
                {Object.entries(CLIENT_LEVEL_META).map(([id, meta]) => (
                  <option key={id} value={id}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-name">
              {type === "enterprise" ? "企业简称 / 展示名" : "姓名"}
            </Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {type === "enterprise" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="client-company">企业全称</Label>
                <Input
                  id="client-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-contact">联系人姓名</Label>
                <Input
                  id="client-contact"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>性别</Label>
              <select
                className="h-10 w-full rounded-md border border-ink-20 bg-white px-3 text-sm"
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as "male" | "female" | "")
                }
              >
                <option value="">未设置</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="client-phone">手机号码</Label>
            <Input
              id="client-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11 位手机号"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-location">所在地</Label>
            <Input
              id="client-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="省 · 市 · 区"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-ink-20 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-ink">认证状态</div>
              <div className="text-xs text-ink-60">企业委托人需审核通过</div>
            </div>
            <Switch checked={verified} onCheckedChange={setVerified} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
