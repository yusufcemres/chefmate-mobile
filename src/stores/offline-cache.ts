import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

const CACHE_KEY = 'chefmate_offline_recipes';
const CACHE_TIMESTAMP_KEY = 'chefmate_offline_ts';
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24h

interface OfflineCacheState {
  cachedRecipes: Record<string, any>;
  isOffline: boolean;
  lastSync: number | null;
  cacheRecipe: (recipe: any) => Promise<void>;
  cacheMultiple: (recipes: any[]) => Promise<void>;
  getCachedRecipe: (id: string) => any | null;
  syncFavorites: (favoriteIds: string[]) => Promise<void>;
  loadCache: () => Promise<void>;
  clearCache: () => Promise<void>;
  cacheCount: () => number;
}

export const useOfflineCacheStore = create<OfflineCacheState>((set, get) => ({
  cachedRecipes: {},
  isOffline: false,
  lastSync: null,

  loadCache: async () => {
    try {
      const [data, ts] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY),
        AsyncStorage.getItem(CACHE_TIMESTAMP_KEY),
      ]);
      if (data) {
        set({
          cachedRecipes: JSON.parse(data),
          lastSync: ts ? parseInt(ts, 10) : null,
        });
      }
    } catch {}
  },

  cacheRecipe: async (recipe: any) => {
    const { cachedRecipes } = get();
    const updated = { ...cachedRecipes, [recipe.id]: recipe };
    set({ cachedRecipes: updated, lastSync: Date.now() });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
  },

  cacheMultiple: async (recipes: any[]) => {
    const { cachedRecipes } = get();
    const updated = { ...cachedRecipes };
    for (const r of recipes) updated[r.id] = r;
    set({ cachedRecipes: updated, lastSync: Date.now() });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
  },

  getCachedRecipe: (id: string) => {
    return get().cachedRecipes[id] || null;
  },

  syncFavorites: async (favoriteIds: string[]) => {
    if (!favoriteIds.length) return;
    const { cachedRecipes } = get();
    const toFetch = favoriteIds.filter((id) => !cachedRecipes[id]);

    // Fetch missing recipes in batches of 10
    const batchSize = 10;
    const newRecipes: any[] = [];
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      const promises = batch.map((id) =>
        api.get<any>(`/recipes/${id}`).catch(() => null)
      );
      const results = await Promise.all(promises);
      newRecipes.push(...results.filter(Boolean));
    }

    if (newRecipes.length > 0) {
      await get().cacheMultiple(newRecipes);
    }

    // Remove recipes no longer in favorites (keep cache lean)
    const favSet = new Set(favoriteIds);
    const current = get().cachedRecipes;
    const pruned: Record<string, any> = {};
    for (const id of Object.keys(current)) {
      if (favSet.has(id)) pruned[id] = current[id];
    }
    set({ cachedRecipes: pruned });
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(pruned));
  },

  clearCache: async () => {
    set({ cachedRecipes: {}, lastSync: null });
    await AsyncStorage.multiRemove([CACHE_KEY, CACHE_TIMESTAMP_KEY]);
  },

  cacheCount: () => Object.keys(get().cachedRecipes).length,
}));
