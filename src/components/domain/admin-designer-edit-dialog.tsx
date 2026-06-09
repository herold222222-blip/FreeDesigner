"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DESIGNER_LEVEL_META, SPECIALTIES, SUB_SPECIALTIES } from "@/lib/constants";
import {
  designerDraftFromDesigner,
  mergeDesignerProfile,
  type DesignerProfileDraft,
} from "@/lib/designer-profile-draft";
import {
  ONLINE_MEETING_TIME_OPTIONS,
  OVERSEAS_COUNTRY_OPTIONS,
  TRAVEL_DURATION_OPTIONS,
} from "@/lib/designer-service-settings";
import type { AdminDesignerRow, DesignerLevel, SubSpecialty } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { ImagePlus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designer: AdminDesignerRow;
  onSave: (payload: {
    name: string;
    phone: string;
    level: DesignerLevel;
    designer: ReturnType<typeof mergeDesignerProfile>;
  }) => Promise<void>;
}

export function AdminDesignerEditDialog({
  open,
  onOpenChange,
  designer,
  onSave,
}: Props) {
  const initialDraft = useMemo(
    () => ({
      ...designerDraftFromDesigner(designer),
      phone: designer.phone ?? designerDraftFromDesigner(designer).phone ?? "",
    }),
    [designer],
  );

  const [name, setName] = useState(designer.name);
  const [level, setLevel] = useState<DesignerLevel>(designer.level ?? "mid_v1");
  const [form, setForm] = useState<DesignerProfileDraft>(initialDraft);
  const [submitting, setSubmitting] = useState(false);
  const push = useSessionStore((s) => s.pushNotification);

  useEffect(() => {
    if (open) {
      setName(designer.name);
      setLevel(designer.level ?? "mid_v1");
      setForm({
        ...designerDraftFromDesigner(designer),
        phone: designer.phone ?? "",
      });
    }
  }, [open, designer]);

  const patch = (next: Partial<DesignerProfileDraft>) =>
    setForm((prev) => ({ ...prev, ...next }));

  const specialty = form.specialty ?? designer.specialty;
  const subs = form.subSpecialties ?? [];

  const toggleSub = (s: SubSpecialty) => {
    patch({
      subSpecialties: subs.includes(s) ? subs.filter((x) => x !== s) : [...subs, s],
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      push({ title: "请填写姓名", variant: "destructive" });
      return;
    }
    if (form.phone && !/^1\d{10}$/.test(form.phone)) {
      push({ title: "请输入正确的手机号", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const merged = mergeDesignerProfile(designer, form);
      merged.name = name.trim();
      merged.level = level;
      await onSave({
        name: name.trim(),
        phone: form.phone ?? "",
        level,
        designer: merged,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-ink-20 px-6 py-4">
          <DialogTitle>编辑设计师 · {designer.name}</DialogTitle>
          <p className="text-sm text-ink-60">
            可修改注册资料、头像、等级与手机号等全部对外展示信息。
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-ink-20 bg-ink-20/20 p-1">
              {[
                { value: "basic", label: "账号与基础" },
                { value: "specialty", label: "专业方向" },
                { value: "profile", label: "主页文案" },
                { value: "service", label: "服务设置" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-white sm:text-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="basic" className="mt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>姓名</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>手机号</Label>
                  <Input
                    value={form.phone ?? ""}
                    onChange={(e) => patch({ phone: e.target.value })}
                    placeholder="11 位手机号"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>设计师等级</Label>
                  <select
                    className="h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
                    value={level}
                    onChange={(e) => setLevel(e.target.value as DesignerLevel)}
                  >
                    {(
                      Object.entries(DESIGNER_LEVEL_META) as [
                        DesignerLevel,
                        (typeof DESIGNER_LEVEL_META)[DesignerLevel],
                      ][]
                    ).map(([k, m]) => (
                      <option key={k} value={k}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>从业年限</Label>
                  <Input
                    value={`${designer.yearsOfExperience} 年`}
                    disabled
                    className="bg-ink-20/20"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>所在地</Label>
                  <Input
                    value={form.location ?? ""}
                    onChange={(e) => patch({ location: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>学历</Label>
                  <Input
                    value={form.education ?? ""}
                    onChange={(e) => patch({ education: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>头像地址</Label>
                  <div className="flex gap-3">
                    <div className="flex h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-ink-20 bg-ink-20/30">
                      {form.avatar ? (
                        <Image
                          src={form.avatar}
                          alt=""
                          width={56}
                          height={56}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-ink-40">
                          <ImagePlus className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <Input
                      className="flex-1"
                      value={form.avatar ?? ""}
                      onChange={(e) => patch({ avatar: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="specialty" className="mt-0 space-y-4">
              <div>
                <Label>主专业大类</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {SPECIALTIES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => patch({ specialty: s.value })}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm",
                        specialty === s.value
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>细分专业标签</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(SUB_SPECIALTIES[specialty] ?? []).map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => toggleSub(s.value)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs",
                          subs.includes(s.value)
                            ? "border-ink bg-ink text-white"
                            : "border-ink-20 text-ink-60",
                        )}
                      >
                        {s.label}
                      </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="profile" className="mt-0 space-y-4">
              <div className="space-y-1.5">
                <Label>一句话介绍</Label>
                <Input
                  value={form.tagline ?? ""}
                  onChange={(e) => patch({ tagline: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>个人简介</Label>
                <Textarea
                  rows={4}
                  value={form.bio ?? ""}
                  onChange={(e) => patch({ bio: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>擅长标签（逗号分隔）</Label>
                <Input
                  value={(form.expertiseTags ?? []).join("，")}
                  onChange={(e) =>
                    patch({
                      expertiseTags: e.target.value
                        .split(/[,，]/)
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="service" className="mt-0 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-ink-20 p-3">
                <Label>是否在职</Label>
                <Switch
                  checked={form.isInJob ?? true}
                  onCheckedChange={(v) => patch({ isInJob: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-ink-20 p-3">
                <Label>接受改图服务</Label>
                <Switch
                  checked={form.acceptRevisionService ?? false}
                  onCheckedChange={(v) => patch({ acceptRevisionService: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-ink-20 p-3">
                <Label>接受出差</Label>
                <Switch
                  checked={form.acceptTravel ?? false}
                  onCheckedChange={(v) => patch({ acceptTravel: v })}
                />
              </div>
              {form.acceptTravel ? (
                <select
                  className="h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
                  value={form.travelDuration ?? "short"}
                  onChange={(e) =>
                    patch({
                      travelDuration: e.target.value as DesignerProfileDraft["travelDuration"],
                    })
                  }
                >
                  {TRAVEL_DURATION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="space-y-1.5">
                <Label>线上会议时间</Label>
                <select
                  className="h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm"
                  value={form.onlineMeetingTime ?? "work_hours"}
                  onChange={(e) =>
                    patch({
                      onlineMeetingTime: e.target.value as DesignerProfileDraft["onlineMeetingTime"],
                    })
                  }
                >
                  {ONLINE_MEETING_TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-ink-20 p-3">
                <Label>境外项目经验</Label>
                <Switch
                  checked={form.hasOverseasExperience ?? false}
                  onCheckedChange={(v) => patch({ hasOverseasExperience: v })}
                />
              </div>
              {form.hasOverseasExperience ? (
                <div className="flex flex-wrap gap-2">
                  {OVERSEAS_COUNTRY_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        const cur = form.overseasCountries ?? [];
                        patch({
                          overseasCountries: cur.includes(c)
                            ? cur.filter((x) => x !== c)
                            : [...cur, c],
                        });
                      }}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs",
                        (form.overseasCountries ?? []).includes(c)
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="shrink-0 border-t border-ink-20 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="brand" disabled={submitting} onClick={handleSave}>
            {submitting ? "保存中..." : "保存修改"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
