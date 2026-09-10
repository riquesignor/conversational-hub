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
};

export default nextConfig;
