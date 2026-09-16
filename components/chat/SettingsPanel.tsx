"use client";

import { useEffect, useState } from "react";
import { PERSONAS, type Persona } from "@/lib/personas";
import { BackIcon } from "./icons";

interface SettingsPanelProps {
  botName: string;
  persona: Persona;
  onBack: () => void;
}

interface StatusInfo {
  llmProvider: string;
  dbProvider: string;
}

export function SettingsPanel({ botName, persona, onBack }: SettingsPanelProps) {
  const [status, setStatus] = useState<StatusInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StatusInfo | null) => {
        if (!cancelled && data) setStatus(data);
      })
      .catch(() => {
        // Info não-crítica pra tela de config — se a chamada falhar, os
        // campos abaixo ficam em "carregando…" e não travam mais nada.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="flex flex-none items-center gap-3 border-b border-divider bg-bg-2 px-4 py-4 sm:px-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full border border-divider px-3.5 py-1.5 text-[13px] font-semibold text-text hover:bg-surface"
        >
          <BackIcon />
          Voltar
        </button>
        <span className="font-heading text-[17px]">Configurações</span>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        <section className="flex flex-col gap-2.5 py-4">
          <h3 className="font-heading m-0 text-[17px] font-normal">Sobre este assistente</h3>
          <div className="flex items-center gap-2.5">
            <span className="w-[150px] flex-none text-[12.5px] font-semibold text-muted">Nome</span>
            <span className="text-[13.5px]">{botName}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-[150px] flex-none text-[12.5px] font-semibold text-muted">
              Persona atual
            </span>
            <span className="text-[13.5px]">{persona.label}</span>
          </div>
          <p className="m-0 text-[12.5px] text-muted">{persona.tagline}</p>
        </section>

        <div className="h-px bg-divider" />

        <section className="flex flex-col gap-2.5 py-4">
          <h3 className="font-heading m-0 text-[17px] font-normal">Personas disponíveis</h3>
          <p className="m-0 text-[12.5px] text-muted">
            Troque o tom de resposta pelo seletor na barra de mensagem — dá pra trocar a
            qualquer momento, sem perder o histórico da conversa.
          </p>
          <div className="mt-1 flex flex-col gap-2">
            {PERSONAS.map((p) => (
              <div key={p.id} className="flex flex-col gap-0.5 border-l border-divider py-1 pl-3">
                <span className="text-[13px] font-semibold">{p.label}</span>
                <span className="text-[11.5px] text-muted">{p.tagline}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-divider" />

        <section className="flex flex-col gap-2.5 py-4">
          <h3 className="font-heading m-0 text-[17px] font-normal">Backend ativo</h3>
          <div className="flex items-center gap-2.5">
            <span className="w-[150px] flex-none text-[12.5px] font-semibold text-muted">
              Provider de LLM
            </span>
            <span className="text-[13.5px]">{status?.llmProvider ?? "carregando…"}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-[150px] flex-none text-[12.5px] font-semibold text-muted">
              Persistência
            </span>
            <span className="text-[13.5px]">{status?.dbProvider ?? "carregando…"}</span>
          </div>
        </section>
      </div>
    </>
  );
}
