'use client';
import { useState, useEffect } from 'react';
import { Auth, User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import { initializeFirebase } from '@/firebase';

export interface UserAuthHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Hook de autenticação que lida com o estado do usuário
 * e realiza o login anônimo se nenhum usuário estiver logado.
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
      // Set initial user state from auth instance, might be null
      setUser(authInstance.currentUser);
    } catch (e) {
      console.error("Failed to initialize Firebase Auth", e);
      setUserError(e as Error);
      setIsUserLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      // If auth is not initialized, we are not done loading.
      setIsUserLoading(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          setUser(user);
          setIsUserLoading(false);
          setUserError(null);
        } else {
          // If no user, sign in anonymously
          signInAnonymously(auth).catch((error) => {
            console.error("Anonymous sign-in failed:", error);
            setUserError(error);
            setIsUserLoading(false);
          });
        }
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

  return {
    user,
    isUserLoading,
    userError,
  };
};
