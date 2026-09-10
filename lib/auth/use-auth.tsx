"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface AuthState {
  user: User | null;
  /** true só até o primeiro callback do onAuthStateChanged — evita um
   * flash de "deslogado" antes do Firebase confirmar a sessão restaurada. */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true });

/** Monta uma vez em app/layout.tsx, envolvendo toda a árvore — qualquer
 * Client Component abaixo consegue ler o usuário atual via useAuth(). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(() => {
    // getFirebaseAuth() só é chamado aqui dentro (useEffect roda só no
    // cliente, nunca durante SSR/prerender estático do build) — ver o
    // comentário em lib/firebase/client.ts sobre por que isso importa.
    return onAuthStateChanged(getFirebaseAuth(), (user) => setState({ user, loading: false }));
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
