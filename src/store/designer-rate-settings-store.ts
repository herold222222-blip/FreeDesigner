"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DesignerRatePercents } from "@/lib/designer-rate-settings";

interface DesignerRateSettingsState {
  /** designerId -> lineId -> percent */
  byDesigner: Record<string, DesignerRatePercents>;
  getPercents: (designerId: string) => DesignerRatePercents;
  savePercents: (designerId: string, percents: DesignerRatePercents) => void;
  resetPercents: (designerId: string) => void;
}

export const useDesignerRateSettingsStore = create<DesignerRateSettingsState>()(
  persist(
    (set, get) => ({
      byDesigner: {},
      getPercents: (designerId) => get().byDesigner[designerId] ?? {},
      savePercents: (designerId, percents) =>
        set((state) => ({
          byDesigner: { ...state.byDesigner, [designerId]: { ...percents } },
        })),
      resetPercents: (designerId) =>
        set((state) => {
          const next = { ...state.byDesigner };
          delete next[designerId];
          return { byDesigner: next };
        }),
    }),
    { name: "lezyou-designer-rate-settings" },
  ),
);
