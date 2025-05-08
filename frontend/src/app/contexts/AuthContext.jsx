'use client';

import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);
  
  useEffect(() => {
    // Check if user is logged in from localStorage on page load
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      fetchUserData(storedToken);
    } else {
      setLoading(false);
    }
  }, []);
  
  const fetchUserData = async (authToken) => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/user', {
        headers: {
          'x-auth-token': authToken
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token invalid
        logout();
      }
    } catch (error) {
      setError('Failed to fetch user data');
      logout();
    } finally {
      setLoading(false);
    }
  };
  
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Properly handle the error message from the backend
        throw new Error(data.message || 'Failed to login. Please check your credentials.');
      }
      
      localStorage.setItem('authToken', data.token);
      setToken(data.token);
      await fetchUserData(data.token);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'An error occurred during login');
      setLoading(false);
      return false;
    }
  };
  
  const register = async (username, email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to register');
      }
      
      localStorage.setItem('authToken', data.token);
      setToken(data.token);
      await fetchUserData(data.token);
      return true;
    } catch (error) {
      setError(error.message);
      setLoading(false);
      return false;
    }
  };
  
  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    setToken(null);
  };
  
  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        loading, 
        error, 
        token,
        login, 
        register, 
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 