export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
}

/** Metadados de uma conversa (thread) — o que a sidebar precisa pra listar,
 * sem carregar o histórico inteiro de mensagens. */
export interface ThreadMeta {
  id: string;
  title: string;
  personaId?: string;
  /** Prévia da última mensagem (qualquer papel) — pro rótulo na sidebar. */
  lastMessagePreview?: string;
  createdAt: number;
  updatedAt: number;
}

/** Reservado pra quando o bot gerar imagens de verdade (ver README) — o
 * tipo e a coleção já existem, mas nada no projeto grava aqui ainda. */
export interface StoredImage {
  id: string;
  prompt: string;
  storagePath: string;
  url: string | null;
  createdAt: number;
}

/** Idem StoredImage, pra PDFs gerados. */
export interface StoredPdf {
  id: string;
  title: string;
  storagePath: string;
  url: string | null;
  createdAt: number;
}

/**
 * Contrato de persistência. Todo método recebe `uid` — nunca um "sessionId"
 * genérico como antes: cada usuário autenticado (Firebase Auth) é a raiz de
 * todo dado dele (ver lib/db/firebase-store.ts para o desenho exato do
 * schema Firestore). O resto do app só conhece esta interface, nunca o
 * backend concreto por trás dela.
 */
export interface ConversationStore {
  appendMessage(uid: string, threadId: string, message: StoredMessage): Promise<void>;
  getMessages(uid: string, threadId: string): Promise<StoredMessage[]>;
  clearThread(uid: string, threadId: string): Promise<void>;

  /** Todas as conversas do usuário, mais recente primeiro — alimenta a sidebar. */
  listThreads(uid: string): Promise<ThreadMeta[]>;

  /**
   * Cria a thread se ainda não existir (usando `patch.title` como título
   * inicial) ou só atualiza `updatedAt`/`personaId`/`lastMessagePreview` se
   * já existir. `patch.title` é IGNORADO nessa segunda chamada de propósito
   * — não existe "renomear conversa" ainda, então nunca sobrescreve um
   * título já definido a partir da primeira mensagem.
   */
  touchThread(
    uid: string,
    threadId: string,
    patch: Partial<Omit<ThreadMeta, "id" | "createdAt" | "updatedAt">>,
  ): Promise<void>;

  listImages(uid: string): Promise<StoredImage[]>;
  saveImage(uid: string, image: StoredImage): Promise<void>;

  listPdfs(uid: string): Promise<StoredPdf[]>;
  savePdf(uid: string, pdf: StoredPdf): Promise<void>;
}
