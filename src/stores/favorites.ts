import { create } from 'zustand';
import { api } from '../api/client';

interface FavoritesState {
  ids: string[];
  loaded: boolean;
  fetch: () => Promise<void>;
  toggle: (recipeId: string) => Promise<void>;
  isFavorite: (recipeId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: [],
  loaded: false,

  fetch: async () => {
    try {
      const res = await api.get<any>('/favorites/ids');
      const data = res;
      set({ ids: Array.isArray(data) ? data : [], loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  toggle: async (recipeId: string) => {
    const { ids } = get();
    // Optimistic update
    const wasFav = ids.includes(recipeId);
    set({ ids: wasFav ? ids.filter((id) => id !== recipeId) : [...ids, recipeId] });

    try {
      await api.post(`/favorites/${recipeId}`, {});
    } catch {
      // Revert
      set({ ids: wasFav ? [...get().ids, recipeId] : get().ids.filter((id) => id !== recipeId) });
    }
  },

  isFavorite: (recipeId: string) => get().ids.includes(recipeId),
}));
