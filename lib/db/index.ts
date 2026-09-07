import type { ConversationStore } from "./types";
import { memoryStore } from "./memory-store";

export type { ConversationStore, StoredMessage } from "./types";

let cached: Promise<ConversationStore> | null = null;

/**
 * Mesmo padrão de `getModel()` em lib/llm/provider.ts: um switch central
 * baseado em env var, isolando qual backend está ativo. Troque
 * `DB_PROVIDER=firebase` (e implemente lib/db/firebase-store.ts) quando o
 * projeto Firebase estiver pronto — nada fora deste arquivo precisa mudar.
 *
 * É async (e o import do backend "firebase" é dinâmico) de propósito: assim
 * o projeto continua buildando sem `firebase-admin` instalado enquanto
 * ninguém escolher esse provider — só toca nesse módulo se for usado.
 */
async function createStore(): Promise<ConversationStore> {
  // "||" e não "??" de propósito — mesmo motivo do provider.ts: uma env var
  // criada em branco no painel da Vercel chega como "", não como undefined.
  const provider = process.env.DB_PROVIDER || "memory";

  switch (provider) {
    case "memory":
      return memoryStore;
    case "firebase": {
      const { FirebaseConversationStore } = await import("./firebase-store");
      return new FirebaseConversationStore();
    }
    default:
      throw new Error(`DB_PROVIDER="${provider}" não implementado em lib/db/index.ts`);
  }
}

export function getStore(): Promise<ConversationStore> {
  if (!cached) cached = createStore();
  return cached;
}
