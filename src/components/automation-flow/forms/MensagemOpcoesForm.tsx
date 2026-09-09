"use client";

import { useRef } from "react";

import type {
  AposTentativas,
  CanalMensagem,
  FormatoResposta,
  MensagemBotoesData,
  OpcaoBotaoLista,
  TipoComparacao,
} from "@/lib/automation-flow/types";

/** Como casar a resposta com esta opção. O padrão cobre quase tudo; o resto é pra casos difíceis. */
const COMPARACOES: { valor: TipoComparacao; label: string }[] = [
  { valor: "padrao", label: "Padrão (número, texto do botão ou alternativas)" },
  { valor: "igual", label: "Exatamente igual a" },
  { valor: "contem", label: "Contém" },
  { valor: "comeca_com", label: "Começa com" },
  { valor: "termina_com", label: "Termina com" },
  { valor: "numero", label: "É o número" },
  { valor: "regex", label: "Expressão regular (avançado)" },
  { valor: "qualquer", label: "Qualquer resposta (pega o resto)" },
];

const APOS_TENTATIVAS: { valor: AposTentativas; label: string }[] = [
  { valor: "outra_resposta", label: "Seguir pelo caminho \"Errou demais\"" },
  { valor: "encerrar", label: "Encerrar a automação" },
];
import { VariavelDropdown } from "./VariavelDropdown";
import { inserirTokenNoTexto } from "./variaveis";
import { IconClose } from "@/components/icons";
import { validarRegex } from "@/lib/automacoes/regex-seguro";
import { CANAIS_DA_AREA, formatosDePergunta, type AreaAutomacao } from "@/lib/canais/capacidades";
import { avisoDeJanela, canaisDaAreaParaBloco } from "./canais";


/**
 * Item 1/2 da spec: o CRM não pode parecer dependente de API oficial. Menu numerado e texto livre
 * são texto puro, então funcionam em qualquer conexão ("Compatibilidade ampla"); botões/lista dependem
 * do que o provedor conectado suporta de verdade, daí o selo mais cauteloso nesses dois.
 */
const FORMATOS: { valor: FormatoResposta; label: string; desc: string; compatibilidade: string }[] = [
  {
    valor: "menu_numerado",
    label: "Menu numerado",
    desc: "As opções viram uma lista numerada em texto. O contato responde digitando o número (recomendado).",
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
    desc: "Sem botões nem números: o contato responde do jeito que quiser, e depois dá pra criar condições (contém, é igual a, começa com, termina com, corresponde a palavra-chave).",
    compatibilidade: "Compatibilidade ampla",
  },
];

/** Prévia de como o menu numerado fica em texto puro. Útil pra canais sem suporte a botão nativo. */
function previaMenuNumerado(texto: string, opcoes: OpcaoBotaoLista[]): string {
  const linhas = opcoes.map((o, i) => `${i + 1} - ${o.rotulo || `Opção ${i + 1}`}`);
  return [texto || "(sem texto)", "", ...linhas, "", "Digite o número da opção."].join("\n");
}

/**
 * A opção tem algum ajuste fora do padrão?
 *
 * Decide se o bloco "Ajustes desta opção" nasce aberto. Fechado por padrão porque, na maioria das
 * perguntas, o que se configura é o TEXTO da opção e mais nada: os três campos de baixo abertos em
 * cada uma transformavam uma pergunta de três opções em quinze campos empilhados, e o que importa
 * (o texto) sumia no meio. Mas escondê-los de quem JÁ os usou seria pior ainda: nesse caso ele
 * abre sozinho, com o ajuste à vista.
 */
function temAjuste(opcao: OpcaoBotaoLista): boolean {
  return (
    ((opcao.comparacao ?? "padrao") !== "padrao") ||
    !!opcao.url?.trim() ||
    (opcao.respostasAlternativas ?? []).length > 0
  );
}

let contador = 0;
function novoIdOpcao(): string {
  contador += 1;
  return `opcao-${Date.now()}-${contador}`;
}

