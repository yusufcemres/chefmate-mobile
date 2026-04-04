import { create } from 'zustand';
import { api } from '../api/client';
import type { ShoppingList } from '../types';

interface ShoppingState {
  lists: ShoppingList[];
  currentList: ShoppingList | null;
  loading: boolean;
  error: string | null;

  fetchLists: () => Promise<void>;
  fetchList: (id: string) => Promise<void>;
  createList: (name?: string) => Promise<ShoppingList>;
  generateFromRecipe: (recipeId: string) => Promise<any>;
  addItem: (listId: string, item: { productId?: string; customName?: string; quantity: number; unit: string }) => Promise<void>;
  toggleItem: (listId: string, itemId: string, isChecked: boolean) => Promise<void>;
  removeItem: (listId: string, itemId: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
}

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  lists: [],
  currentList: null,
  loading: false,
  error: null,

  fetchLists: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: ShoppingList[] }>('/shopping-lists');
      set({ lists: res.data || res as any, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchList: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: ShoppingList }>(`/shopping-lists/${id}`);
      set({ currentList: res.data || res as any, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createList: async (name) => {
    const res = await api.post<{ data: ShoppingList }>('/shopping-lists', { name: name || 'Alışveriş Listem' });
    const list = res.data || res as any;
    await get().fetchLists();
    return list;
  },

  generateFromRecipe: async (recipeId) => {
    const res = await api.post<any>('/shopping-lists/from-recipe', { recipeId });
    await get().fetchLists();
    return res.data || res;
  },

  addItem: async (listId, item) => {
    await api.post(`/shopping-lists/${listId}/items`, item);
    await get().fetchList(listId);
  },

  toggleItem: async (listId, itemId, isChecked) => {
    await api.patch(`/shopping-lists/${listId}/items/${itemId}`, { isChecked });
    // Update local state optimistically
    set((state) => {
      if (!state.currentList) return state;
      return {
        currentList: {
          ...state.currentList,
          items: state.currentList.items.map((i) =>
            i.id === itemId ? { ...i, isChecked } : i
          ),
        },
      };
    });
  },

  removeItem: async (listId, itemId) => {
    await api.delete(`/shopping-lists/${listId}/items/${itemId}`);
    set((state) => {
      if (!state.currentList) return state;
      return {
        currentList: {
          ...state.currentList,
          items: state.currentList.items.filter((i) => i.id !== itemId),
        },
      };
    });
  },

  deleteList: async (listId) => {
    await api.delete(`/shopping-lists/${listId}`);
    set((state) => ({
      lists: state.lists.filter((l) => l.id !== listId),
      currentList: state.currentList?.id === listId ? null : state.currentList,
    }));
  },
}));
