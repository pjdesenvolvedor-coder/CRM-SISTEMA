'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface AppProviderProps {
  children: ReactNode;
}

// Initialize Firebase on the client side, outside of the component render cycle.
const { firestore } = initializeFirebase();

export function AppProvider({ children }: AppProviderProps) {
  // We only provide firestore now, no auth or firebaseApp needed at this level.
  return (
    <FirebaseProvider
      firestore={firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
