'use client';

import React, { createContext, useContext, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader } from 'lucide-react';
import { useUser as useUserHook } from '@/firebase';
import type { User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_ROUTES = ['/login', '/register'];

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading, logout } = useUserHook();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isUserLoading) {
      const isAuthRoute = AUTH_ROUTES.includes(pathname);
      
      if (!user && !isAuthRoute) {
        // If not logged in and not on an auth page, redirect to login
        router.push('/login');
      } else if (user && isAuthRoute) {
        // If logged in and on an auth page, redirect to dashboard
        router.push('/');
      }
    }
  }, [user, isUserLoading, router, pathname]);

  if (isUserLoading || (!user && !AUTH_ROUTES.includes(pathname))) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user is loaded and on an auth route, or is logged in, render children
  if ((!isUserLoading && AUTH_ROUTES.includes(pathname)) || user) {
     return (
        <AuthContext.Provider value={{ user, isLoading: isUserLoading, logout }}>
            {children}
        </AuthContext.Provider>
    );
  }

  // Fallback loading state
  return (
    <div className="flex h-screen w-full items-center justify-center">
        <Loader className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}

export const useSecurity = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
