import { create } from 'zustand';
import { api } from '../api/client';
import type { InventoryItem } from '../types';

interface InventoryState {
  items: InventoryItem[];
  loading: boolean;
  error: string | null;

  fetchItems: (userId: string) => Promise<void>;
  addItem: (userId: string, body: { productId: string; quantityDisplay: number; displayUnit: string; storageLocation?: string; expirationDate?: string }) => Promise<void>;
  updateItem: (userId: string, itemId: string, body: Partial<InventoryItem>) => Promise<void>;
  removeItem: (userId: string, itemId: string) => Promise<void>;
  addBulk: (userId: string, items: Array<{ productId: string; quantityDisplay: number; displayUnit: string }>) => Promise<void>;
}

export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  loading: false,
  error: null,

  fetchItems: async (userId) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: { items: InventoryItem[] } }>(`/users/${userId}/inventory`);
      set({ items: (res as any)?.items || [], loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  addItem: async (userId, body) => {
    await api.post(`/users/${userId}/inventory`, body);
  },

  updateItem: async (userId, itemId, body) => {
    await api.patch(`/users/${userId}/inventory/${itemId}`, body);
  },

  removeItem: async (userId, itemId) => {
    await api.delete(`/users/${userId}/inventory/${itemId}`);
  },

  addBulk: async (userId, items) => {
    await api.post(`/users/${userId}/inventory/bulk`, { items });
  },
}));
