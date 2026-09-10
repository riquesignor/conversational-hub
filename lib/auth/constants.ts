/**
 * Só a constante, sem nenhum outro import, de propósito: middleware.ts
 * precisa do nome do cookie mas roda no Edge runtime, que não suporta os
 * módulos Node-only que lib/auth/session.ts arrasta (firebase-admin usa
 * Node crypto/gRPC). Se middleware.ts importasse session.ts diretamente,
 * o bundler tentaria empacotar firebase-admin inteiro pro Edge e quebraria
 * o build. Este arquivo existe só pra cortar esse grafo de import.
 */
export const SESSION_COOKIE_NAME = "__session";
