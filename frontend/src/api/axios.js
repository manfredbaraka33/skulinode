import axios from 'axios';

const STORAGE_KEY = 'skulinode_auth';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token from localStorage on every request
apiClient.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const auth = raw ? JSON.parse(raw) : null;
    if (auth?.accessToken) {
      config.headers.Authorization = `Bearer ${auth.accessToken}`;
    }
  } catch {
    // ignore
  }
  return config;
});

// Auto-refresh access token on 401, then retry the original request once
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only handle 401s that haven't already been retried
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Don't retry the token endpoint itself
    if (original.url?.includes('/auth/token/')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const auth = raw ? JSON.parse(raw) : null;
      if (!auth?.refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(
        'http://127.0.0.1:8000/api/v1/auth/token/refresh/',
        { refresh: auth.refreshToken },
      );

      const newAccess = data.access;
      const updated = { ...auth, accessToken: newAccess };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      apiClient.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
      original.headers.Authorization = `Bearer ${newAccess}`;
      processQueue(null, newAccess);
      return apiClient(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Token refresh failed — clear session and redirect to login
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;

