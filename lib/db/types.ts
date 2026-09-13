/** Um anexo (imagem, PDF ou arquivo de texto) já persistido no Firebase
 * Storage — ver lib/storage/attachments.ts (upload) e
 * app/api/attachments/[uid]/[threadId]/[messageId]/[attachmentFile]/route.ts
 * (download autenticado). `url` é sempre o caminho pra esse proxy, NUNCA uma
 * URL direta do bucket (que fica privado — ver storage.rules na raiz). */
export interface StoredAttachment {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
  url: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  /** Anexos da mensagem (hoje só o usuário manda — ver app/api/chat/route.ts).
   * Ausente/undefined em toda mensagem sem anexo, nunca um array vazio (o
   * Firestore aceita omitir a chave, mas grava `[]` do mesmo jeito que
   * qualquer outro valor — melhor nem escrever o campo). */
  attachments?: StoredAttachment[];
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

/** Uma página de resultados paginados — `nextCursor` é opaco (não assumir
 * nada sobre o formato) e `null` quando não há mais páginas. Passar de volta
 * como `opts.cursor` na chamada seguinte pra pegar a próxima página. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageOptions {
  /** Default e teto definidos por cada implementação (ver
   * lib/db/firebase-store.ts) — nunca sem limite, de propósito: uma leitura
   * sem `.limit()` no Firestore cresce sem teto conforme o uso do usuário
   * cresce (mais lento E mais caro, já que o Firestore cobra por leitura de
   * documento). */
  limit?: number;
  cursor?: string | null;
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

  /** Página de mensagens, da mais recente pra mais antiga internamente, mas
   * devolvida em ORDEM CRONOLÓGICA (mais antiga primeiro) — pronta pra
   * renderizar direto na tela sem o caller precisar inverter nada.
   * `nextCursor` (quando não-null) busca a página seguinte de mensagens MAIS
   * ANTIGAS que a atual (scroll-up "carregar mensagens anteriores"). */
  getMessages(uid: string, threadId: string, opts?: PageOptions): Promise<Page<StoredMessage>>;

  clearThread(uid: string, threadId: string): Promise<void>;

  /** Conversas do usuário, mais recente primeiro (por `updatedAt`) — alimenta
   * a sidebar. `nextCursor` busca a página seguinte de conversas mais
   * antigas. */
  listThreads(uid: string, opts?: PageOptions): Promise<Page<ThreadMeta>>;

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
