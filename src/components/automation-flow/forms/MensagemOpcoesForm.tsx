"use client";

import { useRef } from "react";

import type { CanalMensagem, FormatoResposta, MensagemBotoesData, OpcaoBotaoLista } from "@/lib/automation-flow/types";
import { VariavelDropdown } from "./VariavelDropdown";
import { inserirTokenNoTexto } from "./variaveis";

const CANAIS: { valor: CanalMensagem; label: string }[] = [
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "instagram", label: "Instagram" },
  { valor: "tiktok", label: "TikTok" },
];

/**
 * Item 1/2 da spec: o CRM não pode parecer dependente de API oficial — menu numerado e texto livre
 * são texto puro, então funcionam em qualquer conexão ("Compatibilidade ampla"); botões/lista dependem
 * do que o provedor conectado suporta de verdade, daí o selo mais cauteloso nesses dois.
 */
const FORMATOS: { valor: FormatoResposta; label: string; desc: string; compatibilidade: string }[] = [
  {
    valor: "menu_numerado",
    label: "Menu numerado",
    desc: "As opções viram uma lista numerada em texto — o contato responde digitando o número (recomendado).",
    compatibilidade: "Compatibilidade ampla",
  },
  {
    valor: "botoes",
    label: "Botões clicáveis",
    desc: "Cada opção aparece como um botão clicável.",
    compatibilidade: "Disponibilidade conforme a integração",
  },
  {
    valor: "lista_interativa",
    label: "Lista interativa",
    desc: "As opções aparecem dentro de um menu de lista (um só botão abre as escolhas).",
    compatibilidade: "Disponibilidade conforme a integração",
  },
  {
    valor: "texto_livre",
    label: "Texto livre",
    desc: "Sem botões nem números — o contato responde do jeito que quiser, e depois dá pra criar condições (contém, é igual a, começa com, termina com, corresponde a palavra-chave).",
    compatibilidade: "Compatibilidade ampla",
  },
];

/** Prévia de como o menu numerado fica em texto puro — útil pra canais sem suporte a botão nativo. */
function previaMenuNumerado(texto: string, opcoes: OpcaoBotaoLista[]): string {
  const linhas = opcoes.map((o, i) => `${i + 1} - ${o.rotulo || `Opção ${i + 1}`}`);
  return [texto || "(sem texto)", "", ...linhas, "", "Digite o número da opção."].join("\n");
}

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
  const formatoAtual = data.formatoResposta ?? "menu_numerado";

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
        <div className="flow-form-label-row">
          <label style={{ marginBottom: 0 }}>Formato de resposta</label>
          <span
            className="hint"
            title="Alguns recursos interativos dependem do provedor e do tipo de conexão configurado."
          >
            ⓘ compatibilidade
          </span>
        </div>
        <div className="flow-formato-resposta-lista">
          {FORMATOS.map((f) => (
            <button
              type="button"
              key={f.valor}
              className={`flow-formato-resposta-opcao${formatoAtual === f.valor ? " sel" : ""}`}
              onClick={() => onChange({ ...data, formatoResposta: f.valor })}
            >
              <span className="n">{f.label}</span>
              <span className="r">{f.desc}</span>
              <span
                className={`flow-formato-compat${f.compatibilidade === "Compatibilidade ampla" ? " ampla" : ""}`}
                title="Alguns recursos interativos dependem do provedor e do tipo de conexão configurado."
              >
                {f.compatibilidade}
              </span>
            </button>
          ))}
        </div>
        <p className="hint mt8">
          Só front-end nesta fase — nenhum formato liga em envio real de mensagem ainda. O menu numerado
          continua disponível independentemente da conexão selecionada.
        </p>
      </div>

      {formatoAtual === "menu_numerado" && opcoes.length > 0 ? (
        <div className="field">
          <label>Prévia (como o contato veria em texto puro)</label>
          <pre className="flow-menu-numerado-previa">{previaMenuNumerado(data.texto, opcoes)}</pre>
        </div>
      ) : null}

      <div className="field">
        <label>Opções ({opcoes.length})</label>
        {opcoes.map((opcao, i) => (
          <div className="flow-opcao-bloco" key={opcao.id}>
            <div className="flow-opcao-row">
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
            {formatoAtual === "menu_numerado" ? (
              <div className="flow-opcao-alternativas">
                <label>
                  Respostas alternativas aceitas (além do número {i + 1}) — separe por vírgula
                </label>
                <input
                  className="input"
                  placeholder={`ex.: número ${i + 1}, opcao ${i + 1}, ${(opcao.rotulo || "palavra-chave").toLowerCase()}`}
                  value={(opcao.respostasAlternativas ?? []).join(", ")}
                  onChange={(e) =>
                    atualizarOpcao(opcao.id, {
                      respostasAlternativas: e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                  aria-label={`Respostas alternativas da opção ${i + 1}`}
                />
              </div>
            ) : null}
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
