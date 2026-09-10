import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Lista as conversas salvas do usuário autenticado — usado por app/page.tsx
 * pra repopular a sidebar ao carregar a página (antes disso, o histórico só
 * existia na memória do processo React, e sumia a cada reload).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const threads = await getStore().listThreads(user.uid);
  return Response.json({ threads });
}
