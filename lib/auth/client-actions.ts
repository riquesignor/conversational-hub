import { signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

/**
 * Troca o usuário recém-autenticado no SDK client (Google popup ou
 * e-mail/senha — ver app/login/page.tsx) por um cookie de sessão httpOnly,
 * chamando app/api/auth/session/route.ts com o ID token atual. Sem isto, o
 * login "funciona" no SDK client mas o servidor (app/api/chat, etc.) nunca
 * fica sabendo — é o cookie, não o estado do SDK client, que autoriza as
 * requisições.
 */
export async function establishSession(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    throw new Error("Falha ao estabelecer sessão no servidor.");
  }
}

/** Inverso de establishSession: limpa os dois lados (SDK client + cookie).
 * Usado pelo botão "Sair" na sidebar (ver components/chat/Sidebar.tsx). */
export async function logout(): Promise<void> {
  await signOut(auth);
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {
    // Best-effort: mesmo se a chamada falhar (rede, servidor fora), o SDK
    // client já saiu — o pior caso é o cookie sobreviver até expirar
    // (no máximo 14 dias) sem o usuário estar "logado" na UI.
  });
}
