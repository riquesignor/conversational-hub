import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * SDK admin do Firebase (server-only — nunca importe isto de um Client
 * Component nem exponha FIREBASE_PRIVATE_KEY pro navegador).
 *
 * initializeApp()/cert() são lidos dentro das funções, não no topo do
 * módulo, de propósito: `cert()` lança imediatamente se as três env vars
 * abaixo não estiverem definidas ou a chave estiver malformada. Adiar pra
 * dentro da função significa que o módulo só falha quando alguém de fato
 * chama adminAuth()/adminDb() (login ou request na API), nunca só por ser
 * importado — mesmo padrão já usado em lib/llm/provider.ts.
 *
 * Login e persistência de conversas são obrigatórios neste projeto (ver
 * middleware.ts e README, seção "Autenticação e Firestore"), então essas
 * três env vars deixam de ser opcionais a partir deste ponto.
 */
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin não configurado. Defina FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY (ver .env.example e " +
        "README, seção 'Autenticação e Firestore').",
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // Painéis como o da Vercel escapam quebra de linha como "\n" literal
      // dentro do valor da env var — desfaz o escape antes de passar pro SDK.
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}
