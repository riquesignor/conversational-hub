const WINDOW_MS = 60_000; // janela de 1 minuto
const MAX_REQUESTS = 10; // requisições por IP por janela

type Bucket = { count: number; resetAt: number };

/**
 * Rate limiter em memória (sliding window fixo, tipo token bucket simplificado).
 *
 * Limitação conhecida: o Map vive por instância de processo. Em deploy
 * serverless com múltiplas instâncias (Vercel sob carga) isso não é um
 * limite global rigoroso — cada instância tem seu próprio contador. Ainda
 * assim já barra abuso automatizado básico contra a chave de API, que é o
 * risco real num projeto de portfólio.
 *
 * Upgrade de produção: trocar este Map por Upstash Redis / @vercel/kv
 * mantendo a mesma assinatura de `checkRateLimit`.
 */
const buckets = new Map<string, Bucket>();

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS - bucket.count };
}
