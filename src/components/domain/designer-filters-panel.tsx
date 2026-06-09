"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  SPECIALTIES,
  DESIGNER_LEVEL_META,
  SUBJECT_TYPE_OPTIONS,
  LANDSCAPE_PROJECT_TYPES,
  getProjectTypes,
} from "@/lib/constants";
import { getL2Options, getL3Options } from "@/lib/bounty-filters";
import {
  ONLINE_MEETING_TIME_OPTIONS,
  TRAVEL_DURATION_OPTIONS,
  OVERSEAS_COUNTRY_OPTIONS,
  TEAM_SIZE_OPTIONS,
  BACK_TO_BACK_CONTRACT_NOTE,
} from "@/lib/designer-service-settings";
import { AREA_ROOTS } from "@/lib/administrative-area";
import type {
  DesignerLevel,
  OnlineMeetingTimeOption,
  Specialty,
  SubjectType,
  TeamSizeOption,
  TravelDurationOption,
  WorkloadStatus,
} from "@/lib/types";
import type {
  DesignerFiltersState,
  ServiceModeFilter,
  TriState,
} from "@/lib/designer-filters";
import { cn } from "@/lib/utils";

const TRI_OPTIONS: { value: TriState; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "yes", label: "是" },
  { value: "no", label: "否" },
];

const SERVICE_MODE_OPTIONS: { value: ServiceModeFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "online_only", label: "纯线上接单" },
  { value: "online_onsite", label: "线上 + 线下" },
];

const selectClass =
  "h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm";

const selectClassCompact =
  "h-9 w-full min-w-0 rounded-lg border border-ink-20 bg-white px-2 text-xs";

function chipClass(active: boolean) {
  return cn(
    "rounded-full border px-3 py-1 text-xs transition-colors",
    active
      ? "border-ink bg-ink text-white"
      : "border-ink-20 text-ink-60 hover:border-ink/40",
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={chipClass(value === o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-ink-40">{hint}</p> : null}
    </div>
  );
}

function ToolbarField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-medium text-ink-60">{label}</div>
      {children}
    </div>
  );
}

function ToolbarChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="shrink-0 text-[11px] font-medium text-ink-60">{label}</span>
      {children}
    </div>
  );
}

