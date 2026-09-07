import { tool } from "ai";
import { z } from "zod";

// Endpoint público, sem chave — ViaCEP, serviço gratuito e amplamente usado
// pra consulta de CEP no Brasil. Mesma categoria de API livre já usada em
// lookup-pokemon.ts (PokéAPI): "zero custo, zero cadastro".
const VIACEP_BASE = "https://viacep.com.br/ws";

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ddd: string;
  // ViaCEP não usa status HTTP 404 pra "não encontrado" — devolve 200 com
  // `{ erro: true }` no corpo. Por isso o tratamento abaixo checa esse campo
  // em vez de só `res.ok` (diferente do padrão em lookup-pokemon.ts).
  erro?: boolean;
}

function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export const lookupCepTool = tool({
  description:
    "Busca um endereço brasileiro a partir de um CEP (rua, bairro, cidade, " +
    "UF e DDD) usando a API pública ViaCEP. Use quando o usuário informar um " +
    "CEP e quiser saber o endereço correspondente.",
  inputSchema: z.object({
    cep: z
      .string()
      .describe('CEP brasileiro, com ou sem hífen, ex: "01310-100" ou "01310100"'),
  }),
  execute: async ({ cep }) => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) {
      return { error: `CEP inválido: "${cep}". Um CEP brasileiro tem 8 dígitos.` };
    }

    try {
      const res = await fetch(`${VIACEP_BASE}/${digits}/json/`, {
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        return { error: `ViaCEP respondeu com status ${res.status}.` };
      }

      const data = (await res.json()) as ViaCepResponse;
      if (data.erro) {
        return { error: `Nenhum endereço encontrado para o CEP "${cep}".` };
      }

      return {
        cep: data.cep,
        logradouro: data.logradouro || undefined,
        bairro: data.bairro || undefined,
        cidade: data.localidade,
        uf: data.uf,
        ddd: data.ddd || undefined,
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      return {
        error: timedOut
          ? "ViaCEP demorou demais para responder."
          : "Falha ao consultar a ViaCEP.",
      };
    }
  },
});
