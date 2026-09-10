import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME } from "./constants";

// Nenhum guard de "server-only" explícito aqui de propósito: o import de
// next/headers abaixo já impede o Next.js de deixar este módulo entrar num
// bundle de Client Component (erro de build automático), então adicionar a
// lib server-only só pra isso seria uma dependência a mais sem ganho real.

export { SESSION_COOKIE_NAME };

export interface SessionUser {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/**
 * Lê e valida o cookie de sessão da requisição atual (Route Handlers e
 * Server Components — next/headers cookies() funciona nos dois).
 *
 * Isto, e não o middleware, é o portão de segurança de verdade: o
 * middleware (raiz do projeto) só checa se o cookie EXISTE, pra UX
 * (redirecionar antes de piscar a tela de chat); verificar a assinatura do
 * cookie exige o Admin SDK, que não roda no Edge runtime do middleware.
 * Toda rota que mexe em dado de usuário deve chamar isto e tratar `null`
 * como 401 — nunca confiar em `id`/`personaId` vindos do corpo da
 * requisição pra decidir de quem é o dado.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    // `true` = checkRevoked: consulta se o refresh token foi revogado
    // (logout em outro dispositivo, senha trocada). Custa uma chamada extra
    // ao Firebase por request, mas pra volume de portfólio isso não pesa, e
    // sem isso um cookie roubado continuaria válido até expirar (14 dias).
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
      picture: (decoded.picture as string | undefined) ?? null,
    };
  } catch {
    // Cookie ausente, expirado, revogado ou adulterado — tudo cai aqui como
    // "não autenticado". Não vale logar isso como erro (acontece o tempo
    // todo em uso normal, ex.: sessão expirada).
    return null;
  }
}
