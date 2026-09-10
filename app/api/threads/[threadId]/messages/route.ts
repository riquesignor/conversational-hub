import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Histórico completo de uma conversa — chamado quando o usuário seleciona,
 * na sidebar, uma thread que ainda não está no cache local (ver
 * threadMessagesRef em app/page.tsx). Não precisa checar se `threadId`
 * pertence ao `uid` da sessão: o caminho no Firestore já é
 * users/{uid}/threads/{threadId}/messages (ver lib/db/firebase-store.ts),
 * então um uid só tem acesso físico à própria subárvore — não existe como
 * ler a thread de outra pessoa nem passando o id dela.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { threadId } = await params;
  const messages = await getStore().getMessages(user.uid, threadId);
  return Response.json({ messages });
}
