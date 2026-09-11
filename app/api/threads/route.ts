import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Lista as conversas salvas do usuário autenticado — usado por app/page.tsx
 * pra repopular a sidebar ao carregar a página (antes disso, o histórico só
 * existia na memória do processo React, e sumia a cada reload).
 *
 * Paginado (?limit=&cursor=) — ver lib/db/firebase-store.ts pro porquê:
 * sem teto, esta leitura cresce (mais lenta e mais cara) junto com o número
 * de conversas do usuário. `cursor` é o `nextCursor` opaco devolvido pela
 * página anterior; omitido, pega a primeira página (mais recentes primeiro).
 */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  const cursor = searchParams.get("cursor");

  const { items: threads, nextCursor } = await getStore().listThreads(user.uid, {
    limit,
    cursor,
  });
  return Response.json({ threads, nextCursor });
}