export function DesignerFiltersPanel({
  filters,
  onPatch,
  onReset,
  resultCount,
  className,
  sticky = true,
  layout = "sidebar",
}: {
  filters: DesignerFiltersState;
  onPatch: (partial: Partial<DesignerFiltersState>) => void;
  onReset: () => void;
  resultCount?: number;
  className?: string;
  sticky?: boolean;
  /** sidebar：左侧竖栏；toolbar：顶部横向紧凑筛选 */
  layout?: "sidebar" | "toolbar";
}) {
  const [showMore, setShowMore] = useState(false);
  const {
    keyword,
    specialty,
    subjectType,
    level,
    onlineOnly,
    workload,
    province,
    city,
    trackL2,
    trackL3,
    teamSize,
    projectType,
    inJob,
    handDrawing,
    travel,
    travelDuration,
    backToBack,
    overseas,
    overseasCountry,
    timeBilling,
    onsiteExp,
    meetingTime,
    serviceMode,
  } = filters;

  const showInJob = subjectType === "all" || subjectType === "individual";
  const showTeamSize = subjectType === "team" || subjectType === "company";
  const teamSizeLabel = subjectType === "company" ? "公司人数" : "团队人数";

  const projectTypeOptions = useMemo(
    () =>
      specialty === "all" ? LANDSCAPE_PROJECT_TYPES : getProjectTypes(specialty),
    [specialty],
  );

  const l2Options = useMemo(() => getL2Options(specialty), [specialty]);
  const l3Options = useMemo(
    () => getL3Options(specialty, trackL2),
    [specialty, trackL2],
  );

  const provinceCities = useMemo(() => {
    if (province === "all") return [];
    const node = AREA_ROOTS.find((p) => p.text === province);
    return node?.children ?? [];
  }, [province]);

  if (layout === "toolbar") {
    return (
      <Card
        className={cn(
          "sticky top-4 z-10 space-y-3 p-4",
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-20 pb-3">
          <div className="relative min-w-[min(100%,240px)] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
            <Input
              placeholder="姓名 / 编号 / 标签 / 项目案例 / 项目类型"
              className="h-9 pl-9 text-sm"
              value={keyword}
              onChange={(e) => onPatch({ keyword: e.target.value })}
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {resultCount != null ? (
              <span className="text-xs text-ink-60">
                共 <strong className="text-ink">{resultCount}</strong> 位
              </span>
            ) : null}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-ink-60">仅在线</Label>
              <Switch
                checked={onlineOnly}
                onCheckedChange={(v) => onPatch({ onlineOnly: v })}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={onReset}>
              重置
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <ToolbarField label="一级专业">
            <select
              className={selectClassCompact}
              value={specialty}
              onChange={(e) => {
                const v = e.target.value as Specialty | "all";
                onPatch({
                  specialty: v,
                  trackL2: "all",
                  trackL3: "all",
                  projectType: "all",
                });
              }}
            >
              <option value="all">全部一级专业</option>
              {SPECIALTIES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </ToolbarField>
          <ToolbarField label="二级专业">
            <select
              className={selectClassCompact}
              value={trackL2}
              disabled={specialty === "all"}
              onChange={(e) =>
                onPatch({ trackL2: e.target.value, trackL3: "all" })
              }
            >
              <option value="all">
                {specialty === "all" ? "请先选一级" : "全部二级专业"}
              </option>
              {l2Options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </ToolbarField>
          <ToolbarField label="三级专业">
            <select
              className={selectClassCompact}
              value={trackL3}
              disabled={specialty === "all" || trackL2 === "all"}
              onChange={(e) => onPatch({ trackL3: e.target.value })}
            >
              <option value="all">
                {trackL2 === "all" ? "请先选二级" : "全部三级专业"}
              </option>
              {l3Options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </ToolbarField>
          <ToolbarField label="所在省 / 直辖市">
            <select
              className={selectClassCompact}
              value={province}
              onChange={(e) => onPatch({ province: e.target.value, city: "all" })}
            >
              <option value="all">全部省 / 直辖市</option>
              {AREA_ROOTS.map((p) => (
                <option key={p.value} value={p.text}>
                  {p.text}
                </option>
              ))}
            </select>
          </ToolbarField>
          <ToolbarField label="城市">
            <select
              className={selectClassCompact}
              value={city}
              disabled={province === "all"}
              onChange={(e) => onPatch({ city: e.target.value })}
            >
              <option value="all">
                {province === "all" ? "请先选省份" : "全部城市"}
              </option>
              {provinceCities.map((c) => (
                <option key={c.value} value={c.text}>
                  {c.text}
                </option>
              ))}
            </select>
          </ToolbarField>
          <ToolbarField label="擅长项目类型">
            <select
              className={selectClassCompact}
              value={projectType}
              onChange={(e) => onPatch({ projectType: e.target.value })}
            >
              <option value="all">全部项目类型</option>
              {projectTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </ToolbarField>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <ToolbarChipRow label="团队规模">
            <ChipGroup
              options={[{ value: "all", label: "全部" }, ...SUBJECT_TYPE_OPTIONS]}
              value={subjectType}
              onChange={(v) =>
                onPatch({
                  subjectType: v as SubjectType | "all",
                  teamSize: "all",
                  inJob: "all",
                })
              }
            />
          </ToolbarChipRow>
          {showTeamSize ? (
            <ToolbarChipRow label={teamSizeLabel}>
              <ChipGroup
                options={[{ value: "all", label: "全部" }, ...TEAM_SIZE_OPTIONS]}
                value={teamSize}
                onChange={(v) =>
                  onPatch({ teamSize: v as TeamSizeOption | "all" })
                }
              />
            </ToolbarChipRow>
          ) : null}
          {showInJob ? (
            <ToolbarChipRow label="是否在职">
              <ChipGroup
                options={TRI_OPTIONS}
                value={inJob}
                onChange={(v) => onPatch({ inJob: v })}
              />
            </ToolbarChipRow>
          ) : null}
          <ToolbarChipRow label="设计师等级">
            <ChipGroup
              options={[
                { value: "all", label: "全部" },
                ...(
                  Object.entries(DESIGNER_LEVEL_META) as [
                    DesignerLevel,
                    (typeof DESIGNER_LEVEL_META)[DesignerLevel],
                  ][]
                ).map(([k, m]) => ({ value: k, label: m.label })),
              ]}
              value={level}
              onChange={(v) => onPatch({ level: v as DesignerLevel | "all" })}
            />
          </ToolbarChipRow>
          <ToolbarChipRow label="负荷状态">
            <ChipGroup
              options={[
                { value: "all", label: "全部" },
                { value: "free", label: "空闲" },
                { value: "normal", label: "正常" },
                { value: "busy", label: "饱满" },
              ]}
              value={workload}
              onChange={(v) => onPatch({ workload: v as WorkloadStatus | "all" })}
            />
          </ToolbarChipRow>
          <ToolbarChipRow label="服务模式">
            <ChipGroup
              options={SERVICE_MODE_OPTIONS}
              value={serviceMode}
              onChange={(v) => onPatch({ serviceMode: v })}
            />
          </ToolbarChipRow>
        </div>

        {showMore ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink-20 pt-3">
            <ToolbarChipRow label="改图服务">
              <ChipGroup
                options={TRI_OPTIONS}
                value={handDrawing}
                onChange={(v) => onPatch({ handDrawing: v })}
              />
            </ToolbarChipRow>
            <ToolbarChipRow label="接受出差">
              <ChipGroup
                options={TRI_OPTIONS}
                value={travel}
                onChange={(v) =>
                  onPatch({
                    travel: v,
                    travelDuration: v !== "yes" ? "all" : travelDuration,
                  })
                }
              />
              {travel === "yes" ? (
                <ChipGroup
                  options={[
                    { value: "all", label: "不限时长" },
                    ...TRAVEL_DURATION_OPTIONS,
                  ]}
                  value={travelDuration}
                  onChange={(v) =>
                    onPatch({ travelDuration: v as TravelDurationOption | "all" })
                  }
                />
              ) : null}
            </ToolbarChipRow>
            <ToolbarChipRow label="背靠背合同">
              <ChipGroup
                options={TRI_OPTIONS}
                value={backToBack}
                onChange={(v) => onPatch({ backToBack: v })}
              />
            </ToolbarChipRow>
            <ToolbarChipRow label="境外项目">
              <ChipGroup
                options={TRI_OPTIONS}
                value={overseas}
                onChange={(v) =>
                  onPatch({
                    overseas: v,
                    overseasCountry: v !== "yes" ? "all" : overseasCountry,
                  })
                }
              />
              {overseas === "yes" ? (
                <select
                  className={cn(selectClassCompact, "w-auto min-w-[120px]")}
                  value={overseasCountry}
                  onChange={(e) => onPatch({ overseasCountry: e.target.value })}
                >
                  <option value="all">全部国家 / 地区</option>
                  {OVERSEAS_COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : null}
            </ToolbarChipRow>
            <ToolbarChipRow label="按时间计费">
              <ChipGroup
                options={TRI_OPTIONS}
                value={timeBilling}
                onChange={(v) => onPatch({ timeBilling: v })}
              />
            </ToolbarChipRow>
            <ToolbarChipRow label="现场服务">
              <ChipGroup
                options={TRI_OPTIONS}
                value={onsiteExp}
                onChange={(v) => onPatch({ onsiteExp: v })}
              />
            </ToolbarChipRow>
            <ToolbarChipRow label="会议时间">
              <ChipGroup
                options={[
                  { value: "all", label: "全部" },
                  ...ONLINE_MEETING_TIME_OPTIONS,
                ]}
                value={meetingTime}
                onChange={(v) =>
                  onPatch({ meetingTime: v as OnlineMeetingTimeOption | "all" })
                }
              />
            </ToolbarChipRow>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center gap-1 text-xs text-ink-60 hover:text-ink"
        >
          {showMore ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              收起更多筛选
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              展开更多筛选
            </>
          )}
        </button>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "h-fit p-5",
        sticky &&
          "lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SlidersHorizontal className="h-4 w-4" /> 筛选条件
        </div>
        <div className="flex items-center gap-2">
          {resultCount != null ? (
            <span className="text-xs text-ink-60">
              共 <strong className="text-ink">{resultCount}</strong> 位
            </span>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onReset}>
            重置
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        <Section label="关键词">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-40" />
            <Input
              placeholder="姓名 / 编号 / 标签 / 项目案例 / 项目类型"
              className="pl-9"
              value={keyword}
              onChange={(e) => onPatch({ keyword: e.target.value })}
            />
          </div>
        </Section>

        <Section label="一级专业">
          <select
            className={selectClass}
            value={specialty}
            onChange={(e) => {
              const v = e.target.value as Specialty | "all";
              onPatch({
                specialty: v,
                trackL2: "all",
                trackL3: "all",
                projectType: "all",
              });
            }}
          >
            <option value="all">全部一级专业</option>
            {SPECIALTIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Section>

        <Section label="二级专业">
          <select
            className={selectClass}
            value={trackL2}
            disabled={specialty === "all"}
            onChange={(e) =>
              onPatch({ trackL2: e.target.value, trackL3: "all" })
            }
          >
            <option value="all">
              {specialty === "all" ? "请先选择一级专业" : "全部二级专业"}
            </option>
            {l2Options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Section>

        <Section label="三级专业">
          <select
            className={selectClass}
            value={trackL3}
            disabled={specialty === "all" || trackL2 === "all"}
            onChange={(e) => onPatch({ trackL3: e.target.value })}
          >
            <option value="all">
              {trackL2 === "all" ? "请先选择二级专业" : "全部三级专业"}
            </option>
            {l3Options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Section>

        <Section label="团队规模">
          <ChipGroup
            options={[{ value: "all", label: "全部" }, ...SUBJECT_TYPE_OPTIONS]}
            value={subjectType}
            onChange={(v) =>
              onPatch({
                subjectType: v as SubjectType | "all",
                teamSize: "all",
                inJob: "all",
              })
            }
          />
        </Section>

        {showTeamSize ? (
          <Section label={teamSizeLabel}>
            <ChipGroup
              options={[{ value: "all", label: "全部" }, ...TEAM_SIZE_OPTIONS]}
              value={teamSize}
              onChange={(v) => onPatch({ teamSize: v as TeamSizeOption | "all" })}
            />
          </Section>
        ) : null}

        {showInJob ? (
          <Section label="是否在职">
            <ChipGroup
              options={TRI_OPTIONS}
              value={inJob}
              onChange={(v) => onPatch({ inJob: v })}
            />
          </Section>
        ) : null}

        <Section
          label="擅长项目类型"
          hint={
            specialty === "all"
              ? "默认展示景观专业项目类型，可先选择专业切换"
              : undefined
          }
        >
          <select
            className={selectClass}
            value={projectType}
            onChange={(e) => onPatch({ projectType: e.target.value })}
          >
            <option value="all">全部项目类型</option>
            {projectTypeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Section>

        <Section label="是否接受改图服务">
          <ChipGroup
            options={TRI_OPTIONS}
            value={handDrawing}
            onChange={(v) => onPatch({ handDrawing: v })}
          />
        </Section>

        <Section label="是否接受出差">
          <ChipGroup
            options={TRI_OPTIONS}
            value={travel}
            onChange={(v) =>
              onPatch({
                travel: v,
                travelDuration: v !== "yes" ? "all" : travelDuration,
              })
            }
          />
          {travel === "yes" ? (
            <ChipGroup
              options={[
                { value: "all", label: "不限时长" },
                ...TRAVEL_DURATION_OPTIONS,
              ]}
              value={travelDuration}
              onChange={(v) =>
                onPatch({ travelDuration: v as TravelDurationOption | "all" })
              }
            />
          ) : null}
        </Section>

        <Section label="是否接受背靠背合同" hint={BACK_TO_BACK_CONTRACT_NOTE}>
          <ChipGroup
            options={TRI_OPTIONS}
            value={backToBack}
            onChange={(v) => onPatch({ backToBack: v })}
          />
        </Section>

        <Section label="是否做过境外项目">
          <ChipGroup
            options={TRI_OPTIONS}
            value={overseas}
            onChange={(v) =>
              onPatch({
                overseas: v,
                overseasCountry: v !== "yes" ? "all" : overseasCountry,
              })
            }
          />
          {overseas === "yes" ? (
            <select
              className={selectClass}
              value={overseasCountry}
              onChange={(e) => onPatch({ overseasCountry: e.target.value })}
            >
              <option value="all">全部国家 / 地区</option>
              {OVERSEAS_COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : null}
        </Section>

        <Section label="是否接受按时间计费">
          <ChipGroup
            options={TRI_OPTIONS}
            value={timeBilling}
            onChange={(v) => onPatch({ timeBilling: v })}
          />
        </Section>

        <Section label="是否有现场服务经验">
          <ChipGroup
            options={TRI_OPTIONS}
            value={onsiteExp}
            onChange={(v) => onPatch({ onsiteExp: v })}
          />
        </Section>

        <Section label="线上会议时间">
          <ChipGroup
            options={[
              { value: "all", label: "全部" },
              ...ONLINE_MEETING_TIME_OPTIONS,
            ]}
            value={meetingTime}
            onChange={(v) =>
              onPatch({ meetingTime: v as OnlineMeetingTimeOption | "all" })
            }
          />
        </Section>

        <Section label="服务模式">
          <ChipGroup
            options={SERVICE_MODE_OPTIONS}
            value={serviceMode}
            onChange={(v) => onPatch({ serviceMode: v })}
          />
        </Section>

        <Section label="设计师等级">
          <ChipGroup
            options={[
              { value: "all", label: "全部" },
              ...(
                Object.entries(DESIGNER_LEVEL_META) as [
                  DesignerLevel,
                  (typeof DESIGNER_LEVEL_META)[DesignerLevel],
                ][]
              ).map(([k, m]) => ({ value: k, label: m.label })),
            ]}
            value={level}
            onChange={(v) => onPatch({ level: v as DesignerLevel | "all" })}
          />
        </Section>

        <Section label="负荷状态">
          <ChipGroup
            options={[
              { value: "all", label: "全部" },
              { value: "free", label: "空闲" },
              { value: "normal", label: "正常" },
              { value: "busy", label: "饱满" },
            ]}
            value={workload}
            onChange={(v) => onPatch({ workload: v as WorkloadStatus | "all" })}
          />
        </Section>

        <Section label="所在地区">
          <select
            className={selectClass}
            value={province}
            onChange={(e) => onPatch({ province: e.target.value, city: "all" })}
          >
            <option value="all">全部省 / 直辖市</option>
            {AREA_ROOTS.map((p) => (
              <option key={p.value} value={p.text}>
                {p.text}
              </option>
            ))}
          </select>
          {province !== "all" ? (
            <select
              className={selectClass}
              value={city}
              onChange={(e) => onPatch({ city: e.target.value })}
            >
              <option value="all">该省 / 直辖市全部城市</option>
              {provinceCities.map((c) => (
                <option key={c.value} value={c.text}>
                  {c.text}
                </option>
              ))}
            </select>
          ) : null}
        </Section>

        <div className="flex items-center justify-between pt-1">
          <div>
            <Label>仅显示在线</Label>
            <p className="mt-1 text-[11px] text-ink-40">右上角带绿点的设计师</p>
          </div>
          <Switch
            checked={onlineOnly}
            onCheckedChange={(v) => onPatch({ onlineOnly: v })}
          />
        </div>
      </div>
    </Card>
  );
}
