"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EDUCATION_DEGREE_OPTIONS,
  emptyEducationExperience,
  emptyEmploymentExperience,
  HIGHEST_EDUCATION_OPTIONS,
} from "@/lib/designer-education";
import type {
  EducationDegree,
  EducationExperience,
  EmploymentExperience,
  HighestEducation,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export function HighestEducationSelect({
  value,
  onChange,
  required,
}: {
  value?: HighestEducation | "";
  onChange: (value: HighestEducation) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>最高学历{required ? " *" : ""}</Label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HIGHEST_EDUCATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-11 rounded-xl border text-sm font-medium transition-colors",
              value === opt.value
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

function useEnsureOneDefaultRow<T>(
  value: T[],
  createEmpty: () => T,
  onChange: (next: T[]) => void,
) {
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (value.length === 0) onChange([createEmpty()]);
    // 仅首次挂载时补默认一条
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function EducationExperienceEditor({
  value,
  onChange,
}: {
  value: EducationExperience[];
  onChange: (next: EducationExperience[]) => void;
}) {
  useEnsureOneDefaultRow(value, emptyEducationExperience, onChange);
  const rows = value.length > 0 ? value : [emptyEducationExperience()];

  const update = (id: string, patch: Partial<EducationExperience>) => {
    const base = value.length > 0 ? value : rows;
    onChange(base.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const remove = (id: string) => {
    const next = (value.length > 0 ? value : rows).filter((r) => r.id !== id);
    onChange(next.length > 0 ? next : [emptyEducationExperience()]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>毕业经历</Label>
          <p className="mt-0.5 text-xs text-ink-40">
            默认一条，可继续添加；学校选填
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...(value.length > 0 ? value : rows),
              emptyEducationExperience(),
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </Button>
      </div>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="space-y-3 rounded-xl border border-ink-20 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-40">
                经历 {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-ink-40 hover:text-rose-600"
                onClick={() => remove(row.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">毕业学校（选填）</Label>
                <Input
                  value={row.school ?? ""}
                  onChange={(e) => update(row.id, { school: e.target.value })}
                  placeholder="例如：同济大学"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">学历</Label>
                <select
                  className="flex h-10 w-full rounded-xl border border-ink-20 bg-white px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
                  value={row.degree ?? ""}
                  onChange={(e) =>
                    update(row.id, {
                      degree: (e.target.value || undefined) as
                        | EducationDegree
                        | undefined,
                    })
                  }
                >
                  <option value="">请选择</option>
                  {EDUCATION_DEGREE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">专业</Label>
                <Input
                  value={row.major ?? ""}
                  onChange={(e) => update(row.id, { major: e.target.value })}
                  placeholder="例如：风景园林"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">毕业时间</Label>
                <Input
                  type="month"
                  value={row.graduatedAt ?? ""}
                  onChange={(e) =>
                    update(row.id, { graduatedAt: e.target.value })
                  }
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmploymentExperienceEditor({
  value,
  onChange,
}: {
  value: EmploymentExperience[];
  onChange: (next: EmploymentExperience[]) => void;
}) {
  useEnsureOneDefaultRow(value, emptyEmploymentExperience, onChange);
  const rows = value.length > 0 ? value : [emptyEmploymentExperience()];

  const update = (id: string, patch: Partial<EmploymentExperience>) => {
    const base = value.length > 0 ? value : rows;
    onChange(base.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const remove = (id: string) => {
    const next = (value.length > 0 ? value : rows).filter((r) => r.id !== id);
    onChange(next.length > 0 ? next : [emptyEmploymentExperience()]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>曾任职公司</Label>
          <p className="mt-0.5 text-xs text-ink-40">
            默认一条，可继续添加；公司选填
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([
              ...(value.length > 0 ? value : rows),
              emptyEmploymentExperience(),
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </Button>
      </div>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="space-y-3 rounded-xl border border-ink-20 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-40">
                经历 {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-ink-40 hover:text-rose-600"
                onClick={() => remove(row.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                删除
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">公司（选填）</Label>
                <Input
                  value={row.company ?? ""}
                  onChange={(e) => update(row.id, { company: e.target.value })}
                  placeholder="例如：奥雅设计"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">职务</Label>
                <Input
                  value={row.title ?? ""}
                  onChange={(e) => update(row.id, { title: e.target.value })}
                  placeholder="例如：景观设计师"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">开始年月</Label>
                <Input
                  type="month"
                  value={row.startAt ?? ""}
                  onChange={(e) => update(row.id, { startAt: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">结束年月</Label>
                <Input
                  type="month"
                  value={row.endAt ?? ""}
                  onChange={(e) => update(row.id, { endAt: e.target.value })}
                  placeholder="至今可留空"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
