import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * firebase-admin é um pacote Node-only pesado (crypto, gRPC, etc.) — tirar
   * ele do bundling do Next e deixar a função serverless fazer um require
   * nativo do Node direto de node_modules em runtime evita esse tipo de
   * pacote entrar na reescrita de módulos do bundler (Turbopack/webpack),
   * o que reduz o risco de problemas de resolução como o CJS/ESM descrito
   * em package.json (ver campo "overrides" -> "jose"). Não foi isto sozinho
   * que resolveu o crash "ERR_REQUIRE_ESM ... jose ... jwks-rsa" visto em
   * produção — a causa raiz e o fix de verdade estão no override do jose em
   * package.json — mas continua sendo boa prática manter pacotes Node-only
   * assim fora do bundle.
   */
  serverExternalPackages: ["firebase-admin"],

  /**
   * next/image só otimiza (redimensiona, converte pra WebP/AVIF, faz lazy
   * loading) imagens de domínios explicitamente liberados aqui — é uma
   * allowlist de propósito, pra não virar um proxy de imagem arbitrário.
   * Hoje só a foto de perfil do Google (login com Google, ver
   * components/chat/Sidebar.tsx) usa isso; login por e-mail/senha não tem
   * foto (cai no fallback com a inicial do nome).
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
