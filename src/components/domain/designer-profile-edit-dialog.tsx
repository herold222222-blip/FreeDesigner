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
import { Badge } from "@/components/ui/badge";
import { SPECIALTIES, SUB_SPECIALTIES } from "@/lib/constants";
import { updateDesignerProfileRequest } from "@/lib/api-client";
import {
  BACK_TO_BACK_CONTRACT_NOTE,
  ONLINE_MEETING_TIME_OPTIONS,
  OVERSEAS_COUNTRY_OPTIONS,
  PORTFOLIO_PROJECT_TYPE_NOTE,
  TRAVEL_DURATION_OPTIONS,
} from "@/lib/designer-service-settings";
import {
  DESIGNER_ID_CARD_AGE,
  deriveProjectTypeTagsFromPortfolio,
  designerDraftFromDesigner,
  type DesignerProfileDraft,
} from "@/lib/designer-profile-draft";
import type { Designer, Specialty, SubSpecialty } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDesignerProfileStore } from "@/store/designer-profile-store";
import { useSessionStore } from "@/store/session-store";
import { ImagePlus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designer: Designer;
  onSaved?: () => void;
}

export function DesignerProfileEditDialog({
  open,
  onOpenChange,
  designer,
  onSaved,
}: Props) {
  const push = useSessionStore((s) => s.pushNotification);
  const savedDraft = useDesignerProfileStore((s) => s.drafts[designer.id]);
  const clearDraft = useDesignerProfileStore((s) => s.clearDraft);

  const [saving, setSaving] = useState(false);
  const baseDesigner = designer;
  const portfolioProjectTypes = useMemo(
    () => deriveProjectTypeTagsFromPortfolio(baseDesigner),
    [baseDesigner],
  );

  const initial = useMemo(
    () => ({ ...designerDraftFromDesigner(baseDesigner), ...savedDraft }),
    [baseDesigner, savedDraft],
  );

  const [form, setForm] = useState<DesignerProfileDraft>(initial);

  useEffect(() => {
    if (open) {
      setForm({ ...designerDraftFromDesigner(baseDesigner), ...savedDraft });
    }
  }, [open, baseDesigner, savedDraft]);

  const patch = (next: Partial<DesignerProfileDraft>) =>
    setForm((prev) => ({ ...prev, ...next }));

  const specialty = form.specialty ?? designer.specialty;
  const subs = form.subSpecialties ?? [];

  const toggleSub = (s: SubSpecialty) => {
    patch({
      subSpecialties: subs.includes(s) ? subs.filter((x) => x !== s) : [...subs, s],
    });
  };

  const toggleOverseasCountry = (country: string) => {
    const current = form.overseasCountries ?? [];
    patch({
      overseasCountries: current.includes(country)
        ? current.filter((x) => x !== country)
        : [...current, country],
    });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateDesignerProfileRequest(designer.id, { profile: form });
      clearDraft(designer.id);
      push({
        title: "主页信息已更新",
        description: "对外展示内容已保存至服务器。",
        variant: "success",
      });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      push({
        title: "保存失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const idAge = DESIGNER_ID_CARD_AGE[designer.id];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-ink-20 px-6 py-4">
          <DialogTitle>编辑个人主页信息</DialogTitle>
          <p className="text-sm text-ink-60">
            可修改入驻时填写的内容；姓名与年龄为身份证实名信息，不可更改。
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-5 grid gap-4 rounded-xl border border-ink-20 bg-ink-20/20 p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-ink-40">姓名（身份证固定）</Label>
              <Input value={designer.name} disabled className="bg-white/80" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-ink-40">年龄（身份证固定）</Label>
              <Input value={idAge ? `${idAge} 岁` : "—"} disabled className="bg-white/80" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-ink-40">从业年限（身份证固定）</Label>
              <Input
                value={`${designer.yearsOfExperience} 年`}
                disabled
                className="bg-white/80"
              />
            </div>
          </div>

          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-ink-20 bg-ink-20/20 p-1">
              {[
                { value: "basic", label: "基础信息" },
                { value: "specialty", label: "专业方向" },
                { value: "profile", label: "主页文案" },
                { value: "service", label: "服务设置" },
                { value: "calendar", label: "档期偏好" },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-white data-[state=active]:text-ink sm:text-sm"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="basic" className="mt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>手机号</Label>
                  <Input
                    value={form.phone ?? ""}
                    onChange={(e) => patch({ phone: e.target.value })}
                    placeholder="11 位手机号"
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
                    placeholder="例如：同济大学 · 风景园林 · 硕士"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>曾任职公司</Label>
                  <Input
                    value={(form.formerEmployers ?? []).join("，")}
                    onChange={(e) =>
                      patch({
                        formerEmployers: e.target.value
                          .split(/[,，]/)
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="多家请用逗号分隔"
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
                      placeholder="头像图片 URL"
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
                      onClick={() =>
                        patch({
                          specialty: s.value,
                          subSpecialties: [],
                        })
                      }
                      className={cn(
                        "rounded-xl border p-3 text-left text-sm transition-colors",
                        specialty === s.value
                          ? "border-ink bg-ink-20/30"
                          : "border-ink-20 hover:border-ink/40",
                      )}
                    >
                      <div className="font-semibold text-ink">{s.label}</div>
                      <div className="mt-0.5 text-xs text-ink-60">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>子专业（可多选）</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUB_SPECIALTIES[specialty].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleSub(s.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        subs.includes(s.value)
                          ? "border-ink bg-ink text-white"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
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
                <Label>一句话简介</Label>
                <Textarea
                  className="min-h-[72px]"
                  value={form.tagline ?? ""}
                  onChange={(e) => patch({ tagline: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>个人介绍</Label>
                <Textarea
                  className="min-h-[120px]"
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
                  placeholder="园建施工图，绿化施工图"
                />
              </div>
            </TabsContent>

            <TabsContent value="service" className="mt-0 space-y-5">
              <div className="rounded-xl border border-ink-20 bg-ink-20/20 p-4">
                <Label>擅长项目类型（根据案例自动生成）</Label>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-60">
                  {PORTFOLIO_PROJECT_TYPE_NOTE}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {portfolioProjectTypes.map((t) => (
                    <Badge key={t} variant="outline">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              <YesNoField
                label="是否在职"
                value={form.isInJob ?? true}
                onChange={(v) => patch({ isInJob: v })}
              />

              <YesNoField
                label="是否接受改图服务"
                value={form.acceptRevisionService ?? false}
                onChange={(v) => patch({ acceptRevisionService: v })}
              />

              <div className="space-y-3">
                <YesNoField
                  label="是否接受出差"
                  value={form.acceptTravel ?? false}
                  onChange={(v) =>
                    patch({
                      acceptTravel: v,
                      travelDuration: v ? form.travelDuration ?? "short" : null,
                    })
                  }
                />
                {form.acceptTravel ? (
                  <div className="ml-1 space-y-2 border-l-2 border-ink-20 pl-4">
                    <Label className="text-xs text-ink-60">出差时长</Label>
                    <div className="flex flex-wrap gap-2">
                      {TRAVEL_DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => patch({ travelDuration: opt.value })}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs",
                            form.travelDuration === opt.value
                              ? "border-ink bg-ink text-white"
                              : "border-ink-20 text-ink-60",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <YesNoField
                  label="是否接受背靠背合同"
                  value={form.acceptBackToBackContract ?? false}
                  onChange={(v) => patch({ acceptBackToBackContract: v })}
                />
                <p className="text-[11px] leading-relaxed text-ink-60">
                  {BACK_TO_BACK_CONTRACT_NOTE}
                </p>
              </div>

              <div className="space-y-3">
                <YesNoField
                  label="是否做过境外项目"
                  value={form.hasOverseasExperience ?? false}
                  onChange={(v) =>
                    patch({
                      hasOverseasExperience: v,
                      overseasCountries: v ? form.overseasCountries ?? [] : [],
                    })
                  }
                />
                {form.hasOverseasExperience ? (
                  <div className="ml-1 space-y-2 border-l-2 border-ink-20 pl-4">
                    <Label className="text-xs text-ink-60">国家 / 地区（可多选）</Label>
                    <div className="flex flex-wrap gap-2">
                      {OVERSEAS_COUNTRY_OPTIONS.map((country) => (
                        <button
                          key={country}
                          type="button"
                          onClick={() => toggleOverseasCountry(country)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs",
                            (form.overseasCountries ?? []).includes(country)
                              ? "border-ink bg-ink text-white"
                              : "border-ink-20 text-ink-60",
                          )}
                        >
                          {country}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <YesNoField
                label="是否接受按时间计费"
                value={form.acceptTimeBilling ?? true}
                onChange={(v) => patch({ acceptTimeBilling: v })}
              />

              <YesNoField
                label="是否有现场服务经验"
                value={form.hasOnsiteExperience ?? false}
                onChange={(v) => patch({ hasOnsiteExperience: v })}
              />

              <div className="space-y-2">
                <Label>线上会议时间</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ONLINE_MEETING_TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch({ onlineMeetingTime: opt.value })}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                        form.onlineMeetingTime === opt.value
                          ? "border-ink bg-ink-20/30 font-medium text-ink"
                          : "border-ink-20 text-ink-60 hover:border-ink/40",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.acceptTimeBilling ? (
                <div className="grid gap-4 border-t border-ink-20 pt-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>按天单价（¥/天）</Label>
                    <Input
                      type="number"
                      value={form.dailyRate ?? 0}
                      onChange={(e) => patch({ dailyRate: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>按月单价（¥/月）</Label>
                    <Input
                      type="number"
                      value={form.monthlyRate ?? 0}
                      onChange={(e) => patch({ monthlyRate: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="calendar" className="mt-0 space-y-3">
              <ToggleRow
                label="关闭周末档期"
                checked={form.closeWeekend ?? true}
                disabled={form.allYearOpen ?? false}
                onChange={(v) =>
                  patch(v ? { closeWeekend: true, allYearOpen: false } : { closeWeekend: false })
                }
              />
              <ToggleRow
                label="关闭法定节假日档期"
                checked={form.closeHoliday ?? true}
                disabled={form.allYearOpen ?? false}
                onChange={(v) =>
                  patch(v ? { closeHoliday: true, allYearOpen: false } : { closeHoliday: false })
                }
              />
              <ToggleRow
                label="全年全时段开放接单"
                checked={form.allYearOpen ?? false}
                onChange={(v) =>
                  patch(
                    v
                      ? { allYearOpen: true, closeWeekend: false, closeHoliday: false }
                      : { allYearOpen: false },
                  )
                }
              />
              {form.allYearOpen ? (
                <p className="text-[11px] text-ink-40">
                  已开启全年全时段接单，周末与法定节假日档期将自动开放（不可同时关闭）。
                </p>
              ) : (
                <p className="text-[11px] text-ink-40">
                  详细档期请在「接单档期」菜单中按日历调整；此处为入驻时的默认偏好。
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="shrink-0 border-t border-ink-20 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="brand" onClick={save}>
            保存并更新预览
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function YesNoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {[
          { v: true, label: "是" },
          { v: false, label: "否" },
        ].map((opt) => (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => onChange(opt.v)}
            className={cn(
              "min-w-[72px] rounded-full border px-4 py-1.5 text-sm transition-colors",
              value === opt.v
                ? "border-ink bg-ink text-white"
                : "border-ink-20 text-ink-60 hover:border-ink/40",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border border-ink-20 px-4 py-3",
        disabled && "opacity-50",
      )}
    >
      <span className="text-sm text-ink">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
