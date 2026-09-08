"use client";

import { useRef } from "react";

import type { CanalMensagem, FlowNode } from "@/lib/automation-flow/types";
import { VariavelDropdown } from "./VariavelDropdown";
import { PreviaMensagem } from "@/components/automacoes/PreviaMensagem";
import { mapearVariaveis } from "@/lib/campanhas/variaveis";
import { inserirTokenNoTexto } from "./variaveis";
import { useFormularios } from "@/lib/formularios-context";

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
 *. Os campos que aparecem dependem de quais chaves existem em `node.data`.
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
  const temLegenda = "legenda" in d;
  const temNomeContato = "nomeContato" in d;
  const temTelefone = "telefone" in d;
  const temEndereco = "endereco" in d;
  const temTemplateId = "templateId" in d;
  const temParaEquipe = "paraEquipe" in d;
  const temFormularioOrigem = "formularioOrigem" in d;

  /** Qual chave guarda o texto neste bloco. Os campos mudam de nome conforme o tipo. */
  const chaveDoTexto = temCorpo ? "corpo" : temLegenda ? "legenda" : temMensagem ? "mensagem" : "texto";
  const textoDaMensagem = String(d[chaveDoTexto] ?? "");

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
            <EscolherFormulario
              formularioId={String(d.formularioId ?? "")}
              onEscolher={(id) => set({ formularioId: id })}
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
            <VariavelDropdown onEscolher={(t) => inserirVariavel(chaveDoTexto, t)} />
          </div>
          <textarea
            ref={textareaRef}
            className="input"
            style={{ width: "100%", minHeight: 90, resize: "vertical" }}
            value={textoDaMensagem}
            onChange={(e) => set({ [chaveDoTexto]: e.target.value })}
          />
        </div>
      ) : null}

      {textoDaMensagem.trim() ? (
        // A mesma prévia do editor de modelos e do resumo do disparo. Quem escreve a mensagem e
        // quem confirma o envio precisam olhar pra mesma coisa. Inclusive pra ver a variável
        // trocada pelo valor, que é onde o erro aparece ("Oi {{nome}}" indo literal pro cliente).
        <PreviaMensagem
          corpo={textoDaMensagem}
          variaveis={mapearVariaveis(textoDaMensagem)}
          assunto={temAssunto ? String(d.assunto ?? "") : null}
          titulo="Como vai chegar"
        />
      ) : null}
    </div>
  );
}

/**
 * Escolha do formulário interno.
 *
 * Era um campo de texto pedindo "ID do formulário interno". Ninguém sabe o id de um formulário de
 * cabeça, então o campo ficava vazio e o bloco não enviava nada. Agora é a lista dos formulários
 * do workspace, com o rascunho marcado: um formulário em rascunho abre pra quem recebe, mas é bom
 * a pessoa saber antes de mandar pro cliente.
 */
function EscolherFormulario({
  formularioId,
  onEscolher,
}: {
  formularioId: string;
  onEscolher: (id: string) => void;
}) {
  const { formularios } = useFormularios();
  // O formulário escolhido pode ter sido apagado depois. Some da lista, e o bloco apontaria pra um
  // id invisível: melhor mostrar que ele sumiu do que parecer que nada foi escolhido.
  const sumiu = formularioId && !formularios.some((f) => f.id === formularioId);

  return (
    <>
      <select className="input mt8" value={formularioId} onChange={(e) => onEscolher(e.target.value)}>
        <option value="">Escolha um formulário</option>
        {sumiu ? <option value={formularioId}>Formulário apagado ({formularioId})</option> : null}
        {formularios.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
            {f.status === "publicado" ? "" : " (rascunho)"}
          </option>
        ))}
      </select>
      <p className="hint mt8">
        {formularios.length
          ? "O contato recebe o link público do formulário, o mesmo do botão Compartilhar."
          : "Nenhum formulário criado ainda. Crie um em Formulários e volte aqui."}
      </p>
    </>
  );
}
