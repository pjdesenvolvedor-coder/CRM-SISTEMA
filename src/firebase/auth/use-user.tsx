'use client';
import { useState, useEffect } from 'react';
import { Auth, User, onAuthStateChanged, signOut } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

export interface UserAuthHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  logout: () => Promise<void>;
}

/**
 * Hook de autenticação que lida com o estado do usuário.
 */
export const useUser = (): UserAuthHookResult => {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [userError, setUserError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const { firebaseApp } = initializeFirebase();
      const authInstance = getAuth(firebaseApp);
      setAuth(authInstance);
      setUser(authInstance.currentUser);
      setIsUserLoading(!authInstance.currentUser); 
    } catch (e) {
      console.error("Failed to initialize Firebase Auth", e);
      setUserError(e as Error);
      setIsUserLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setIsUserLoading(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setIsUserLoading(false);
        setUserError(null);
      },
      (error) => {
        console.error("Auth state change error:", error);
        setUserError(error);
        setIsUserLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth]);

  const logout = async () => {
    if (auth) {
      await signOut(auth);
      setUser(null);
    }
  };

  return {
    user,
    isUserLoading,
    userError,
    logout,
  };
};
