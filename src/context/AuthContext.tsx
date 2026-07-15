import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, type User } from '../lib/api';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (
    phone: string,
    name: string,
    password: string,
    shopName: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'authToken';
const USER_KEY = 'userData';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionVersionRef = useRef(0);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      const version = ++sessionVersionRef.current;

      if (!token) {
        setLoading(false);
        return;
      }

      api.setToken(token);

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem(USER_KEY);
        }
      }

      try {
        const currentUser = await api.getCurrentUser();
        if (version !== sessionVersionRef.current) return;
        setUser(currentUser);
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
      } catch {
        if (version !== sessionVersionRef.current) return;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        api.setToken(null);
        setUser(null);
      } finally {
        if (version === sessionVersionRef.current) {
          setLoading(false);
        }
      }
    };

    init();
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY || event.key === USER_KEY) {
        const token = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);
        if (!token) {
          sessionVersionRef.current += 1;
          api.setToken(null);
          setUser(null);
          setLoading(false);
          return;
        }
        api.setToken(token);
        if (storedUser) {
          try { setUser(JSON.parse(storedUser)); }
          catch { localStorage.removeItem(USER_KEY); setUser(null); }
        }
      }
    };

    // Handle token expiry dispatched by ApiService
    const handleExpired = () => {
      sessionVersionRef.current += 1;
      setUser(null);
      setLoading(false);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('auth:expired', handleExpired);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth:expired', handleExpired);
    };
  }, []);  const persistSession = useCallback((token: string, nextUser: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    api.setToken(token);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    api.setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(
    async (phone: string, password: string) => {
      clearSession();
      const version = ++sessionVersionRef.current;
      setLoading(true);

      try {
        const response = await api.login(phone, password);
        if (version !== sessionVersionRef.current) return;
        persistSession(response.token, response.user);
        setLoading(false);
      } catch (error) {
        if (version === sessionVersionRef.current) {
          setLoading(false);
        }
        throw error;
      }
    },
    [clearSession, persistSession],
  );

  const register = useCallback(
    async (phone: string, name: string, password: string, shopName: string) => {
      clearSession();
      const version = ++sessionVersionRef.current;
      setLoading(true);

      try {
        const response = await api.register({
          phone,
          name,
          password,
          shopName,
          shopLocation: 'Uganda',
          shopInitialCapital: 0,
        });
        if (version !== sessionVersionRef.current) return;
        persistSession(response.token, response.user);
        setLoading(false);
      } catch (error) {
        if (version === sessionVersionRef.current) {
          setLoading(false);
        }
        throw error;
      }
    },
    [clearSession, persistSession],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      login,
      register,
      logout,
    }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
