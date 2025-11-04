'use client';

import React, { useState, useCallback, createContext, useContext } from 'react';
import SecurityPage from './security-page';
import { Loader } from 'lucide-react';
import { useUser as useUserHook } from '@/firebase';
import type { User } from 'firebase/auth';

interface SecurityContextType {
    isAuthenticated: boolean;
    logout: () => void;
    user: User | null;
    isUserLoading: boolean;
  }
  
export const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isPasswordAuthenticated, setIsPasswordAuthenticated] = useState(false);
  const { user, isUserLoading } = useUserHook();

  const handleSuccess = useCallback(() => {
    setIsPasswordAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setIsPasswordAuthenticated(false);
    // Note: Firebase anonymous user will persist unless explicitly signed out,
    // which is the desired behavior here to keep a stable UID.
  }, []);

  const isAuthenticated = isPasswordAuthenticated && !!user;
  
  if (!isPasswordAuthenticated) {
    return <SecurityPage onSuccess={handleSuccess} />;
  }

  if (isUserLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }
  
  return (
    <SecurityContext.Provider value={{ isAuthenticated, logout, user, isUserLoading }}>
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
