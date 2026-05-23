import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import apiClient from '../api/axios';
import { canAccess } from '../utils/canAccess';

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
  // schoolPayment shape: { plan: string, expiresAt: string|null }

  // Fetch plan status from /school/ whenever a user is logged in.
  // This runs on app mount and is re-triggered via refreshSchoolPayment().
  const refreshSchoolPayment = useCallback(async () => {
    try {
      const res = await apiClient.get('/school/');
      const { plan, subscription_expires_at } = res.data;
      setSchoolPayment({
        plan: plan ?? 'free',
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
   * Returns true when the school can access the given feature.
   * Superusers always have full access.
   * @param {string} feature - Feature key (see canAccess utility).
   */
  const schoolCanAccess = useCallback((feature) => {
    if (!auth) return false;
    if (auth.isSuperuser) return true;
    if (!schoolPayment) return false;
    return canAccess(schoolPayment, feature, schoolPayment.expiresAt);
  }, [auth, schoolPayment]);

  /**
   * @deprecated Use schoolCanAccess('sms') instead.
   * Kept for gradual migration; checks plan='pro'.
   */
  const isSchoolPaid = useCallback(() => schoolCanAccess('sms'), [schoolCanAccess]);

  /**
   * @deprecated Use schoolCanAccess('school_pdf') instead.
   * Kept for gradual migration; checks plan in ('standard','pro').
   */
  const isSchoolPaidOrDownloadOnly = useCallback(
    () => schoolCanAccess('school_pdf'),
    [schoolCanAccess],
  );

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
    <AuthContext.Provider value={{ auth, login, loginWithTokens, logout, schoolPayment, schoolCanAccess, isSchoolPaid, isSchoolPaidOrDownloadOnly, refreshSchoolPayment }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
