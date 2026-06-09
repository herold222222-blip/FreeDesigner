"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Language = "zh" | "en" | "ar";

interface LanguageState {
  language: Language;
  setLanguage: (l: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "zh",
      setLanguage: (language) => set({ language }),
    }),
    { name: "lezyou-language" },
  ),
);
