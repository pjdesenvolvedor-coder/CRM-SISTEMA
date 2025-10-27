'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import SecurityPage from './security-page';
import { Loader } from 'lucide-react';

const AUTH_KEY = 'app_access_granted';

interface SecurityContextType {
    isAuthenticated: boolean;
    logout: () => void;
  }
  
export const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleSuccess = useCallback(() => {
    try {
      localStorage.setItem(AUTH_KEY, 'true');
    } catch (error) {
      console.error('Failed to write to localStorage', error);
    }
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    try {
        localStorage.removeItem(AUTH_KEY);
    } catch (error) {
        console.error('Failed to remove from localStorage', error);
    }
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const accessGranted = localStorage.getItem(AUTH_KEY);
        if (accessGranted === 'true') {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Failed to access localStorage', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);
  

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SecurityContext.Provider value={{ isAuthenticated, logout }}>
        {isAuthenticated ? children : <SecurityPage onSuccess={handleSuccess} />}
    </SecurityContext.Provider>
  );
}

export const useSecurity = () => {
    const context = useContext(SecurityContext);
    if (context === undefined) {
      throw new Error('useSecurity must be used within a SecurityProvider');
    }
    return context;
  };