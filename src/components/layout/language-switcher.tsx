"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LANGUAGES } from "@/lib/constants";
import { useLanguageStore, type Language } from "@/store/language-store";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const current = SUPPORTED_LANGUAGES.find((l) => l.value === (hydrated ? language : "zh"))!;

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen((o) => !o)}
      >
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">{current.flag}</span>
      </Button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-ink-20 bg-white p-1.5 shadow-xl">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.value}
              onClick={() => {
                setLanguage(l.value as Language);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-ink-20/40",
                hydrated && language === l.value && "bg-ink-20/40 font-semibold",
              )}
            >
              <span className="text-base">{l.flag}</span>
              <span className="text-ink">{l.label}</span>
            </button>
          ))}
          <div className="mt-1 border-t border-ink-20 px-3 py-2 text-[11px] text-ink-40">
            v1.1 多语言切换 · UI 演示
          </div>
        </div>
      ) : null}
    </div>
  );
}
