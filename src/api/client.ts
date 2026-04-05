import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Development: bilgisayarın local IP adresi (aynı WiFi ağında fiziksel cihaz için)
const DEV_HOST = '192.168.1.20';

const PROD_API = 'https://chefmate-api-production.up.railway.app/api/v1';

const getBaseUrl = () => {
  // Web build her zaman production API kullanır
  if (Platform.OS === 'web') return PROD_API;
  if (!__DEV__) return PROD_API;
  return `http://${DEV_HOST}:3000/api/v1`;
};

const API_BASE = getBaseUrl();

interface RequestOptions {
  method?: string;
  body?: any;
  token?: string | null;
}

class ApiClient {
  private accessToken: string | null = null;

  async init() {
    this.accessToken = await AsyncStorage.getItem('access_token');
  }

  setToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      AsyncStorage.setItem('access_token', token);
    } else {
      AsyncStorage.removeItem('access_token');
    }
  }

  async setRefreshToken(token: string | null) {
    if (token) {
      await AsyncStorage.setItem('refresh_token', token);
    } else {
      await AsyncStorage.removeItem('refresh_token');
    }
  }

  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem('refresh_token');
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, token } = options;
    const authToken = token ?? this.accessToken;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const config: RequestInit = { method, headers };
    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const res = await fetch(`${API_BASE}${endpoint}`, config);

    if (res.status === 401 && authToken) {
      // Try refresh
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retryRes = await fetch(`${API_BASE}${endpoint}`, { ...config, headers });
        if (!retryRes.ok) {
          throw await this.parseError(retryRes);
        }
        const retryJson = await retryRes.json();
        return retryJson.data !== undefined ? retryJson.data : retryJson;
      }
      throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
    }

    if (!res.ok) {
      throw await this.parseError(res);
    }

    // 204 No Content
    if (res.status === 204) return {} as T;

    const json = await res.json();
    // Unwrap API wrapper: {success, data, meta} → data
    return json.data !== undefined ? json.data : json;
  }

  private async parseError(res: Response): Promise<Error> {
    try {
      const data = await res.json();
      return new Error(data.message || data.error || `Hata: ${res.status}`);
    } catch {
      return new Error(`Hata: ${res.status}`);
    }
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.setToken(data.data?.accessToken || data.accessToken);
      await this.setRefreshToken(data.data?.refreshToken || data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  // === Public API ===

  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  put<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  patch<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
