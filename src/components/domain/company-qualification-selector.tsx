"use client";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  COMPANY_QUALIFICATION_FIELDS,
  companyQualificationKey,
} from "@/lib/company-qualifications";

type Props = {
  selectedKeys: string[];
  noQualification: boolean;
  onSelectedKeysChange: (keys: string[]) => void;
  onNoQualificationChange: (value: boolean) => void;
};

export function CompanyQualificationSelector({
  selectedKeys,
  noQualification,
  onSelectedKeysChange,
  onNoQualificationChange,
}: Props) {
  const toggleLevel = (fieldId: string, categoryId: string, levelId: string) => {
    const key = companyQualificationKey(fieldId, categoryId, levelId);
    onNoQualificationChange(false);
    onSelectedKeysChange(
      selectedKeys.includes(key)
        ? selectedKeys.filter((k) => k !== key)
        : [...selectedKeys, key],
    );
  };

  const toggleNoQualification = () => {
    if (noQualification) {
      onNoQualificationChange(false);
      return;
    }
    onSelectedKeysChange([]);
    onNoQualificationChange(true);
  };

  return (
    <div className="space-y-4 border-t border-ink-20 pt-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Label>公司资质 *</Label>
          {noQualification ? (
            <Badge variant="muted" className="text-[10px]">
              无资质
            </Badge>
          ) : selectedKeys.length > 0 ? (
            <Badge variant="muted" className="text-[10px]">
              已选 {selectedKeys.length} 项
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-ink-40">
          须选择「无资质」或至少一项设计资质；可按设计领域多选对应级别。
        </p>
      </div>

      <button
        type="button"
        onClick={toggleNoQualification}
        className={cn(
          "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
          noQualification
            ? "border-ink bg-ink text-white"
            : "border-ink-20 text-ink-60 hover:border-ink/40",
        )}
      >
        无资质
      </button>

      <div
        className={cn(
          "space-y-3",
          noQualification && "pointer-events-none opacity-40",
        )}
      >
        {COMPANY_QUALIFICATION_FIELDS.map((field) => (
          <div
            key={field.id}
            className="rounded-xl border border-ink-20 bg-ink-20/15 p-4"
          >
            <div className="mb-3 text-xs font-semibold text-ink">
              {field.label}
            </div>
            <div className="space-y-3">
              {field.categories.map((category) => (
                <div key={category.id}>
                  <div className="mb-2 text-[11px] font-medium text-ink-60">
                    {category.label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {category.levels.map((level) => {
                      const key = companyQualificationKey(
                        field.id,
                        category.id,
                        level.id,
                      );
                      const selected = selectedKeys.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            toggleLevel(field.id, category.id, level.id)
                          }
                          className={cn(
                            "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-ink bg-ink text-white"
                              : "border-ink-20 text-ink-60 hover:border-ink/40",
                          )}
                        >
                          {level.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
