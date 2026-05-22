import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import apiClient from '../api/axios';

const AuthContext = createContext(null);

/**
 * Convert a school name into a URL-safe slug.
 * e.g. "Karagwe Secondary School" → "karagwe-secondary-school"
 */
function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

const STORAGE_KEY = 'skulinode_auth';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => loadFromStorage());
  const [schoolPayment, setSchoolPayment] = useState(null);

  // Fetch payment status from /school/ whenever a user is logged in.
  // This runs on app mount and is re-triggered via refreshSchoolPayment().
  const refreshSchoolPayment = useCallback(async () => {
    try {
      const res = await apiClient.get('/school/');
      const { is_paid, is_paid_without_sms, subscription_expires_at } = res.data;
      setSchoolPayment({
        isPaid: is_paid ?? false,
        isPaidWithoutSms: is_paid_without_sms ?? false,
        expiresAt: subscription_expires_at ?? null,
      });
    } catch {
      setSchoolPayment(null);
    }
  }, []);

  useEffect(() => {
    if (auth) refreshSchoolPayment();
    else setSchoolPayment(null);
  }, [auth, refreshSchoolPayment]);

  /**
   * Returns true when the school's subscription is active and unexpired.
   * Superusers are always considered paid.
   */
  const isSchoolPaid = useCallback(() => {
    if (!auth) return false;
    if (auth.isSuperuser) return true;
    if (!schoolPayment) return false;
    if (!schoolPayment.isPaid) return false;
    if (schoolPayment.expiresAt) {
      return new Date(schoolPayment.expiresAt) >= new Date(new Date().toDateString());
    }
    return true;
  }, [auth, schoolPayment]);

  /**
   * Returns true when the school can use downloads/prints (is_paid OR is_paid_without_sms).
   * Does NOT imply SMS access — use isSchoolPaid() for that.
   */
  const isSchoolPaidOrDownloadOnly = useCallback(() => {
    if (!auth) return false;
    if (auth.isSuperuser) return true;
    if (!schoolPayment) return false;
    if (!schoolPayment.isPaid && !schoolPayment.isPaidWithoutSms) return false;
    if (schoolPayment.expiresAt) {
      return new Date(schoolPayment.expiresAt) >= new Date(new Date().toDateString());
    }
    return true;
  }, [auth, schoolPayment]);

  const login = useCallback(async (username, password) => {
    const response = await apiClient.post('/auth/token/', { username, password });
    const { access, refresh } = response.data;

    const decoded = jwtDecode(access);
    const schoolName = decoded.school_name ?? decoded.school_id ?? '';
    const schoolSlug = toSlug(String(schoolName));

    const authData = {
      accessToken: access,
      refreshToken: refresh,
      userId: decoded.user_id,
      username: decoded.username,
      email: decoded.email,
      fullName: decoded.full_name,
      role: decoded.role,
      schoolId: decoded.school_id,
      schoolName,
      schoolSlug,
      isSuperuser: decoded.is_superuser ?? false,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
    setAuth(authData);
    return authData;
  }, []);

  const loginWithTokens = useCallback((access, refresh, schoolName) => {
    const decoded = jwtDecode(access);
    const resolvedName = schoolName ?? decoded.school_name ?? decoded.school_id ?? '';
    const schoolSlug = toSlug(String(resolvedName));

    const authData = {
      accessToken: access,
      refreshToken: refresh,
      userId: decoded.user_id,
      email: decoded.email,
      fullName: decoded.full_name,
      role: decoded.role,
      schoolId: decoded.school_id,
      schoolName: resolvedName,
      schoolSlug,
      isSuperuser: decoded.is_superuser ?? false,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
    setAuth(authData);
    return authData;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, loginWithTokens, logout, schoolPayment, isSchoolPaid, isSchoolPaidOrDownloadOnly, refreshSchoolPayment }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
