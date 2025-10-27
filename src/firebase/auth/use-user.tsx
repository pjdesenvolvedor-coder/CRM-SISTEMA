'use client';
import { User } from 'firebase/auth';

export interface UserAuthHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Hook de autenticação simplificado. Como não há login de usuário,
 * ele retorna imediatamente um estado de "não autenticado".
 */
export const useUser = (): UserAuthHookResult => {
  return {
    user: null,
    isUserLoading: false, // Não há carregamento de usuário
    userError: null
  };
};
