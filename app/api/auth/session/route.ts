import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

// Máximo permitido pelo Admin SDK pra createSessionCookie é 2 semanas — ver
// node_modules/firebase-admin SessionCookieOptions.
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

/**
 * Troca um ID token do Firebase Auth (obtido no cliente via
 * signInWithPopup/signInWithEmailAndPassword — ver app/login/page.tsx) por
 * um cookie de sessão httpOnly. É essa troca que faz o app não depender de
 * guardar o ID token em localStorage/JS: o cookie não é legível por script
 * nenhum no navegador, o que fecha a superfície de roubo de sessão via XSS
 * que um token em localStorage teria.
 *
 * DIAGNÓSTICO TEMPORÁRIO (remover depois de resolver o 500 em produção):
 * as respostas de erro abaixo incluem um campo "detail" com a mensagem
 * crua do Admin SDK, só pra debug via aba Network do navegador. Normalmente
 * isso não deveria vazar pro cliente — depois que o login estiver
 * funcionando, tirar o campo "detail" das duas respostas de erro abaixo.
 */
export async function POST(req: Request) {
  const body: { idToken?: string } = await req.json().catch(() => ({}));
  const { idToken } = body;

  if (!idToken) {
    return Response.json({ error: "idToken ausente." }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch (err) {
    console.error("[api/auth/session] idToken inválido:", err);
    // TEMPORÁRIO — ver comentário no topo do arquivo. Remover "detail" antes
    // de fechar o diagnóstico.
    return Response.json(
      { error: "Token inválido ou expirado.", detail: err instanceof Error ? err.message : String(err) },
      { status: 401 },
    );
  }

  let sessionCookie: string;
  try {
    sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });
  } catch (err) {
    console.error("[api/auth/session] falha ao criar session cookie:", err);
    // TEMPORÁRIO — ver comentário no topo do arquivo. Remover "detail" antes
    // de fechar o diagnóstico.
    return Response.json(
      { error: "Falha ao criar sessão.", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // Upsert de users/{uid} — é aqui, e só aqui, que este documento raiz é
  // criado/atualizado (ver lib/db/firebase-store.ts pro que pendura embaixo
  // dele). `createdAt` só é gravado na primeira vez: lido antes de decidir,
  // pra não resetar a data de cadastro a cada novo login.
  try {
    const userRef = adminDb().collection("users").doc(decoded.uid);
    const snap = await userRef.get();
    const now = Date.now();
    await userRef.set(
      {
        email: decoded.email ?? null,
        displayName: (decoded.name as string | undefined) ?? null,
        photoURL: (decoded.picture as string | undefined) ?? null,
        lastLoginAt: now,
        ...(snap.exists ? {} : { createdAt: now }),
      },
      { merge: true },
    );
  } catch (err) {
    // Best-effort de propósito, mesmo padrão do resto do projeto (ver
    // app/api/chat/route.ts): falhar em gravar o perfil não pode impedir o
    // login de completar.
    console.error("[api/auth/session] falha ao gravar users/{uid}:", err);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return Response.json({ ok: true });
}
