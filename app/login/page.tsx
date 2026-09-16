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

const BOT_NAME = "Kado";

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
    <main className="flex min-h-dvh bg-bg text-text">
      {/* Coluna do formulário — layout split com foto (coluna da direita)
          vem direto do design "Kado Chatbot" (Claude Design); a tela em si
          não veio do protótipo original (ver README, seção "Interface"),
          só a moldura visual. */}
      <div className="flex w-full flex-1 flex-col overflow-y-auto px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 flex-none rounded-[var(--radius-sm)] bg-accent" />
          <span className="font-heading text-xl">{BOT_NAME}</span>
        </div>

        <div className="flex flex-1 flex-col items-start justify-center gap-4 py-10">
          <h1 className="font-heading m-0 max-w-sm text-[28px] font-normal leading-tight sm:text-[32px]">
            {mode === "signin" ? "Resolva suas belíssimas dúvidas" : "Crie sua conta"}
          </h1>
          <p className="m-0 text-[13px] text-muted">
            {mode === "signin"
              ? "Um pequeno companheiro pra ajudar."
              : "Leva menos de um minuto."}
          </p>

          <div className="mt-1.5 flex w-full max-w-sm flex-col items-stretch gap-2.5 rounded-2xl border border-divider p-5">
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2.5 rounded-md border border-divider bg-surface px-4 py-2.5 text-[13px] font-semibold text-text disabled:opacity-50"
            >
              <GoogleIcon />
              Continuar com Google
            </button>

            <div className="my-1 flex items-center gap-3">
              <div className="h-px flex-1 bg-divider" />
              <span className="text-[11px] uppercase tracking-wider text-muted">ou</span>
              <div className="h-px flex-1 bg-divider" />
            </div>

            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2.5">
              <label className="mt-0.5 flex flex-col gap-1">
                <span className="text-[12px] text-muted">E-mail</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="rounded-[var(--radius-sm)] border border-divider bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent disabled:opacity-50"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-muted">Senha</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className="rounded-[var(--radius-sm)] border border-divider bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent disabled:opacity-50"
                />
              </label>

              {mode === "signup" && (
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] text-muted">Confirmar senha</span>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={submitting}
                    className="rounded-[var(--radius-sm)] border border-divider bg-surface-2 px-3 py-2.5 text-[13px] text-text outline-none focus:border-accent disabled:opacity-50"
                  />
                </label>
              )}

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="self-start text-[12.5px] text-muted hover:text-text"
                >
                  Esqueceu sua senha?
                </button>
              )}

              {error && <p className="text-[12.5px] font-semibold text-accent-text">{error}</p>}
              {info && <p className="text-[12.5px] font-semibold text-muted">{info}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 rounded-[var(--radius-md)] bg-text px-4 py-2.5 text-[13px] font-bold text-bg disabled:opacity-50"
              >
                {mode === "signin" ? "Entrar" : "Criar conta"}
              </button>
            </form>

            <p className="mt-1 text-center text-[11px] leading-relaxed text-muted">
              Ao continuar, você declara estar de acordo com a política de privacidade.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "signin" ? "signup" : "signin"));
              setError(null);
              setInfo(null);
            }}
            className="text-[12.5px] text-muted hover:text-text"
          >
            {mode === "signin" ? "Não tem conta? " : "Já tem conta? "}
            <span className="font-semibold text-accent">
              {mode === "signin" ? "Cadastre-se" : "Entrar"}
            </span>
          </button>
        </div>
      </div>

      {/* Coluna da foto — só em telas largas, mesma decisão de
          "sem imagem decorativa" que o e-mail de verificação/confirmação já
          seguia: em telas pequenas o formulário é o que importa. */}
      <div className="hidden flex-1 p-10 pl-0 lg:flex">
        <div
          className="h-full w-full flex-1 rounded-[var(--radius-lg)] bg-cover bg-center"
          style={{
            backgroundImage:
              "url(https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=1200&q=80)",
          }}
          role="img"
          aria-label="Paisagem"
        />
      </div>
    </main>
  );
}
