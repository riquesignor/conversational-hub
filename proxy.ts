import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/**
 * Gate de UX, não de segurança: só checa se o cookie de sessão EXISTE, pra
 * não deixar piscar a tela de chat antes de redirecionar um visitante
 * deslogado pro /login. A verificação de verdade (assinatura do cookie via
 * Admin SDK) acontece nas rotas /api/* (ver lib/auth/session.ts) — o Edge
 * runtime em que o proxy roda não executa o Admin SDK (precisa de Node
 * crypto), então não dá pra validar o cookie de verdade aqui.
 *
 * /login e /api/* passam direto: a página de login não pode exigir sessão
 * (senão ninguém entraria), e cada rota de API já se protege sozinha.
 *
 * Renomeado de middleware.ts -> proxy.ts (e a função middleware() -> proxy())
 * seguindo a migração do Next 16 — "middleware" ficou deprecated em favor de
 * "proxy" (mesmo comportamento, nome novo). Ver:
 * https://nextjs.org/docs/messages/middleware-to-proxy
 *
 * Além do gate de sessão, este arquivo agora também é o único lugar do
 * projeto por onde passa toda requisição (exceto os caminhos excluídos no
 * `matcher` abaixo) — por isso é aqui que os headers de segurança da
 * aplicação inteira são setados, incluindo uma CSP com nonce por request
 * (padrão oficial do Next.js — ver
 * https://nextjs.org/docs/app/guides/content-security-policy). O nonce vai
 * tanto no header da REQUEST (`x-nonce`, pra Server Components lerem via
 * `headers()` se precisarem) quanto no header `Content-Security-Policy` —
 * o Next detecta o nonce presente nesse header já na hora de renderizar e
 * aplica sozinho em todo <script> que ele mesmo injeta (hydration/
 * streaming), sem precisar passar `nonce={...}` manualmente em cada
 * componente.
 */
function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    // 'strict-dynamic' + nonce é o padrão "CSP estrita" recomendado pelo
    // Next: scripts com o nonce certo podem carregar outros scripts (ex.:
    // chunks do bundler) sem precisar listar cada origem manualmente.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // 'unsafe-inline' só pro style (não pro script): cobre `style={{...}}`
    // inline do React/Tailwind, que CSP nenhuma versão de nonce consegue
    // liberar (é uma limitação conhecida da spec — nonce em style-src só
    // cobre <style>/<link>, não o atributo `style=""`). Risco bem menor que
    // liberar script inline, e sem isso a UI quebraria visualmente.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    // data: pra preview de anexo (base64) antes de enviar; googleusercontent
    // pra foto de perfil do Google (ver remotePatterns em next.config.ts).
    `img-src 'self' data: https://*.googleusercontent.com`,
    // Firebase Auth (signInWithPopup/signInWithEmailAndPassword em
    // app/login/page.tsx) chama essas duas origens direto do navegador.
    `connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    // Sem 'frame-src' explícito: cai no default-src 'self', bloqueando
    // qualquer iframe de terceiro (o app não usa iframe nenhum — o login
    // com Google é popup via window.open, que é um browsing context
    // separado e não é restringido pela CSP da página principal).
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

function applySecurityHeaders(res: NextResponse, csp: string): NextResponse {
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  // Redundante com frame-ancestors 'none' da CSP acima, mas X-Frame-Options
  // ainda vale a pena manter pra navegadores antigos que não leem CSP.
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // HSTS só faz sentido servido por HTTPS (produção, na Vercel) — inofensivo
  // em dev (HTTP local simplesmente ignora o header).
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  if (pathname.startsWith("/api") || pathname.startsWith("/login")) {
    return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp);
  }

  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSession) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/login", req.url)), csp);
  }

  return applySecurityHeaders(NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
