import { adminDb } from "@/lib/firebase/admin";
import type {
  ConversationStore,
  StoredMessage,
  ThreadMeta,
  StoredImage,
  StoredPdf,
} from "./types";

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

  async getMessages(uid: string, threadId: string): Promise<StoredMessage[]> {
    const snap = await this.messagesCol(uid, threadId).orderBy("createdAt", "asc").get();
    return snap.docs.map((d) => d.data() as StoredMessage);
  }

  async clearThread(uid: string, threadId: string): Promise<void> {
    const snap = await this.messagesCol(uid, threadId).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
    await this.threadsCol(uid).doc(threadId).delete();
  }

  async listThreads(uid: string): Promise<ThreadMeta[]> {
    const snap = await this.threadsCol(uid).orderBy("updatedAt", "desc").get();
    return snap.docs.map((d) => d.data() as ThreadMeta);
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
