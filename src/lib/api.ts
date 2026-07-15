const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const normalized = rawApiUrl.replace(/\/$/, '');
export const API_URL = normalized.endsWith('/api') ? normalized : `${normalized}/api`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserPermissions {
  canViewDashboard: boolean;
  canMakeSales: boolean;
  canApproveCredits: boolean;
  canAccessInventory: boolean;
  canManageExpenses: boolean;
  canViewReports: boolean;
  pagePermissions: Record<string, boolean>;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  shopId?: string;
  isActive?: boolean;
  accountType?: 'owner' | 'staff';
  role?: string;
  permissions?: UserPermissions;
}

export interface AuthResponse {
  user: User;
  token: string;
  isNew?: boolean;
}

export interface DashboardData {
  today: { sales: number; profit: number; transactions: number; cashSales: number; creditSales: number };
  week: { sales: number; profit: number; transactions: number };
  month: { sales: number; profit: number; transactions: number; profitMargin: number };
  inventory: { lowStockCount: number; lowStockProducts: Array<{ id: string; name: string; stock: number; sellingPrice?: number }> };
  credits: { totalOutstanding: number; pendingCount: number; overdueCount: number };
  recentActivity: Array<{ id: string; type: string; description: string; amount: number; paymentType?: string; createdAt: string }>;
}

export class ApiError extends Error {
  status: number;
  isNetworkError: boolean;
  constructor(message: string, status: number, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

// ─── In-memory request cache (TTL: 30s) ──────────────────────────────────────

interface CacheEntry<T> { data: T; expiresAt: number }
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30_000;

export function bustCache(pattern?: string) {
  if (!pattern) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

// ─── In-flight deduplication ─────────────────────────────────────────────────

const inFlight = new Map<string, Promise<unknown>>();

// ─── ApiService ───────────────────────────────────────────────────────────────

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (!token) cache.clear();
  }

  private getHeaders(isAuth = false): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token && !isAuth) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  private handleUnauthorized() {
    this.token = null;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('authToken');
      window.localStorage.removeItem('userData');
      // Dispatch event so AuthContext can react
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
  }

  async request<T>(
    endpoint: string,
    options: RequestInit & { cacheable?: boolean; retries?: number } = {},
  ): Promise<T> {
    const { cacheable = false, retries = 1, ...fetchOptions } = options;
    const isAuth = endpoint.startsWith('/auth/');
    const cacheKey = `${endpoint}|${JSON.stringify(fetchOptions.body ?? '')}`;

    // Return cached GET responses
    if (cacheable && (!fetchOptions.method || fetchOptions.method === 'GET')) {
      const cached = cache.get(cacheKey) as CacheEntry<T> | undefined;
      if (cached && Date.now() < cached.expiresAt) return cached.data;

      // Deduplicate concurrent identical requests
      if (inFlight.has(cacheKey)) return inFlight.get(cacheKey) as Promise<T>;
    }

    const execute = async (attempt: number): Promise<T> => {
      let response: Response;
      try {
        response = await fetch(`${API_URL}${endpoint}`, {
          ...fetchOptions,
          headers: { ...this.getHeaders(isAuth), ...(fetchOptions.headers as Record<string, string>) },
        });
      } catch {
        // Network failure — retry with backoff
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          return execute(attempt + 1);
        }
        throw new ApiError('Network error — check your connection', 0, true);
      }

      if (response.status === 401) {
        this.handleUnauthorized();
        throw new ApiError('Session expired. Please sign in again.', 401);
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg = Array.isArray(body.message)
          ? body.message[0]
          : body.message || `Error ${response.status}`;
        // Retry on 5xx
        if (response.status >= 500 && attempt < retries) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
          return execute(attempt + 1);
        }
        throw new ApiError(msg, response.status);
      }

      const data: T = await response.json().catch(() => ({} as T));

      if (cacheable) {
        cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL });
        inFlight.delete(cacheKey);
      }

      return data;
    };

    const promise = execute(1);

    if (cacheable) {
      inFlight.set(cacheKey, promise);
      promise.catch(() => inFlight.delete(cacheKey));
    }

    return promise;
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  login(phone: string, password: string) {
    return this.request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
  }

  register(data: { phone: string; name: string; password: string; shopName: string; shopLocation?: string; shopInitialCapital?: number }) {
    return this.request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) });
  }

  // ─── Cached reads ─────────────────────────────────────────────────────────

  getCurrentUser() {
    return this.request<User>('/auth/me', { cacheable: true });
  }

  getDashboardData() {
    return this.request<DashboardData>('/dashboard', { cacheable: true });
  }

  getDashboardAnalytics(period: 'week' | 'month' | 'year' = 'month') {
    return this.request(`/dashboard/analytics?period=${period}`, { cacheable: true });
  }
}

export const api = new ApiService();

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('0')) return '+256' + trimmed.slice(1);
  return trimmed;
}

export function authHeader(): Record<string, string> {
  const token = localStorage.getItem('authToken') || '';
  return { Authorization: `Bearer ${token}` };
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return api.request<T>(endpoint, { retries: 2, ...options });
}
