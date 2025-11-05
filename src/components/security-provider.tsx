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

  // Don't render a loading screen here. The AppDashboard will handle it.
  // This provider's main job is redirection.
  if (isUserLoading && !AUTH_ROUTES.includes(pathname)) {
      // While checking auth, if we are not on an auth route, we can show a loader,
      // but AppDashboard's loader is better. Return null to avoid rendering anything until auth is resolved.
      // Returning a loader here would cause a double loading screen.
      return (
        <div className="flex h-screen w-full items-center justify-center">
            <Loader className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }
  
  // Render children if we are on an auth page, or if the user is authenticated.
  // The child (AppDashboard) will show its own loader for data fetching.
  return (
      <AuthContext.Provider value={{ user, isLoading: isUserLoading, logout }}>
          {children}
      </AuthContext.Provider>
  );
}

export const useSecurity = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
