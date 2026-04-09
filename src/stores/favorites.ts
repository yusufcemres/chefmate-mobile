import { create } from 'zustand';
import { api } from '../api/client';
import { hapticLight } from '../utils/haptics';
import { useOfflineCacheStore } from './offline-cache';

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
      const ids = Array.isArray(data) ? data : [];
      set({ ids, loaded: true });
      // Sync offline cache with favorites
      useOfflineCacheStore.getState().syncFavorites(ids).catch(() => {});
    } catch {
      set({ loaded: true });
    }
  },

  toggle: async (recipeId: string) => {
    const previousIds = [...get().ids];
    const wasFav = previousIds.includes(recipeId);
    // Optimistic update
    set({ ids: wasFav ? previousIds.filter((id) => id !== recipeId) : [...previousIds, recipeId] });
    hapticLight();

    try {
      await api.post(`/favorites/${recipeId}`, {});
    } catch {
      // Revert to previous state
      set({ ids: previousIds });
    }
  },

  isFavorite: (recipeId: string) => get().ids.includes(recipeId),
}));
