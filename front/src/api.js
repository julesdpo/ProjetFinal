import axios from 'axios';

const apiBase = import.meta.env.VITE_API_BASE || 'https://localhost:8443';

export const api = axios.create({
  baseURL: apiBase,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isRefreshCall = original?.url?.includes('/auth/refresh');
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/register');
    if (error.response?.status === 401 && !original._retry && !isRefreshCall && !isAuthCall) {
      original._retry = true;
      try {
        await api.post('/auth/refresh');
        return api(original);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  }
);

export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
}

export async function register(email, password) {
  const res = await api.post('/auth/register', { email, password });
  return res.data;
}

export async function refresh() {
  return api.post('/auth/refresh');
}

export async function me() {
  const res = await api.get('/auth/me');
  return res.data;
}

export async function logout() {
  return api.post('/auth/logout');
}

export async function listTickets() {
  const res = await api.get('/api/tickets');
  return res.data;
}

export async function createTicket(payload) {
  const res = await api.post('/api/tickets', payload);
  return res.data;
}

export async function updateTicket(id, payload) {
  const res = await api.patch(`/api/tickets/${id}`, payload);
  return res.data;
}

export async function deleteTicket(id) {
  const res = await api.delete(`/api/tickets/${id}`);
  return res.data;
}

export async function listUsers() {
  const res = await api.get('/auth/users');
  return res.data;
}

export async function setUserStatus(id, is_active) {
  const res = await api.patch(`/auth/users/${id}/status`, { is_active });
  return res.data;
}

export async function listAudit() {
  const res = await api.get('/api/audit');
  return res.data;
}
