import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.user), () => setUser(null));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading: user === undefined,
      setUser,
      login: async (email, password) => {
        const r = await api.post('/auth/login', { email, password });
        setUser(r.user);
        return r.user;
      },
      register: async (data) => {
        const r = await api.post('/auth/register', data);
        setUser(r.user);
        return r.user;
      },
      logout: async () => {
        // Leave account/admin pages first: signed out there, they send you to
        // /login?next=… and the next sign-in would land back on them.
        navigate('/', { replace: true });
        await api.post('/auth/logout');
        setUser(null);
      },
    }),
    [user, navigate],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
