import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Bucket } from "@google-cloud/storage";

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

/**
 * Bucket do Firebase Storage — usado só por lib/storage/attachments.ts, pro
 * upload dos anexos de imagem/PDF/texto (ver README, seção "Anexos").
 *
 * Reaproveita NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (a mesma env var que o SDK
 * client já usa em lib/firebase/client.ts) em vez de pedir uma nova: o nome
 * do bucket não é segredo — quem protege os arquivos é o bucket ser privado
 * por padrão (Storage Rules, ver storage.rules) + todo acesso passar por
 * app/api/attachments/.../route.ts, nunca o cliente lendo o bucket direto
 * (mesmo desenho de lib/db/firebase-store.ts pro Firestore).
 */
export function adminStorage(): Bucket {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET não configurado — necessário pra " +
        "anexos (Firebase Storage). Ver .env.example.",
    );
  }
  return getStorage(getAdminApp()).bucket(bucketName);
}
