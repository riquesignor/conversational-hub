/**
 * Formata a saída de uma tool numa linha curta pra UI (app/page.tsx).
 *
 * Fica separado da definição de cada tool de propósito: a tool em si
 * (lib/skills/*.ts) roda no servidor e retorna dados estruturados; isso
 * aqui é puramente apresentação e roda no cliente. Uma tool nova que não
 * tiver um `case` aqui ainda funciona — cai no fallback JSON — então
 * adicionar uma habilidade nunca quebra a UI, só fica menos bonita até
 * alguém adicionar um case dedicado.
 */
export function renderToolSummary(toolName: string, output: unknown): string {
  if (output && typeof output === "object" && "error" in output) {
    const error = (output as { error?: unknown }).error;
    if (error) return String(error);
  }

  switch (toolName) {
    case "get_datetime": {
      const o = output as { formatted?: string };
      return o.formatted ?? "—";
    }
    case "calculate": {
      const o = output as { result?: number };
      return typeof o.result === "number" ? `= ${o.result}` : "—";
    }
    case "lookup_pokemon": {
      const o = output as {
        name?: string;
        types?: string[];
        heightMeters?: number;
        weightKg?: number;
      };
      if (!o.name) return "—";
      const name = o.name.charAt(0).toUpperCase() + o.name.slice(1);
      const types = o.types?.join(", ") ?? "";
      return `${name} — ${types} · ${o.heightMeters}m · ${o.weightKg}kg`;
    }
    case "lookup_cep": {
      const o = output as {
        cep?: string;
        logradouro?: string;
        bairro?: string;
        cidade?: string;
        uf?: string;
      };
      if (!o.cep) return "—";
      const local = [o.logradouro, o.bairro, o.cidade && o.uf ? `${o.cidade}/${o.uf}` : o.cidade]
        .filter(Boolean)
        .join(", ");
      return `${o.cep} — ${local}`;
    }
    case "list_skills": {
      const o = output as { skills?: { title: string }[] };
      return o.skills?.map((s) => s.title).join(" · ") ?? "—";
    }
    default:
      try {
        return JSON.stringify(output);
      } catch {
        return String(output);
      }
  }
}
