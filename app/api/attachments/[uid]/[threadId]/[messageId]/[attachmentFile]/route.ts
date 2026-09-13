import { Readable } from "node:stream";
import { getSessionUser } from "@/lib/auth/session";
import { adminStorage } from "@/lib/firebase/admin";

export const runtime = "nodejs";

/**
 * Proxy autenticado pra download de anexo (imagem/PDF/texto enviado numa
 * mensagem — ver lib/storage/attachments.ts pro upload). O bucket do
 * Firebase Storage é privado (storage.rules na raiz) e só o Admin SDK
 * consegue ler — este endpoint é o ÚNICO jeito de um anexo chegar até o
 * navegador, mesmo desenho de "cliente nunca fala com o backend de dados
 * direto" já usado pro Firestore (ver lib/db/firebase-store.ts).
 *
 * O `:uid` na URL nunca é a fonte de verdade — é só o que monta o caminho no
 * bucket (StoredAttachment.url, gerado em lib/storage/attachments.ts). Quem
 * decide se a resposta sai é sempre a sessão validada abaixo, comparada
 * contra esse `:uid` (mesma defesa em profundidade de app/api/chat/route.ts).
 */
export async function GET(
  _req: Request,
  {
    params,
  }: { params: Promise<{ uid: string; threadId: string; messageId: string; attachmentFile: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { uid, threadId, messageId, attachmentFile } = await params;

  if (uid !== user.uid) {
    // Nunca "404" aqui pra não confirmar/negar a existência do anexo de
    // outro uid a quem está tentando adivinhar um path — 403 é honesto o
    // bastante já que quem chega aqui já está autenticado.
    return Response.json({ error: "Não autorizado." }, { status: 403 });
  }

  const storagePath = `users/${uid}/threads/${threadId}/${messageId}/${attachmentFile}`;
  const file = adminStorage().file(storagePath);

  const [exists] = await file.exists();
  if (!exists) {
    return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  const [metadata] = await file.getMetadata();
  const nodeStream = file.createReadStream();

  return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
    headers: {
      "Content-Type": metadata.contentType || "application/octet-stream",
      // Anexo é imutável (nunca reescrito no mesmo path — cada upload gera
      // um attachmentId novo, ver lib/storage/attachments.ts) — cache
      // agressivo no navegador é seguro.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
