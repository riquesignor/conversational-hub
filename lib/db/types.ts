export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
}

/**
 * Contrato de persistência de conversas. Qualquer backend (memória, Firestore,
 * Postgres, etc.) implementa essa interface — o resto do app (route.ts) só
 * conhece isso, nunca o backend concreto. Mesmo padrão de `getModel()` em
 * lib/llm/provider.ts: trocar o backend é trocar o retorno de `getStore()`,
 * não reescrever quem chama.
 */
export interface ConversationStore {
  /** Acrescenta uma mensagem ao histórico de uma sessão. */
  appendMessage(sessionId: string, message: StoredMessage): Promise<void>;

  /** Histórico completo de uma sessão, em ordem cronológica. */
  getMessages(sessionId: string): Promise<StoredMessage[]>;

  /** Apaga o histórico de uma sessão (ex.: usuário limpou a conversa). */
  clearSession(sessionId: string): Promise<void>;
}
