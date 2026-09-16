import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";

export const runtime = "nodejs";

interface PatchBody {
  /** Presente = renomear pra este valor (mesmo que string vazia — o store
   * cai pra "Nova conversa" nesse caso, ver lib/db/firebase-store.ts). */
  title?: string;
  /** Presente = fixar/desfixar. Os dois campos podem vir juntos ou
   * separados; a sidebar hoje só manda um por vez (ver Sidebar.tsx). */
  pinned?: boolean;
}

/**
 * Renomear e fixar/desfixar uma conversa — as duas ações vivem na mesma
 * rota porque as duas são "editar metadado da thread", não criam nem
 * apagam nada. Não precisa checar se `threadId` pertence ao `uid` da
 * sessão: o caminho no Firestore já é users/{uid}/threads/{threadId} (ver
 * lib/db/firebase-store.ts), então um uid só tem acesso físico à própria
 * subárvore — mesma garantia já documentada em
 * app/api/threads/[threadId]/messages/route.ts.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { threadId } = await params;

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (body.title === undefined && body.pinned === undefined) {
    return Response.json({ error: "Nada pra atualizar — informe title ou pinned." }, { status: 400 });
  }

  const store = getStore();
  if (typeof body.title === "string") {
    await store.renameThread(user.uid, threadId, body.title);
  }
  if (typeof body.pinned === "boolean") {
    await store.setThreadPinned(user.uid, threadId, body.pinned);
  }

  return Response.json({ ok: true });
}

/** Exclui a conversa (mensagens + o próprio doc da thread) — ver
 * clearThread em lib/db/firebase-store.ts. Irreversível; a confirmação
 * fica a cargo da UI (ver Sidebar.tsx), não desta rota. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { threadId } = await params;
  await getStore().clearThread(user.uid, threadId);

  return Response.json({ ok: true });
}
