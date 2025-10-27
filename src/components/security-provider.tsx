'use client';

import React, { useState, useCallback, createContext, useContext } from 'react';
import SecurityPage from './security-page';
import { Loader } from 'lucide-react';

interface SecurityContextType {
    isAuthenticated: boolean;
    logout: () => void;
  }
  
export const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleSuccess = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
  }, []);
  
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