/** mensagem_botoes / mensagem_lista: cada opção vira um handle de saída nomeado no nó. */
export function MensagemOpcoesForm({
  data,
  area,
  onChange,
  onRemoverOpcao,
}: {
  data: MensagemBotoesData;
  /** Comercial ou social: decide os canais e quais formatos de resposta existem de verdade. */
  area: AreaAutomacao;
  onChange: (novo: MensagemBotoesData) => void;
  /** Chamado ANTES do onChange que tira a opção do array. Pra quem escuta remover a aresta correspondente. */
  onRemoverOpcao: (opcaoId: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const opcoes = data.opcoes ?? [];
  const formatoAtual = data.formatoResposta ?? "menu_numerado";
  const canais = canaisDaAreaParaBloco(area);
  const janela = avisoDeJanela(area);
  // Os formatos que ALGUM canal desta área entrega. Lista interativa não existe no Direct, e
  // oferecê-la num robô de Instagram seria prometer um menu que não vai aparecer.
  const formatosDaArea = FORMATOS.filter((f) =>
    CANAIS_DA_AREA[area].some((canal) => formatosDePergunta(canal).includes(f.valor)),
  );

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
        <select
          className="input"
          value={data.canal ?? canais[0]?.valor}
          onChange={(e) => onChange({ ...data, canal: e.target.value as CanalMensagem })}
        >
          {canais.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
        {janela ? <p className="hint mt8">{janela}</p> : null}
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
          {formatosDaArea.map((f) => (
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
          Só front-end nesta fase: nenhum formato liga em envio real de mensagem ainda. O menu numerado
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
              {/* O número é o mesmo que a pessoa vê no menu numerado, e é por ele que ela responde
                  quando a conexão não entrega botão. Ter o número aqui liga as duas telas. */}
              <span className="flow-opcao-num" aria-hidden="true">
                {i + 1}
              </span>
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
                <IconClose width={13} height={13} />
              </button>
            </div>
            <details className="flow-opcao-avancado" open={temAjuste(opcao)}>
              <summary>Ajustes desta opção</summary>

            <div className="flow-opcao-alternativas">
              <label>Como casar a resposta</label>
              <select
                className="input"
                value={opcao.comparacao ?? "padrao"}
                onChange={(e) => atualizarOpcao(opcao.id, { comparacao: e.target.value as TipoComparacao })}
                aria-label={`Comparação da opção ${i + 1}`}
              >
                {COMPARACOES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </select>
              {(opcao.comparacao ?? "padrao") !== "padrao" && opcao.comparacao !== "qualquer" ? (
                <input
                  className="input mt8"
                  placeholder={`O que comparar (vazio = "${opcao.rotulo || "o rótulo"}")`}
                  value={opcao.valorComparado ?? ""}
                  onChange={(e) => atualizarOpcao(opcao.id, { valorComparado: e.target.value })}
                  aria-label={`Valor comparado da opção ${i + 1}`}
                />
              ) : null}
              {opcao.comparacao === "regex" ? (
                (() => {
                  const checagem = validarRegex(opcao.valorComparado ?? "");
                  return checagem.ok ? (
                    <p className="hint mt8">
                      Comparação sem acento e sem diferenciar maiúscula. A expressão é conferida
                      antes de salvar e tem tempo limitado na execução.
                    </p>
                  ) : (
                    <p className="hint mt8" style={{ color: "var(--danger)" }}>
                      {checagem.motivo}
                    </p>
                  );
                })()
              ) : null}
              {opcao.comparacao === "qualquer" ? (
                <p className="hint mt8">
                  Pega tudo que chegar. Deixe por último: as opções abaixo desta nunca são
                  alcançadas.
                </p>
              ) : null}
            </div>
            <div className="flow-opcao-alternativas">
              <label>Endereço (deixa vazio pra ser um botão de resposta)</label>
              <input
                className="input"
                placeholder="https://…"
                value={opcao.url ?? ""}
                onChange={(e) => atualizarOpcao(opcao.id, { url: e.target.value })}
                aria-label={`Endereço da opção ${i + 1}`}
              />
              {opcao.url?.trim() ? (
                <p className="hint mt8">
                  Botão de URL: leva pro endereço e não cria caminho no fluxo, porque quem clica sai
                  e não responde nada. Com um botão desses, a pergunta inteira sai como menu
                  numerado, com o link escrito na opção.
                </p>
              ) : null}
            </div>
            {formatoAtual === "menu_numerado" && !opcao.url?.trim() ? (
              <div className="flow-opcao-alternativas">
                <label>
                  Respostas alternativas aceitas (além do número {i + 1}): separe por vírgula
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
            </details>
          </div>
        ))}
        <button
          type="button"
          className="btn ghost block mt8"
          onClick={() => onChange({ ...data, opcoes: [...opcoes, { id: novoIdOpcao(), rotulo: "" }] })}
        >
          + Botão de ação
        </button>
        <button
          type="button"
          className="btn ghost block mt8"
          onClick={() => onChange({ ...data, opcoes: [...opcoes, { id: novoIdOpcao(), rotulo: "", url: "https://" }] })}
        >
          + Botão de URL
        </button>
        <p className="hint mt8">
          <b>O que cada conexão entrega:</b> no WhatsApp oficial, até 3 opções viram botões e de 4 a
          10 viram lista. Na conexão por QR Code não existe botão confiável, então a pergunta sai
          como menu numerado (&quot;1 - …&quot;, &quot;2 - …&quot;) e a pessoa responde digitando o
          número. Os dois casos funcionam: o casamento da resposta aceita o número e o texto.
        </p>
        <p className="hint mt8">
          Cada opção vira uma saída no bloco. Conecte ela a um próximo passo no canvas. A saída
          &quot;Outra resposta&quot; existe sempre; &quot;Sem resposta&quot; e &quot;Errou
          demais&quot; aparecem quando você configura prazo e tentativas abaixo.
        </p>
      </div>

      <div className="field">
        <label>Esperar a resposta por</label>
        <div className="funil-auto-horas">
          <input
            type="number"
            min={0}
            className="input"
            value={data.esperaMinutos ?? ""}
            placeholder="Sem prazo"
            onChange={(e) =>
              onChange({ ...data, esperaMinutos: e.target.value ? Number(e.target.value) : undefined })
            }
          />
          <span>minutos</span>
        </div>
        <p className="hint mt8">
          Vazio = espera pra sempre. Com prazo, aparece a saída &quot;Sem resposta&quot;, que é por
          onde sai o follow-up de quem não respondeu.
        </p>
      </div>

      <div className="field">
        <label>Tolerar quantas respostas fora das opções</label>
        <input
          type="number"
          min={0}
          className="input"
          value={data.tentativasMaximas ?? ""}
          placeholder="Sem limite"
          onChange={(e) =>
            onChange({ ...data, tentativasMaximas: e.target.value ? Number(e.target.value) : undefined })
          }
        />
        {data.tentativasMaximas ? (
          <>
            <select
              className="input mt8"
              value={data.aposTentativas ?? "outra_resposta"}
              onChange={(e) => onChange({ ...data, aposTentativas: e.target.value as AposTentativas })}
            >
              {APOS_TENTATIVAS.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.label}
                </option>
              ))}
            </select>
            <p className="hint mt8">
              Depois de {data.tentativasMaximas} erro{data.tentativasMaximas > 1 ? "s" : ""}, o
              fluxo para de repetir a pergunta. É o que impede o &quot;não entendi&quot; virar um
              laço sem fim com alguém do outro lado. Acertar zera a contagem.
            </p>
          </>
        ) : (
          <p className="hint mt8">Vazio = repete a pergunta pra sempre enquanto a pessoa errar.</p>
        )}
      </div>
    </div>
  );
}
