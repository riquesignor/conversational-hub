import { adminDb } from "@/lib/firebase/admin";
import type {
  ConversationStore,
  Page,
  PageOptions,
  StoredMessage,
  ThreadMeta,
  StoredImage,
  StoredPdf,
} from "./types";

// Nenhuma leitura de coleção neste arquivo acontece sem `.limit()` — sem
// isso, listThreads/getMessages cresceriam sem teto conforme o uso real do
// usuário cresce (mais lento a cada load E mais caro, já que o Firestore
// cobra por documento lido). Cursor é o valor bruto do campo de orderBy
// (updatedAt/createdAt) codificado como string — ver encodeCursor/
// decodeCursor. Sem um tiebreaker (ex.: id do doc) no orderBy, dois
// documentos com o EXATO mesmo timestamp no limite de uma página podem, em
// tese, pular ou duplicar na borda — aceito de propósito: evita precisar de
// um índice composto no Firestore (que exigiria configuração manual extra
// no console) pra um caso-limite raro (dois docs no mesmo milissegundo).
const DEFAULT_THREADS_PAGE_SIZE = 30;
const MAX_THREADS_PAGE_SIZE = 100;
const DEFAULT_MESSAGES_PAGE_SIZE = 50;
const MAX_MESSAGES_PAGE_SIZE = 200;
// Teto de operações por WriteBatch do Admin SDK é 500 — 400 deixa margem.
const CLEAR_THREAD_BATCH_SIZE = 400;

function clampLimit(requested: number | undefined, fallback: number, max: number): number {
  if (requested === undefined || !Number.isFinite(requested) || requested <= 0) return fallback;
  return Math.min(Math.floor(requested), max);
}

function encodeCursor(value: number): string {
  return String(value);
}

function decodeCursor(cursor: string): number {
  const value = Number(cursor);
  if (!Number.isFinite(value)) {
    throw new Error(`Cursor de paginação inválido: "${cursor}".`);
  }
  return value;
}

/**
 * Schema Firestore — um documento raiz por usuário, e tudo mais pendurado
 * embaixo dele como subcoleção (nada de coleção solta no topo tipo
 * "sessions", que misturava thread de gente diferente no mesmo namespace):
 *
 *   users/{uid}                                  { email, displayName, photoURL, createdAt, lastLoginAt }
 *     users/{uid}/threads/{threadId}              ThreadMeta
 *       users/{uid}/threads/{threadId}/messages/{id}  StoredMessage
 *     users/{uid}/images/{id}                     StoredImage  (reservado, ver README)
 *     users/{uid}/pdfs/{id}                        StoredPdf   (reservado, ver README)
 *
 * O doc users/{uid} em si é escrito por app/api/auth/session/route.ts no
 * momento do login (upsert) — este arquivo só lê/escreve o que fica abaixo
 * dele. firestore.rules (raiz do projeto) espelha esse mesmo desenho:
 * cada usuário só enxerga a própria subárvore.
 */
export class FirebaseConversationStore implements ConversationStore {
  private userDoc(uid: string) {
    return adminDb().collection("users").doc(uid);
  }

  private threadsCol(uid: string) {
    return this.userDoc(uid).collection("threads");
  }

  private messagesCol(uid: string, threadId: string) {
    return this.threadsCol(uid).doc(threadId).collection("messages");
  }

  async appendMessage(uid: string, threadId: string, message: StoredMessage): Promise<void> {
    await this.messagesCol(uid, threadId).doc(message.id).set(message);
  }

