import axios from 'axios';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`, timeout: 30000 });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('cv_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Expired / invalid session -> back to the login page.
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('cv_token') && !err.config.url.startsWith('/auth/')) {
      localStorage.removeItem('cv_token');
      localStorage.removeItem('cv_user');
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export const errMsg = (e) => e.response?.data?.message || (e.code === 'ECONNABORTED' ? 'The request timed out' : 'Cannot reach the server');
export default api;
