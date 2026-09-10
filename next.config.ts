import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * firebase-admin (via google-auth-library -> jwks-rsa -> jose) mistura
   * CJS e ESM de um jeito que o bundler do Next (Turbopack, inclusive em
   * `next build` de produção) não resolve direito ao empacotar a função
   * serverless — dá "Error [ERR_REQUIRE_ESM]: require() of ES Module
   * .../jose/dist/webapi/index.js ... not supported" em runtime, só quando
   * o código realmente chama algo do Auth do Admin SDK (verifyIdToken/
   * createSessionCookie), por isso não aparecia em `next build` local nem
   * em `tsc` — só estourava numa requisição de verdade na Vercel.
   *
   * `serverExternalPackages` tira o pacote do bundling do Next: em vez de
   * reescrever os imports, a função serverless faz um require/import nativo
   * do Node direto de node_modules em runtime, que resolve os `exports`
   * condicionais do package.json de cada pacote corretamente.
   */
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
