"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DesignerProfileDraft } from "@/lib/designer-profile-draft";

interface DesignerProfileState {
  drafts: Record<string, DesignerProfileDraft>;
  setDraft: (designerId: string, draft: DesignerProfileDraft) => void;
  clearDraft: (designerId: string) => void;
  getDraft: (designerId: string) => DesignerProfileDraft | undefined;
}

export const useDesignerProfileStore = create<DesignerProfileState>()(
  persist(
    (set, get) => ({
      drafts: {},
      setDraft: (designerId, draft) =>
        set({ drafts: { ...get().drafts, [designerId]: draft } }),
      clearDraft: (designerId) => {
        const next = { ...get().drafts };
        delete next[designerId];
        set({ drafts: next });
      },
      getDraft: (designerId) => get().drafts[designerId],
    }),
    { name: "lezyou-designer-profile" },
  ),
);
