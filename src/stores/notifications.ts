import { create } from 'zustand';
import { api } from '../api/client';

interface ExpiringItem {
  id: string;
  userId: string;
  productId: string;
  product: { id: string; productName: string; categoryId: string };
  quantityDisplay: number;
  displayUnit: string;
  storageLocation: string;
  expirationDate: string | null;
  status: string;
}

interface NotificationState {
  expiringItems: ExpiringItem[];
  loading: boolean;
  error: string | null;
  pushEnabled: boolean;

  fetchExpiringItems: (days?: number) => Promise<void>;
  registerPushToken: (token: string) => Promise<void>;
  removePushToken: () => Promise<void>;
  triggerExpiryCheck: () => Promise<{ itemsExpiring: number; notificationsSent: number }>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  expiringItems: [],
  loading: false,
  error: null,
  pushEnabled: false,

  fetchExpiringItems: async (days = 3) => {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: ExpiringItem[] }>(`/notifications/expiring-items?days=${days}`);
      set({ expiringItems: res as any, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  registerPushToken: async (token) => {
    await api.post('/notifications/fcm-token', { fcmToken: token });
    set({ pushEnabled: true });
  },

  removePushToken: async () => {
    await api.delete('/notifications/fcm-token');
    set({ pushEnabled: false });
  },

  triggerExpiryCheck: async () => {
    const res = await api.post<{ data: { itemsExpiring: number; notificationsSent: number } }>('/notifications/check-expiry');
    return res as any;
  },
}));
