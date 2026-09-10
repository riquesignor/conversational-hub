"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/use-auth";
import { establishSession } from "@/lib/auth/client-actions";
import { translateAuthError } from "@/lib/auth/errors";
import { GoogleIcon } from "@/components/chat/icons";

type Mode = "signin" | "signup";

const BOT_NAME = "Zezinho";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Já logado (cookie de sessão restaurado, ou acabou de logar) — não faz
  // sentido ficar na tela de login. O middleware cobre a navegação direta
  // pra "/"; isto cobre quem já está com a aba de /login aberta.
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  async function handleGoogleClick() {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const { user: signedInUser } = await signInWithPopup(getFirebaseAuth(), googleProvider);
      await establishSession(signedInUser);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { user: newUser } = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
        // Não bloqueia o cadastro esperando confirmação — só dispara o
        // e-mail de verificação em paralelo. Enforçar verificação antes de
        // liberar acesso fica como próximo passo (ver README).
        sendEmailVerification(newUser).catch(() => {});
        await establishSession(newUser);
      } else {
        const { user: signedInUser } = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
        await establishSession(signedInUser);
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Digita seu e-mail no campo acima primeiro.");
      return;
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
      setInfo("Enviamos um link de redefinição de senha pro seu e-mail.");
    } catch (err) {
      setError(translateAuthError(err));
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 text-text">
      <div className="w-full max-w-sm border border-divider bg-surface p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center bg-accent-strong text-lg font-extrabold text-on-accent">
            {BOT_NAME.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-lg font-extrabold">
            {mode === "signin" ? `Entrar no ${BOT_NAME}` : "Criar conta"}
          </h1>
          <p className="text-[12.5px] text-muted">
            {mode === "signin"
              ? "Suas conversas ficam salvas na sua conta."
              : "Leva menos de um minuto."}
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2.5 border border-divider bg-bg px-4 py-2.5 text-[13px] font-semibold text-text disabled:opacity-50"
        >
          <GoogleIcon />
          Continuar com Google
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-divider" />
          <span className="text-[11px] uppercase tracking-wider text-muted">ou</span>
          <div className="h-px flex-1 bg-divider" />
        </div>

        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-muted">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="border border-divider bg-input-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-muted">Senha</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="border border-divider bg-input-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
            />
          </label>

          {mode === "signup" && (
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] font-semibold text-muted">Confirmar senha</span>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
                className="border border-divider bg-input-bg px-3 py-2.5 text-sm text-text outline-none focus:border-accent disabled:opacity-50"
              />
            </label>
          )}

          {mode === "signin" && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="self-end text-[11.5px] font-semibold text-accent-text underline-offset-2 hover:underline"
            >
              Esqueci minha senha
            </button>
          )}

          {error && <p className="text-[12.5px] font-semibold text-accent-text">{error}</p>}
          {info && <p className="text-[12.5px] font-semibold text-muted">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 bg-accent-strong px-4 py-2.5 text-sm font-extrabold text-on-accent disabled:opacity-50"
          >
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-muted">
          {mode === "signin" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError(null);
              setInfo(null);
            }}
            className="font-semibold text-accent-text underline-offset-2 hover:underline"
          >
            {mode === "signin" ? "Criar conta" : "Entrar"}
          </button>
        </p>
      </div>
    </main>
  );
}
