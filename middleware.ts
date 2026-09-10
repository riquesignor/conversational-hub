import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/**
 * Gate de UX, não de segurança: só checa se o cookie de sessão EXISTE, pra
 * não deixar piscar a tela de chat antes de redirecionar um visitante
 * deslogado pro /login. A verificação de verdade (assinatura do cookie via
 * Admin SDK) acontece nas rotas /api/* (ver lib/auth/session.ts) — o Edge
 * runtime em que o middleware roda não executa o Admin SDK (precisa de
 * Node crypto), então não dá pra validar o cookie de verdade aqui.
 *
 * /login e /api/* passam direto: a página de login não pode exigir sessão
 * (senão ninguém entraria), e cada rota de API já se protege sozinha.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api") || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
