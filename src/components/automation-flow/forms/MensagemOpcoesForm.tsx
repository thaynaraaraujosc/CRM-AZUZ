"use client";

import { useRef } from "react";

import type { CanalMensagem, MensagemBotoesData, OpcaoBotaoLista } from "@/lib/automation-flow/types";
import { VariavelDropdown } from "./VariavelDropdown";
import { inserirTokenNoTexto } from "./variaveis";

const CANAIS: { valor: CanalMensagem; label: string }[] = [
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "instagram", label: "Instagram" },
  { valor: "tiktok", label: "TikTok" },
];

let contador = 0;
function novoIdOpcao(): string {
  contador += 1;
  return `opcao-${Date.now()}-${contador}`;
}

/** mensagem_botoes / mensagem_lista — cada opção vira um handle de saída nomeado no nó. */
export function MensagemOpcoesForm({
  data,
  onChange,
  onRemoverOpcao,
}: {
  data: MensagemBotoesData;
  onChange: (novo: MensagemBotoesData) => void;
  /** Chamado ANTES do onChange que tira a opção do array — pra quem escuta remover a aresta correspondente. */
  onRemoverOpcao: (opcaoId: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const opcoes = data.opcoes ?? [];

  function moverOpcao(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= opcoes.length) return;
    const novas = [...opcoes];
    [novas[indice], novas[alvo]] = [novas[alvo], novas[indice]];
    onChange({ ...data, opcoes: novas });
  }

  function atualizarOpcao(id: string, patch: Partial<OpcaoBotaoLista>) {
    onChange({ ...data, opcoes: opcoes.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  }

  function removerOpcao(id: string) {
    onRemoverOpcao(id);
    onChange({ ...data, opcoes: opcoes.filter((o) => o.id !== id) });
  }

  return (
    <div className="flow-form">
      <div className="field">
        <label>Canal</label>
        <select className="input" value={data.canal} onChange={(e) => onChange({ ...data, canal: e.target.value as CanalMensagem })}>
          {CANAIS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <div className="flow-form-label-row">
          <label style={{ marginBottom: 0 }}>Texto</label>
          <VariavelDropdown onEscolher={(t) => onChange({ ...data, texto: inserirTokenNoTexto(data.texto, t, textareaRef.current) })} />
        </div>
        <textarea
          ref={textareaRef}
          className="input"
          style={{ width: "100%", minHeight: 70, resize: "vertical" }}
          value={data.texto}
          onChange={(e) => onChange({ ...data, texto: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Opções ({opcoes.length})</label>
        {opcoes.map((opcao, i) => (
          <div className="flow-opcao-row" key={opcao.id}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={opcao.rotulo}
              placeholder={`Opção ${i + 1}`}
              onChange={(e) => atualizarOpcao(opcao.id, { rotulo: e.target.value })}
              aria-label={`Rótulo da opção ${i + 1}`}
            />
            <button type="button" className="icon-btn subtle" aria-label="Mover pra cima" disabled={i === 0} onClick={() => moverOpcao(i, -1)}>
              ↑
            </button>
            <button
              type="button"
              className="icon-btn subtle"
              aria-label="Mover pra baixo"
              disabled={i === opcoes.length - 1}
              onClick={() => moverOpcao(i, 1)}
            >
              ↓
            </button>
            <button type="button" className="remove-chip" aria-label="Remover opção" onClick={() => removerOpcao(opcao.id)}>
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn ghost block mt8"
          onClick={() => onChange({ ...data, opcoes: [...opcoes, { id: novoIdOpcao(), rotulo: "" }] })}
        >
          + Adicionar opção
        </button>
        <p className="hint mt8">
          Cada opção vira uma saída no bloco — conecte ela a um próximo passo no canvas. As saídas &quot;Outra resposta&quot; e
          &quot;Não respondeu&quot; já existem sempre.
        </p>
      </div>
    </div>
  );
}
