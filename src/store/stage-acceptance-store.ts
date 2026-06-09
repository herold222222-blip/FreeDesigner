"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StageAcceptanceState {
  /** key: orderId:stageId → 已验收的分组 id 列表 */
  acceptedByStage: Record<string, string[]>;
  acceptTracks: (key: string, groupIds: string[]) => void;
  isTrackAccepted: (key: string, groupId: string) => boolean;
  getAccepted: (key: string) => string[];
}

export const useStageAcceptanceStore = create<StageAcceptanceState>()(
  persist(
    (set, get) => ({
      acceptedByStage: {},
      acceptTracks: (key, groupIds) => {
        const prev = get().acceptedByStage[key] ?? [];
        const merged = [...new Set([...prev, ...groupIds])];
        set({
          acceptedByStage: { ...get().acceptedByStage, [key]: merged },
        });
      },
      isTrackAccepted: (key, groupId) =>
        (get().acceptedByStage[key] ?? []).includes(groupId),
      getAccepted: (key) => get().acceptedByStage[key] ?? [],
    }),
    { name: "lezyou-stage-acceptance" },
  ),
);
