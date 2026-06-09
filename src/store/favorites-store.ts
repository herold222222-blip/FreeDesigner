"use client";

import { create } from "zustand";

interface FavoritesState {
  designerIds: string[];
  hydrated: boolean;
  setDesignerIds: (ids: string[]) => void;
  toggleDesigner: (id: string) => void;
  isFavorite: (id: string) => boolean;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  designerIds: [],
  hydrated: false,
  setDesignerIds: (ids) => set({ designerIds: ids, hydrated: true }),
  toggleDesigner: (id) =>
    set((state) => {
      const exists = state.designerIds.includes(id);
      return {
        designerIds: exists
          ? state.designerIds.filter((x) => x !== id)
          : [...state.designerIds, id],
      };
    }),
  isFavorite: (id) => get().designerIds.includes(id),
  clear: () => set({ designerIds: [], hydrated: true }),
}));
