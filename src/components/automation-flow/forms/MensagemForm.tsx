"use client";

import { useRef } from "react";

import type { CanalMensagem, FlowNode } from "@/lib/automation-flow/types";
import { VariavelDropdown } from "./VariavelDropdown";
import { inserirTokenNoTexto } from "./variaveis";

const CANAIS: { valor: CanalMensagem; label: string }[] = [
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "instagram", label: "Instagram" },
  { valor: "tiktok", label: "TikTok" },
  { valor: "email", label: "E-mail" },
  { valor: "interno", label: "Interno" },
];

/**
 * Formulário genérico pra todos os tipos de "mensagem" que não ramificam
 * (mensagem_botoes/mensagem_lista têm form próprio, ver `MensagemOpcoesForm`)
 * — os campos que aparecem dependem de quais chaves existem em `node.data`.
 */
export function MensagemForm({ node, onChange }: { node: FlowNode; onChange: (data: Record<string, unknown>) => void }) {
  const d = node.data as Record<string, unknown>;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function set(patch: Record<string, unknown>) {
    onChange({ ...d, ...patch });
  }

  function inserirVariavel(chave: string, token: string) {
    const atual = typeof d[chave] === "string" ? (d[chave] as string) : "";
    set({ [chave]: inserirTokenNoTexto(atual, token, textareaRef.current) });
  }

  const temCanal = "canal" in d;
  const temTexto = "texto" in d;
  const temMensagem = "mensagem" in d;
  const temAssunto = "assunto" in d;
  const temCorpo = "corpo" in d;
  const temArquivo = "arquivoNome" in d;
  const temLegenda = "legenda" in d;
  const temNomeContato = "nomeContato" in d;
  const temTelefone = "telefone" in d;
  const temEndereco = "endereco" in d;
  const temTemplateId = "templateId" in d;
  const temParaEquipe = "paraEquipe" in d;
  const temFormularioOrigem = "formularioOrigem" in d;

  return (
    <div className="flow-form">
      {temCanal ? (
        <div className="field">
          <label>Canal</label>
          <select className="input" value={String(d.canal ?? "whatsapp")} onChange={(e) => set({ canal: e.target.value })}>
            {CANAIS.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {temFormularioOrigem ? (
        <div className="field">
          <label>Origem do formulário</label>
          <select
            className="input"
            value={String(d.formularioOrigem ?? "interno")}
            onChange={(e) => set({ formularioOrigem: e.target.value })}
          >
            <option value="interno">Formulário interno do CRM</option>
            <option value="externo">Link externo</option>
          </select>
          {d.formularioOrigem === "externo" ? (
            <input
              className="input mt8"
              placeholder="https://…"
              value={String(d.formularioUrlExterna ?? "")}
              onChange={(e) => set({ formularioUrlExterna: e.target.value })}
            />
          ) : (
            <input
              className="input mt8"
              placeholder="ID do formulário interno"
              value={String(d.formularioId ?? "")}
              onChange={(e) => set({ formularioId: e.target.value })}
            />
          )}
        </div>
      ) : null}

      {temTemplateId ? (
        <div className="field">
          <label>Modelo aprovado</label>
          <input
            className="input"
            placeholder="ID do modelo no WhatsApp Business"
            value={String(d.templateId ?? "")}
            onChange={(e) => set({ templateId: e.target.value })}
          />
        </div>
      ) : null}

      {temNomeContato ? (
        <div className="field">
          <label>Nome do contato</label>
          <input className="input" value={String(d.nomeContato ?? "")} onChange={(e) => set({ nomeContato: e.target.value })} />
        </div>
      ) : null}
      {temTelefone ? (
        <div className="field">
          <label>Telefone</label>
          <input className="input" value={String(d.telefone ?? "")} onChange={(e) => set({ telefone: e.target.value })} />
        </div>
      ) : null}
      {temEndereco ? (
        <div className="field">
          <label>Endereço</label>
          <input className="input" value={String(d.endereco ?? "")} onChange={(e) => set({ endereco: e.target.value })} />
        </div>
      ) : null}

      {temArquivo ? (
        <div className="field">
          <label>Arquivo</label>
          <input
            className="input"
            placeholder="Nome do arquivo (upload não simulado nesse editor)"
            value={String(d.arquivoNome ?? "")}
            onChange={(e) => set({ arquivoNome: e.target.value })}
          />
        </div>
      ) : null}

      {temParaEquipe ? (
        <div className="field">
          <label>Para a equipe</label>
          <input className="input" value={String(d.paraEquipe ?? "")} onChange={(e) => set({ paraEquipe: e.target.value })} />
        </div>
      ) : null}

      {temAssunto ? (
        <div className="field">
          <label>Assunto</label>
          <input className="input" value={String(d.assunto ?? "")} onChange={(e) => set({ assunto: e.target.value })} />
        </div>
      ) : null}

      {temTexto || temCorpo || temLegenda || temMensagem ? (
        <div className="field">
          <div className="flow-form-label-row">
            <label style={{ marginBottom: 0 }}>
              {temCorpo ? "Corpo do e-mail" : temLegenda ? "Legenda" : temMensagem ? "Mensagem" : "Texto"}
            </label>
            <VariavelDropdown onEscolher={(t) => inserirVariavel(temCorpo ? "corpo" : temLegenda ? "legenda" : temMensagem ? "mensagem" : "texto", t)} />
          </div>
          <textarea
            ref={textareaRef}
            className="input"
            style={{ width: "100%", minHeight: 90, resize: "vertical" }}
            value={String(d[temCorpo ? "corpo" : temLegenda ? "legenda" : temMensagem ? "mensagem" : "texto"] ?? "")}
            onChange={(e) =>
              set({ [temCorpo ? "corpo" : temLegenda ? "legenda" : temMensagem ? "mensagem" : "texto"]: e.target.value })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