  async getMessages(
    uid: string,
    threadId: string,
    opts: PageOptions = {},
  ): Promise<Page<StoredMessage>> {
    const limit = clampLimit(opts.limit, DEFAULT_MESSAGES_PAGE_SIZE, MAX_MESSAGES_PAGE_SIZE);

    // Busca da mais NOVA pra mais antiga (startAfter encadeia certo pro caso
    // de uso real: "carregar mensagens anteriores" ao rolar pra cima) — pede
    // um item a mais só pra saber se existe próxima página, sem precisar de
    // uma segunda query count().
    let query = this.messagesCol(uid, threadId).orderBy("createdAt", "desc").limit(limit + 1);
    if (opts.cursor) {
      query = query.startAfter(decodeCursor(opts.cursor));
    }

    const snap = await query.get();
    const hasMore = snap.docs.length > limit;
    const page = snap.docs.slice(0, limit).map((d) => d.data() as StoredMessage);
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]!.createdAt) : null;

    // Devolve em ordem CRONOLÓGICA — quem consome (API route, depois a UI)
    // não deveria precisar inverter nada só porque a query internamente
    // buscou de trás pra frente.
    return { items: page.reverse(), nextCursor };
  }

  async clearThread(uid: string, threadId: string): Promise<void> {
    // Deleta em lotes, não tudo de uma vez com Promise.all solto — uma
    // conversa longa pode ter milhares de mensagens, e o WriteBatch do
    // Admin SDK tem teto de 500 operações; paginar a leitura também evita
    // puxar a cota de leitura inteira numa chamada só.
    let cursor: number | undefined;
    for (;;) {
      let query = this.messagesCol(uid, threadId)
        .orderBy("createdAt", "asc")
        .limit(CLEAR_THREAD_BATCH_SIZE);
      if (cursor !== undefined) query = query.startAfter(cursor);

      const snap = await query.get();
      if (snap.docs.length === 0) break;

      const batch = adminDb().batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();

      if (snap.docs.length < CLEAR_THREAD_BATCH_SIZE) break;
      cursor = (snap.docs[snap.docs.length - 1]!.data() as StoredMessage).createdAt;
    }

    await this.threadsCol(uid).doc(threadId).delete();
  }

  async listThreads(uid: string, opts: PageOptions = {}): Promise<Page<ThreadMeta>> {
    const limit = clampLimit(opts.limit, DEFAULT_THREADS_PAGE_SIZE, MAX_THREADS_PAGE_SIZE);

    let query = this.threadsCol(uid).orderBy("updatedAt", "desc").limit(limit + 1);
    if (opts.cursor) {
      query = query.startAfter(decodeCursor(opts.cursor));
    }

    const snap = await query.get();
    const hasMore = snap.docs.length > limit;
    const items = snap.docs.slice(0, limit).map((d) => d.data() as ThreadMeta);
    const nextCursor = hasMore ? encodeCursor(items[items.length - 1]!.updatedAt) : null;

    return { items, nextCursor };
  }

  async touchThread(
    uid: string,
    threadId: string,
    patch: Partial<Omit<ThreadMeta, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void> {
    const ref = this.threadsCol(uid).doc(threadId);
    const now = Date.now();
    const snap = await ref.get();

    if (!snap.exists) {
      // Constrói o objeto sem chaves com valor `undefined` — o SDK do
      // Firestore rejeita `undefined` em campo nenhum (precisa omitir a
      // chave, não setá-la como undefined), e `patch.personaId` /
      // `patch.lastMessagePreview` costumam vir ausentes na primeira
      // mensagem de uma conversa nova.
      const meta: ThreadMeta = {
        id: threadId,
        title: patch.title || "Nova conversa",
        createdAt: now,
        updatedAt: now,
        ...(patch.personaId !== undefined ? { personaId: patch.personaId } : {}),
        ...(patch.lastMessagePreview !== undefined
          ? { lastMessagePreview: patch.lastMessagePreview }
          : {}),
      };
      await ref.set(meta);
      return;
    }

    // `title` fica de fora do merge de propósito — ver doc do método na
    // interface (lib/db/types.ts): só a criação define o título.
    const rest = { ...patch };
    delete rest.title;
    await ref.set({ ...rest, updatedAt: now }, { merge: true });
  }

  async listImages(uid: string): Promise<StoredImage[]> {
    const snap = await this.userDoc(uid).collection("images").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as StoredImage);
  }

  async saveImage(uid: string, image: StoredImage): Promise<void> {
    await this.userDoc(uid).collection("images").doc(image.id).set(image);
  }

  async listPdfs(uid: string): Promise<StoredPdf[]> {
    const snap = await this.userDoc(uid).collection("pdfs").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => d.data() as StoredPdf);
  }

  async savePdf(uid: string, pdf: StoredPdf): Promise<void> {
    await this.userDoc(uid).collection("pdfs").doc(pdf.id).set(pdf);
  }
}
