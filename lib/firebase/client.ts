import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

/**
 * SDK cliente do Firebase (roda no navegador). Homóloga a lib/firebase/admin.ts,
 * que é a versão server-only — nunca importe uma no lugar da outra.
 *
 * As env vars NEXT_PUBLIC_FIREBASE_* não são segredo (a config do Firebase
 * client é pública por design — quem protege os dados é o Firestore
 * Security Rules + o fato de este projeto nunca ler Firestore direto do
 * navegador, só via API routes com o Admin SDK). Ainda assim ficam de fora
 * do git (.env.local no .gitignore) só por higiene de configuração.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Guarda contra reinicialização: em dev, o Fast Refresh reexecuta este
// módulo várias vezes; initializeApp() lançaria "already exists" na segunda
// chamada se não checássemos getApps() primeiro.
function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

// getAuth() valida o apiKey NA HORA e lança (ex.: "auth/invalid-api-key") se
// ele estiver ausente ou inválido — por isso não pode rodar na avaliação do
// módulo (import), nem no corpo de render de um componente. Os dois casos
// executam durante `next build`: Client Components também são renderizados
// no servidor pra gerar o HTML inicial, e páginas sem dado dinâmico (como
// /login, ou a /_not-found automática do Next) são pré-renderizadas
// estaticamente no build — antes de qualquer env var do Firebase existir de
// verdade em produção, se ainda não tiver sido configurada na Vercel. Uma
// instância só é criada na PRIMEIRA chamada de getFirebaseAuth(), sempre
// disparada de dentro de um useEffect ou de um handler de evento (nunca do
// corpo de render) — ver lib/auth/use-auth.tsx e app/login/page.tsx. Mesmo
// espírito de lib/firebase/admin.ts: falha só quando usado, nunca só por
// existir no código.
let authInstance: Auth | null = null;
export function getFirebaseAuth(): Auth {
  if (!authInstance) authInstance = getAuth(getFirebaseApp());
  return authInstance;
}

export const googleProvider = new GoogleAuthProvider();
