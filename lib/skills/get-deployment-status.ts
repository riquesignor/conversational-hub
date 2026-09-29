import { tool } from "ai";
import { z } from "zod";

// API REST da Vercel (https://vercel.com/docs/rest-api) — precisa de um
// token pessoal (gratuito, gerado em vercel.com/account/tokens), diferente
// das outras tools deste arquivo que não pedem cadastro nenhum. `projectId`
// aceita tanto o ID quanto o NOME do projeto, então basta o nome mesmo
// (ver VERCEL_PROJECT_ID abaixo). `teamId` só é necessário se o projeto
// estiver dentro de um time/organização na Vercel, não numa conta pessoal.
const VERCEL_DEPLOYMENTS_URL = "https://api.vercel.com/v7/deployments";

type ReadyState =
  | "BLOCKED"
  | "BUILDING"
  | "CANCELED"
  | "DELETED"
  | "ERROR"
  | "INITIALIZING"
  | "QUEUED"
  | "READY";

interface VercelDeployment {
  uid: string;
  url: string;
  readyState: ReadyState;
  target: "production" | "staging" | null;
  created: number;
  inspectorUrl: string | null;
  errorMessage?: string | null;
  meta?: { githubCommitMessage?: string; githubCommitSha?: string };
}

interface VercelDeploymentsResponse {
  deployments: VercelDeployment[];
}

export const getDeploymentStatusTool = tool({
  description:
    "Consulta o status do último deploy deste projeto na Vercel (em andamento, sucesso, " +
    "erro etc). Use quando o usuário perguntar sobre o estado do deploy/build em produção.",
  inputSchema: z.object({}),
  execute: async () => {
    const token = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;
    if (!token || !projectId) {
      return { error: "Consulta de deploy não configurada (VERCEL_TOKEN/VERCEL_PROJECT_ID ausentes)." };
    }

    const params = new URLSearchParams({
      projectId,
      target: "production",
      limit: "1",
    });
    if (process.env.VERCEL_TEAM_ID) {
      params.set("teamId", process.env.VERCEL_TEAM_ID);
    }

    try {
      const res = await fetch(`${VERCEL_DEPLOYMENTS_URL}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return { error: `API da Vercel respondeu com status ${res.status}.` };
      }

      const data = (await res.json()) as VercelDeploymentsResponse;
      const deployment = data.deployments?.[0];
      if (!deployment) {
        return { error: "Nenhum deploy de produção encontrado pra este projeto." };
      }

      return {
        state: deployment.readyState,
        url: deployment.url,
        deployedAt: new Date(deployment.created).toISOString(),
        commitMessage: deployment.meta?.githubCommitMessage,
        errorMessage: deployment.errorMessage ?? undefined,
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      return {
        error: timedOut
          ? "Consulta à Vercel demorou demais para responder."
          : "Falha ao consultar o status do deploy.",
      };
    }
  },
});
