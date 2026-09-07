import type { ConversationStore, StoredMessage } from "./types";

/**
 * Implementação padrão: histórico em memória, por instância de processo.
 *
 * Mesma limitação de `lib/rate-limit.ts` — não é compartilhado entre
 * instâncias serverless, e some no cold start/redeploy. É suficiente pra um
 * portfólio (não é dado crítico) e não exige nenhuma credencial pra rodar.
 * Serve de fallback também: se `DB_PROVIDER` apontar pra um backend ainda
 * não configurado, dá pra cair aqui em vez de derrubar a request.
 */
class MemoryConversationStore implements ConversationStore {
  private sessions = new Map<string, StoredMessage[]>();

  async appendMessage(sessionId: string, message: StoredMessage): Promise<void> {
    const history = this.sessions.get(sessionId) ?? [];
    history.push(message);
    this.sessions.set(sessionId, history);
  }

  async getMessages(sessionId: string): Promise<StoredMessage[]> {
    return this.sessions.get(sessionId) ?? [];
  }

  async clearSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

// Singleton em nível de módulo — sobrevive entre requests na mesma instância
// (mas não entre instâncias/cold starts, como no comentário acima).
export const memoryStore: ConversationStore = new MemoryConversationStore();
