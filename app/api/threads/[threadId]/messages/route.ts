import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Histórico de uma conversa — chamado quando o usuário seleciona, na
 * sidebar, uma thread que ainda não está no cache local (ver
 * threadMessagesRef em app/page.tsx). Não precisa checar se `threadId`
 * pertence ao `uid` da sessão: o caminho no Firestore já é
 * users/{uid}/threads/{threadId}/messages (ver lib/db/firebase-store.ts),
 * então um uid só tem acesso físico à própria subárvore — não existe como
 * ler a thread de outra pessoa nem passando o id dela.
 *
 * Paginado (?limit=&cursor=) — sem `cursor`, devolve as mensagens mais
 * RECENTES da conversa (não as mais antigas); `nextCursor`, quando não-null,
 * busca a página anterior a essas (scroll-up "carregar mensagens
 * anteriores"). Ver lib/db/firebase-store.ts pro porquê disso existir: sem
 * teto, uma conversa longa vira uma leitura cada vez mais lenta e cara.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { threadId } = await params;
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  const cursor = searchParams.get("cursor");

  const { items: messages, nextCursor } = await getStore().getMessages(user.uid, threadId, {
    limit,
    cursor,
  });
  return Response.json({ messages, nextCursor });
}
