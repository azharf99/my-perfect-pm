import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

// Request interceptor to attach Anti-CSRF token & active Tenant ID header
apiClient.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  // Attach Tenant ID if stored in localStorage
  const tenantId = localStorage.getItem('my_perfect_pm_tenant_id');
  if (tenantId && !config.headers['X-Tenant-ID']) {
    config.headers['X-Tenant-ID'] = tenantId;
  }

  return config;
});

// Response interceptor to handle silent token refresh on 401 & forced flow redirects on 403
let isRefreshing = false;
let failedQueue: Array<{ resolve: (val?: any) => void; reject: (err?: any) => void }> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check for forced security flows (403 Forbidden with specific code)
    if (error.response?.status === 403) {
      const code = error.response.data?.code;
      if (code === 'PASSWORD_CHANGE_REQUIRED') {
        if (!window.location.pathname.includes('/account/change-password-required') && !window.location.pathname.includes('/login')) {
          window.location.href = '/account/change-password-required';
        }
      } else if (code === 'MFA_SETUP_REQUIRED') {
        if (!window.location.pathname.includes('/account/setup-2fa-required') && !window.location.pathname.includes('/login')) {
          window.location.href = '/account/setup-2fa-required';
        }
      }
    }

    // Ignore 401 for login/register/refresh endpoints to avoid infinite loops
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post('/auth/refresh');
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr);
        // If refresh fails, clear state & let auth context redirect
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
