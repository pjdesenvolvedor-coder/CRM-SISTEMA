'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { useUser as useUserHook } from './auth/use-user';


interface FirebaseProviderProps {
  children: ReactNode;
  firestore: Firestore;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firestore: Firestore | null;
}

// Return type for useFirebase() - Simplified, no Auth/App
export interface FirebaseServices {
  firestore: Firestore;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firestore,
}) => {
  const contextValue: FirebaseContextState = useMemo(() => {
    const servicesAvailable = !!firestore;
    return {
      areServicesAvailable: servicesAvailable,
      firestore: servicesAvailable ? firestore : null,
    };
  }, [firestore]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirestore must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firestore) {
    throw new Error('Firestore service not available. Check AppProvider setup.');
  }
  
  return context.firestore;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 */
export const useUser = useUserHook;

export const getAuth = () => initializeFirebase().auth;
export const getStorage = () => initializeFirebase().storage;
