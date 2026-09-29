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
 * aplicação inteira são setados, incluindo uma CSP.
 *
 * ATENÇÃO — histórico: a primeira versão disto usava nonce por request +
 * 'strict-dynamic' em script-src, seguindo o padrão documentado em
 * https://nextjs.org/docs/app/guides/content-security-policy. Em produção
 * (Next 16.3.4) o Next NÃO aplicou o nonce sozinho nos scripts que ele
 * mesmo injeta (hydration payload / chunks) — o navegador bloqueou tudo,
 * inclusive script inline, e a página não hidratava. Reduzido pra
 * `'unsafe-inline'` (mais permissivo, mas testado/funcionando de verdade)
 * até investigar por que o auto-nonce não funcionou nessa versão. Ver
 * commit que reverteu isso pra contexto completo.
 */
function buildCsp(): string {
  return [
    `default-src 'self'`,
    // 'unsafe-inline' aqui é uma escolha consciente, não um descuido: a
    // versão com nonce quebrou a hidratação em produção (ver comentário
    // acima). Sem nenhum vetor de XSS conhecido neste projeto (sem
    // dangerouslySetInnerHTML, sem eval, sem lib de markdown — conteúdo do
    // LLM sempre passa por interpolação JSX normal, que o React escapa
    // sozinho), a perda de proteção é pequena; o resto da CSP (bloqueio de
    // script de origem externa, frame-ancestors, etc.) continua valendo.
    `script-src 'self' 'unsafe-inline'`,
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
  const csp = buildCsp();

  if (pathname.startsWith("/api") || pathname.startsWith("/login")) {
    return applySecurityHeaders(NextResponse.next(), csp);
  }

  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSession) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/login", req.url)), csp);
  }

  return applySecurityHeaders(NextResponse.next(), csp);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
