import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Só apaga o cookie de sessão — o signOut() do Firebase Auth em si (que
 * limpa o estado local do SDK client) é chamado no próprio cliente antes
 * desta requisição (ver lib/auth/use-auth.tsx / app/page.tsx). Sem chamar
 * os dois lados, um dos dois estados (cookie ou SDK client) ficaria
 * "logado" sozinho.
 */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return Response.json({ ok: true });
}
