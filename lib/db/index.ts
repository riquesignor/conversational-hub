import type { ConversationStore } from "./types";
import { FirebaseConversationStore } from "./firebase-store";

export type {
  ConversationStore,
  StoredMessage,
  ThreadMeta,
  StoredImage,
  StoredPdf,
} from "./types";

let cached: ConversationStore | null = null;

/**
 * Único backend de persistência do projeto: Firestore, via Admin SDK (ver
 * lib/firebase/admin.ts). Não existe mais um provider "memory" plugável —
 * desde que o login passou a ser obrigatório (ver proxy.ts e
 * lib/auth/session.ts), toda conversa já está amarrada a um uid real
 * emitido pelo Firebase Auth, e o próprio login já exige as credenciais do
 * Admin SDK configuradas. Não fazia mais sentido manter um branch de
 * persistência "funciona sem configurar nada": sem Firebase configurado,
 * ninguém consegue nem logar, então a rota de chat nunca seria alcançada.
 *
 * Segue síncrono (sem Promise) porque não há mais import dinâmico condicional
 * — `firebase-admin` agora é uma dependência obrigatória do projeto, não
 * opcional como antes.
 */
export function getStore(): ConversationStore {
  if (!cached) cached = new FirebaseConversationStore();
  return cached;
}
