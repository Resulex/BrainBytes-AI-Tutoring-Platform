import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('brainbytes_token');
    const storedUser = localStorage.getItem('brainbytes_user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Verify token is still valid
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (t) => {
    try {
      const res = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      setUser(res.data.user);
      localStorage.setItem('brainbytes_user', JSON.stringify(res.data.user));
    } catch (err) {
      // Token invalid - clear auth state
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email, password) => {
    const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    const { token: newToken, user: userData } = res.data;
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('brainbytes_token', newToken);
    localStorage.setItem('brainbytes_user', JSON.stringify(userData));
    // Set default auth header
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    return userData;
  }, []);

  const register = useCallback(async (name, email, password, preferredSubjects) => {
    const res = await axios.post(`${API_URL}/api/auth/register`, {
      name, email, password, preferredSubjects
    });
    const { token: newToken, user: userData } = res.data;
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('brainbytes_token', newToken);
    localStorage.setItem('brainbytes_user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    return userData;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('brainbytes_token');
    localStorage.removeItem('brainbytes_user');
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('brainbytes_user', JSON.stringify(updatedUser));
  }, []);

  // Restore auth header if token exists on mount
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout, updateUser,
      isAuthenticated: !!token
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
