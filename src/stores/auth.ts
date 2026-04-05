import { create } from 'zustand';
import { api } from '../api/client';
import type { User, UserPreference } from '../types';

interface AuthState {
  user: User | null;
  preferences: UserPreference | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreference>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  preferences: null,
  isLoading: true,
  isAuthenticated: false,

  init: async () => {
    try {
      await api.init();
      const res = await api.get<{ data: User }>('/auth/me');
      set({ user: res as any, isAuthenticated: true, isLoading: false });
      get().loadPreferences();
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email, password) => {
    const res = await api.post<{
      data: { user: User; accessToken: string; refreshToken: string };
    }>('/auth/login', { email, password });
    const { user, accessToken, refreshToken } = res as any;
    api.setToken(accessToken);
    await api.setRefreshToken(refreshToken);
    set({ user, isAuthenticated: true });
    get().loadPreferences();
  },

  register: async (email, password, displayName) => {
    const res = await api.post<{
      data: { user: User; accessToken: string; refreshToken: string };
    }>('/auth/register', { email, password, displayName });
    const { user, accessToken, refreshToken } = res as any;
    api.setToken(accessToken);
    await api.setRefreshToken(refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    api.setToken(null);
    await api.setRefreshToken(null);
    set({ user: null, preferences: null, isAuthenticated: false });
  },

  loadPreferences: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const res = await api.get<{ data: UserPreference }>(`/users/${user.id}/preferences`);
      set({ preferences: res as any });
    } catch {
      // preferences not set yet
    }
  },

  updatePreferences: async (prefs) => {
    const { user } = get();
    if (!user) return;
    const res = await api.put<{ data: UserPreference }>(`/users/${user.id}/preferences`, prefs);
    set({ preferences: res as any });
  },
}));
