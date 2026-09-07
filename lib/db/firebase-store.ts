import type { ConversationStore, StoredMessage } from "./types";

/**
 * Esqueleto pronto pra plugar Firestore quando as credenciais existirem.
 * Hoje NÃO está implementado de propósito — não faz sentido adicionar a
 * dependência `firebase-admin` (nem exigir env vars) antes de haver um
 * projeto Firebase real. Fica aqui só a forma exata que o backend precisa
 * ter pra satisfazer `ConversationStore`.
 *
 * Passo a passo pra ativar quando o projeto Firebase existir:
 *
 *   1. `npm install firebase-admin`
 *   2. Criar um projeto no Firebase Console e gerar uma service account
 *      (Project Settings → Service Accounts → Generate new private key).
 *   3. Definir no .env / Vercel:
 *        FIREBASE_PROJECT_ID=...
 *        FIREBASE_CLIENT_EMAIL=...
 *        FIREBASE_PRIVATE_KEY="...\n..."   (mantém os \n literais, ver nota abaixo)
 *   4. Descomentar o corpo desta classe.
 *   5. Trocar `DB_PROVIDER=firebase` no ambiente (ver lib/db/index.ts) —
 *      nenhum outro arquivo do projeto precisa mudar.
 *
 * Nota sobre FIREBASE_PRIVATE_KEY: painéis como o da Vercel costumam
 * escapar quebras de linha como "\n" literal na string da env var — por
 * isso o `.replace(/\\n/g, "\n")` no construtor comentado abaixo.
 */
export class FirebaseConversationStore implements ConversationStore {
  constructor() {
    throw new Error(
      "FirebaseConversationStore ainda não está implementado. " +
        "Veja o comentário no topo de lib/db/firebase-store.ts para o passo a passo, " +
        "ou use DB_PROVIDER=memory (padrão) enquanto isso.",
    );
  }

  async appendMessage(_sessionId: string, _message: StoredMessage): Promise<void> {
    throw new Error("not implemented");
  }

  async getMessages(_sessionId: string): Promise<StoredMessage[]> {
    throw new Error("not implemented");
  }

  async clearSession(_sessionId: string): Promise<void> {
    throw new Error("not implemented");
  }
}

/*
// Implementação de referência — descomente após o passo 1-3 acima.
//
// import { cert, getApps, initializeApp } from "firebase-admin/app";
// import { getFirestore, type Firestore } from "firebase-admin/firestore";
//
// function getFirestoreApp(): Firestore {
//   if (getApps().length === 0) {
//     initializeApp({
//       credential: cert({
//         projectId: process.env.FIREBASE_PROJECT_ID,
//         clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//         privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
//       }),
//     });
//   }
//   return getFirestore();
// }
//
// export class FirebaseConversationStore implements ConversationStore {
//   private db = getFirestoreApp();
//
//   async appendMessage(sessionId: string, message: StoredMessage): Promise<void> {
//     await this.db
//       .collection("sessions")
//       .doc(sessionId)
//       .collection("messages")
//       .doc(message.id)
//       .set(message);
//   }
//
//   async getMessages(sessionId: string): Promise<StoredMessage[]> {
//     const snap = await this.db
//       .collection("sessions")
//       .doc(sessionId)
//       .collection("messages")
//       .orderBy("createdAt", "asc")
//       .get();
//     return snap.docs.map((d) => d.data() as StoredMessage);
//   }
//
//   async clearSession(sessionId: string): Promise<void> {
//     const col = this.db.collection("sessions").doc(sessionId).collection("messages");
//     const snap = await col.get();
//     await Promise.all(snap.docs.map((d) => d.ref.delete()));
//   }
// }
*/
