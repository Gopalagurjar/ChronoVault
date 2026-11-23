import { createContext, useContext, useState, useCallback } from 'react';
import api from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem('cv_user')); } catch { return null; } });

  const save = (data) => {
    localStorage.setItem('cv_token', data.token);
    localStorage.setItem('cv_user', JSON.stringify(data.user));
    setUser(data.user);
  };
  const login = useCallback(async (email, password) => save((await api.post('/auth/login', { email, password })).data), []);
  const register = useCallback(async (name, email, password) => save((await api.post('/auth/register', { name, email, password })).data), []);
  const logout = useCallback(() => { localStorage.removeItem('cv_token'); localStorage.removeItem('cv_user'); setUser(null); }, []);

  return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}
