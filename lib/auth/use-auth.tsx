"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface AuthState {
  user: User | null;
  /** true só até o primeiro callback do onAuthStateChanged — evita um
   * flash de "deslogado" antes do Firebase confirmar a sessão restaurada. */
  loading: boolean;
  /** Não-nulo quando getFirebaseAuth()/onAuthStateChanged falha ao
   * inicializar (ex.: NEXT_PUBLIC_FIREBASE_* ausente/inválida na Vercel).
   * Ver comentário abaixo — isto existe pra nunca deixar esse erro subir
   * descoberto até o error boundary genérico do Next. */
  configError: string | null;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, configError: null });

/** Monta uma vez em app/layout.tsx, envolvendo toda a árvore — qualquer
 * Client Component abaixo consegue ler o usuário atual via useAuth(). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, configError: null });

  useEffect(() => {
    // getFirebaseAuth() só é chamado aqui dentro (useEffect roda só no
    // cliente, nunca durante SSR/prerender estático do build) — ver o
    // comentário em lib/firebase/client.ts sobre por que isso importa.
    //
    // Mesmo assim, em produção ela ainda pode lançar de verdade — por
    // exemplo se as env vars NEXT_PUBLIC_FIREBASE_* não foram configuradas
    // na Vercel (ou foram configuradas erradas). Sem este try/catch, esse
    // throw síncrono dentro do useEffect sobe direto pro error boundary
    // padrão do Next, derrubando o app inteiro numa tela genérica "This
    // page couldn't load" — sem nenhuma pista do que houve. Capturamos
    // aqui pra virar um estado normal (configError) e mostrar um
    // diagnóstico de verdade em vez disso.
    try {
      const unsubscribe = onAuthStateChanged(
        getFirebaseAuth(),
        (user) => setState({ user, loading: false, configError: null }),
        (err) => {
          console.error("[AuthProvider] onAuthStateChanged falhou:", err);
          setState({
            user: null,
            loading: false,
            configError: err instanceof Error ? err.message : String(err),
          });
        },
      );
      return unsubscribe;
    } catch (err) {
      console.error("[AuthProvider] getFirebaseAuth()/onAuthStateChanged falhou ao iniciar:", err);
      setState({
        user: null,
        loading: false,
        configError: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  if (state.configError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg px-4 text-text">
        <div className="w-full max-w-md border border-divider bg-surface p-6 sm:p-8">
          <h1 className="text-lg font-extrabold text-accent-text">Configuração do Firebase pendente</h1>
          <p className="mt-3 text-[13px] text-text">
            O app não conseguiu inicializar o login. Isso normalmente significa que as variáveis de
            ambiente <code className="text-[12px]">NEXT_PUBLIC_FIREBASE_*</code> ainda não foram
            adicionadas (ou estão com um valor errado) nas configurações do projeto na Vercel.
          </p>
          <p className="mt-3 text-[12px] text-muted">
            Detalhe técnico: <span className="font-mono">{state.configError}</span>
          </p>
          <p className="mt-3 text-[12px] text-muted">
            Confira Project Settings → Environment Variables na Vercel, adicione as chaves do Firebase
            e refaça o deploy.
          </p>
        </div>
      </main>
    );
  }

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
