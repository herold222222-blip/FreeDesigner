"use client";

import { cn } from "@/lib/utils";

export function BountyTrackMultiSelect({
  options,
  value,
  onChange,
  showGroup,
}: {
  options: { value: string; label: string; group?: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  showGroup?: boolean;
}) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  if (!options.length) {
    return <p className="text-xs text-ink-40">请先选择二级专业</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-ink bg-ink text-white"
                : "border-ink-20 text-ink-60 hover:border-ink/40",
            )}
          >
            {showGroup && o.group ? (
              <span>
                <span className="text-[10px] opacity-70">{o.group} · </span>
                {o.label}
              </span>
            ) : (
              o.label
            )}
          </button>
        );
      })}
    </div>
  );
}
