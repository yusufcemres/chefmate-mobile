import { create } from 'zustand';
import { api } from '../api/client';
import type { MealPlan, MealPlanItem } from '../types';

interface MealPlanState {
  plans: MealPlan[];
  currentPlan: MealPlan | null;
  loading: boolean;
  error: string | null;

  fetchPlans: () => Promise<void>;
  fetchPlan: (id: string) => Promise<void>;
  createPlan: (name: string, startDate: string, endDate: string) => Promise<MealPlan>;
  addItem: (planId: string, item: { recipeId: string; date: string; mealType: string; servings?: number }) => Promise<void>;
  toggleCooked: (planId: string, itemId: string) => Promise<void>;
  removeItem: (planId: string, itemId: string) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  generateShoppingList: (planId: string) => Promise<any>;
}

export const useMealPlanStore = create<MealPlanState>((set, get) => ({
  plans: [],
  currentPlan: null,
  loading: false,
  error: null,

  fetchPlans: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: MealPlan[] }>('/meal-plans');
      set({ plans: res as any, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchPlan: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: MealPlan }>(`/meal-plans/${id}`);
      set({ currentPlan: res as any, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createPlan: async (name, startDate, endDate) => {
    const res = await api.post<{ data: MealPlan }>('/meal-plans', { name, startDate, endDate });
    const plan = res as any;
    await get().fetchPlans();
    return plan;
  },

  addItem: async (planId, item) => {
    await api.post(`/meal-plans/${planId}/items`, item);
    await get().fetchPlan(planId);
  },

  toggleCooked: async (planId, itemId) => {
    await api.patch(`/meal-plans/${planId}/items/${itemId}/toggle`);
    set((state) => {
      if (!state.currentPlan) return state;
      const updateItems = (items: MealPlanItem[]) =>
        items.map((i) => (i.id === itemId ? { ...i, isCooked: !i.isCooked } : i));
      const byDate = state.currentPlan.byDate
        ? Object.fromEntries(
            Object.entries(state.currentPlan.byDate).map(([date, items]) => [date, updateItems(items)])
          )
        : undefined;
      return {
        currentPlan: {
          ...state.currentPlan,
          items: updateItems(state.currentPlan.items),
          byDate,
        },
      };
    });
  },

  removeItem: async (planId, itemId) => {
    await api.delete(`/meal-plans/${planId}/items/${itemId}`);
    set((state) => {
      if (!state.currentPlan) return state;
      const filterItems = (items: MealPlanItem[]) => items.filter((i) => i.id !== itemId);
      const byDate = state.currentPlan.byDate
        ? Object.fromEntries(
            Object.entries(state.currentPlan.byDate).map(([date, items]) => [date, filterItems(items)])
          )
        : undefined;
      return {
        currentPlan: {
          ...state.currentPlan,
          items: filterItems(state.currentPlan.items),
          byDate,
        },
      };
    });
  },

  deletePlan: async (planId) => {
    await api.delete(`/meal-plans/${planId}`);
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== planId),
      currentPlan: state.currentPlan?.id === planId ? null : state.currentPlan,
    }));
  },

  generateShoppingList: async (planId) => {
    const res = await api.post<any>(`/meal-plans/${planId}/shopping-list`);
    return res;
  },
}));
