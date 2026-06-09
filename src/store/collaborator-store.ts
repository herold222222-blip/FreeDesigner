"use client";

import { create } from "zustand";
import type { StageCollaboratorService } from "@/lib/types";

interface CollaboratorState {
  services: StageCollaboratorService[];
  addService: (service: StageCollaboratorService) => void;
  updateService: (
    id: string,
    patch: Partial<StageCollaboratorService>,
  ) => void;
  ensureService: (service: StageCollaboratorService) => void;
}

export const useCollaboratorStore = create<CollaboratorState>((set, get) => ({
  services: [],
  addService: (service) =>
    set({ services: [...get().services, service] }),
  updateService: (id, patch) =>
    set({
      services: get().services.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    }),
  ensureService: (service: StageCollaboratorService) => {
    if (!get().services.some((s) => s.id === service.id)) {
      set({ services: [...get().services, service] });
    }
  },
}));
