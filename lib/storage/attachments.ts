import { randomUUID } from "node:crypto";
import { adminStorage } from "@/lib/firebase/admin";
import type { StoredAttachment } from "@/lib/db/types";

/** Formato mínimo de um FileUIPart (ver Composer.tsx/app/page.tsx) que este
 * módulo precisa — não importa o tipo inteiro da AI SDK aqui pra não acoplar
 * este arquivo (que só sabe de Storage) ao shape exato de UIMessage. */
interface IncomingFilePart {
  filename?: string;
  mediaType: string;
  url: string;
}

// Sem a flag "s" (dotAll) de propósito — o tsconfig deste projeto não mira
// es2018+ — mas não faz falta: um data URL base64 válido não tem quebra de
// linha no meio (o alfabeto base64 não inclui \n), então "." sem dotAll já
// casa o payload inteiro igual.
const DATA_URL_RE = /^data:([^;]+);base64,(.+)$/;

function parseDataUrl(dataUrl: string): { buffer: Buffer; mediaType: string } {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) {
    throw new Error("Anexo não está no formato data URL base64 esperado.");
  }
  const [, mediaType, base64] = match;
  return { buffer: Buffer.from(base64!, "base64"), mediaType: mediaType! };
}

/** Sanitiza o nome de arquivo pro path do Storage e pro segmento de URL do
 * proxy de download — sem barra (definiria "subpasta" sem querer) nem nome
 * vazio (arquivo sem nome, ex.: colado da área de transferência). */
function safeFilename(name: string | undefined): string {
  const fallback = `arquivo-${randomUUID().slice(0, 8)}`;
  if (!name) return fallback;
  const cleaned = name.replace(/[/\\]/g, "_").trim().slice(0, 120);
  return cleaned || fallback;
}

/**
 * Faz upload de UM anexo pro Firebase Storage e devolve os metadados já no
 * formato persistido (StoredMessage.attachments, ver lib/db/types.ts).
 *
 * Path determinístico `users/{uid}/threads/{threadId}/{messageId}/{attachmentId}-{filename}`
 * — mesma raiz users/{uid} que o Firestore usa (lib/db/firebase-store.ts),
 * de propósito: um uid só tem acesso físico à própria subárvore em AMBOS os
 * backends, não só no Firestore.
 */
export async function uploadAttachment(
  uid: string,
  threadId: string,
  messageId: string,
  part: IncomingFilePart,
): Promise<StoredAttachment> {
  const { buffer, mediaType } = parseDataUrl(part.url);
  const filename = safeFilename(part.filename);
  const attachmentId = randomUUID();
  const storageFilename = `${attachmentId}-${filename}`;
  const storagePath = `users/${uid}/threads/${threadId}/${messageId}/${storageFilename}`;

  const file = adminStorage().file(storagePath);
  await file.save(buffer, {
    contentType: mediaType,
    // resumable:false — arquivos pequenos (tetos em lib/attachments/constraints.ts,
    // no máximo alguns MB), upload resumível só adiciona overhead de rede.
    resumable: false,
  });

  return {
    id: attachmentId,
    filename,
    mediaType,
    size: buffer.byteLength,
    // Caminho pro proxy autenticado — NUNCA uma URL direta do bucket, que
    // fica privado (ver storage.rules na raiz do projeto). O segmento final
    // precisa bater exatamente com `storageFilename` acima: é assim que
    // app/api/attachments/.../[attachmentFile]/route.ts reconstrói o
    // `storagePath` pra buscar o arquivo certo no bucket.
    url: `/api/attachments/${uid}/${threadId}/${messageId}/${encodeURIComponent(storageFilename)}`,
  };
}
