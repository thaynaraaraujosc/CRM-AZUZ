"use client";

import { useState } from "react";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { ComentarioInstagramForm } from "./forms/ComentarioInstagramForm";
import { StoryRespondidoForm } from "./forms/StoryRespondidoForm";
import { IconClose, IconExpandir } from "@/components/icons";
import type { FlowNodeType } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

/**
 * A GAVETA DE GATILHOS DO SOCIAL SELLER: escolher vários, e configurar um por vez.
 *
 * VÁRIOS GATILHOS NA MESMA AUTOMAÇÃO. Antes era um só, e as linhas eram `radio` por isso: o motor
 * guardava um bloco de gatilho por fluxo. Quem queria responder a comentário E a resposta de story
 * montava a mesma automação duas vezes, com os mesmos passos copiados — e na segunda vez esquecia
 * de corrigir junto. O motor passou a aceitar vários blocos (ver `gatilhos-do-fluxo.ts`), e aqui
 * as linhas viraram caixas de marcar.
 *
 * DEPOIS DA ESCOLHA, UMA ETAPA POR PERGUNTA. Marcar "comentário" e "resposta de story" deixa duas
 * perguntas em aberto — em quais publicações, em quais stories — e cada gatilho tem as suas. Numa
 * tela só, isso seria uma pilha de formulários condicionais; em etapas, cada pergunta aparece
 * sozinha, com a barra dizendo quanto falta. As palavras-chave vêm primeiro porque valem pra
 * todos.
 *
 * O número de etapas é a conta do que foi marcado, não um número fixo: com um gatilho que não
 * filtra nada, a gaveta fecha logo depois das palavras.
 */

/** Os cinco que a referência mostra primeiro, nesta ordem. O resto vai pra "Opções avançadas". */
const PRINCIPAIS: FlowNodeType[] = [
  "comentario_instagram",
  "instagram_story_respondido",
  "instagram_direct_recebido",
  "instagram_comentario_live",
  "instagram_mencao_story",
];

/**
 * A explicação de cada gatilho em uma frase: o que a pessoa faz e o que a automação faz em
 * seguida. É o conteúdo do "Como funciona cada gatilho?".
 */
const COMO_FUNCIONA: Partial<Record<FlowNodeType, string>> = {
  comentario_instagram: "Comentam no seu post ou Reels → a automação chama a pessoa no Direct.",
  instagram_story_respondido: "Respondem a um story seu → a automação continua a conversa no Direct.",
  instagram_direct_recebido: "Te mandam mensagem no Direct → a automação responde na hora.",
  instagram_mencao_story: "Marcam você em um story → a automação responde no Direct.",
  instagram_comentario_live:
    "Comentam durante a sua live → a automação chama a pessoa no Direct, e a conversa continua depois que a live acaba.",
  instagram_midia_recebida: "Mandam foto, vídeo ou áudio no Direct → a automação responde na hora.",
  instagram_publicacao_compartilhada: "Encaminham uma publicação pra você no Direct → a automação responde.",
  instagram_reacao_recebida: "Reagem com emoji a uma mensagem sua → a automação segue dali.",
  instagram_resposta_comentario: "Respondem a um comentário na sua publicação → a automação entra na conversa.",
};

/**
 * Quais gatilhos têm uma pergunta de alcance ("em quais publicações?", "em quais stories?").
 *
 * Só estes ganham etapa própria. Um gatilho de Direct recebido não escolhe nada: criar uma etapa
 * pra ele seria uma tela em branco com um botão "Continuar".
 */
const ALCANCE: Partial<Record<FlowNodeType, { titulo: string; pergunta: string }>> = {
  comentario_instagram: {
    titulo: "Comentário no Feed ou Reels",
    pergunta: "Em quais publicações a automação deve funcionar?",
  },
  instagram_story_respondido: {
    titulo: "Resposta nos stories",
    pergunta: "Em quais stories a automação deve funcionar?",
  },
};

export type EscolhaDeGatilho = { tipo: FlowNodeType; data: Record<string, unknown> };

export function GatilhosDoSocial({
  gatilhosAtuais,
  onEscolher,
  onFechar,
}: {
  /** Os gatilhos que o fluxo já tem, com a configuração de cada um. */
  gatilhosAtuais?: EscolhaDeGatilho[];
  onEscolher: (escolhas: EscolhaDeGatilho[]) => void;
  onFechar: () => void;
}) {
  const { t: traduzir } = useIdioma();
  const [marcados, setMarcados] = useState<FlowNodeType[]>(
    () => gatilhosAtuais?.map((g) => g.tipo) ?? [],
  );
  const [dados, setDados] = useState<Partial<Record<FlowNodeType, Record<string, unknown>>>>(() => {
    const inicial: Partial<Record<FlowNodeType, Record<string, unknown>>> = {};
    gatilhosAtuais?.forEach((g) => {
      inicial[g.tipo] = { ...g.data };
    });
    return inicial;
  });
  /** `-1` é a lista de gatilhos; 0 em diante são as etapas de configuração. */
  const [etapa, setEtapa] = useState(-1);
  const [avancadoAberto, setAvancadoAberto] = useState(false);
  const [explicacaoAberta, setExplicacaoAberta] = useState(false);

  const doInstagram = BLOCOS_DISPONIVEIS.filter((b) => b.categoria === "gatilho" && b.grupo === "instagram");
  const principais = PRINCIPAIS.map((t) => doInstagram.find((b) => b.tipo === t)).filter(
    (b): b is (typeof doInstagram)[number] => Boolean(b),
  );
  const avancados = doInstagram.filter((b) => !PRINCIPAIS.includes(b.tipo));

  /*
   * AS ETAPAS SÃO CALCULADAS DO QUE FOI MARCADO.
   *
   * A primeira é sempre as palavras-chave, porque elas valem pra todos os gatilhos. Depois vem
   * uma etapa por gatilho que tenha uma pergunta de alcance, na ordem em que foram marcados.
   */
  const etapas: { chave: string; tipo?: FlowNodeType; titulo: string; pergunta: string }[] = [
    {
      chave: "palavras",
      titulo: "Palavras-chave",
      pergunta: "Quais palavras ou frases ativam a automação?",
    },
    ...marcados
      .filter((t) => ALCANCE[t])
      .map((t) => ({ chave: t, tipo: t, titulo: ALCANCE[t]!.titulo, pergunta: ALCANCE[t]!.pergunta })),
  ];

  function alternar(tipo: FlowNodeType) {
    setMarcados((atual) =>
      atual.includes(tipo) ? atual.filter((t) => t !== tipo) : [...atual, tipo],
    );
  }

  function mudarDados(tipo: FlowNodeType, novo: Record<string, unknown>) {
    setDados((atual) => ({ ...atual, [tipo]: novo }));
  }

  function concluir() {
    onEscolher(marcados.map((tipo) => ({ tipo, data: { ...(dados[tipo] ?? {}) } })));
  }

  function avancar() {
    if (etapa + 1 < etapas.length) setEtapa(etapa + 1);
    else concluir();
  }

  function voltar() {
    if (etapa === -1) onFechar();
    else setEtapa(etapa - 1);
  }

  /*
   * AS PALAVRAS VALEM PRA TODOS OS GATILHOS, e por isso são editadas uma vez só.
   *
   * Guardadas no primeiro gatilho marcado e copiadas pros demais na hora de concluir: cada bloco
   * precisa da sua cópia porque quem avalia o evento é o bloco, não o fluxo.
   */
  const palavrasAtuais = (dados[marcados[0]]?.palavras as string[] | undefined) ?? [];
  const [palavraNova, setPalavraNova] = useState("");

  function mudarPalavras(lista: string[]) {
    setDados((atual) => {
      const copia = { ...atual };
      marcados.forEach((t) => {
        copia[t] = { ...(copia[t] ?? {}), palavras: lista };
      });
      return copia;
    });
  }

  /*
   * A LINHA É SÓ O NOME DO GATILHO.
   *
   * A descrição estava dentro de cada caixa, e com ela cada opção ocupava três linhas de texto:
   * oito gatilhos viravam uma rolagem, e a lista — que é uma ESCOLHA, feita de relance — passava a
   * exigir leitura. A explicação não sumiu: ela está inteira no "Como funciona cada gatilho?", que
   * é onde se vai quando a dúvida aparece, e não antes dela.
   */
  function Linha({ bloco }: { bloco: (typeof doInstagram)[number] }) {
    const escolhido = marcados.includes(bloco.tipo);
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={escolhido}
        className={`gat-item${escolhido ? " on" : ""}`}
        title={bloco.descricao ? traduzir(bloco.descricao) : undefined}
        onClick={() => alternar(bloco.tipo)}
      >
        <span className="gat-marca gat-marca-caixa" aria-hidden="true" />
        <span className="gat-textos">
          <strong>{traduzir(bloco.label)}</strong>
        </span>
      </button>
    );
  }

  const etapaAtual = etapa >= 0 ? etapas[etapa] : null;

  return (
    <aside className="flow-config flow-config-social gat-gaveta" aria-label={traduzir("Gatilhos")}>
      <header className="cfg-topo">
        <h2>{etapaAtual ? traduzir(etapaAtual.titulo) : traduzir("Gatilhos")}</h2>
        <button type="button" className="cfg-fechar" aria-label={traduzir("Fechar")} onClick={onFechar}>
          <IconClose width={14} height={14} />
        </button>
      </header>

      {/* A barra de progresso só existe depois da escolha: antes dela não há quantas etapas. */}
      {etapaAtual ? (
        <div className="gat-progresso">
          <span className="gat-progresso-texto">
            {traduzir("Etapa {n} de {total}", { n: String(etapa + 1), total: String(etapas.length) })}
          </span>
          <span className="gat-progresso-trilho">
            <span
              className="gat-progresso-barra"
              style={{ width: `${((etapa + 1) / etapas.length) * 100}%` }}
            />
          </span>
        </div>
      ) : null}

      <div className="flow-config-body gat-corpo">
        {!etapaAtual ? (
          <>
            <p className="gat-pergunta">{traduzir("O que inicia essa automação?")}</p>
            <button type="button" className="gat-ajuda" onClick={() => setExplicacaoAberta(true)}>
              <span aria-hidden="true">?</span> {traduzir("Como funciona cada gatilho?")}
            </button>

            <div className="gat-lista" role="group" aria-label={traduzir("O que inicia essa automação?")}>
              {principais.map((b) => (
                <Linha key={b.tipo} bloco={b} />
              ))}
            </div>

            {avancados.length ? (
              <>
                <button
                  type="button"
                  className="gat-avancado"
                  aria-expanded={avancadoAberto}
                  onClick={() => setAvancadoAberto((v) => !v)}
                >
                  {traduzir("Opções avançadas")}
                  <IconExpandir className={avancadoAberto ? "girado" : undefined} width={14} height={14} aria-hidden="true" />
                </button>
                {avancadoAberto ? (
                  <div className="gat-lista" role="group" aria-label={traduzir("Opções avançadas")}>
                    {avancados.map((b) => (
                      <Linha key={b.tipo} bloco={b} />
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <div className="gat-etapa" key={etapaAtual.chave}>
            <p className="gat-pergunta">{traduzir(etapaAtual.pergunta)}</p>

            {etapaAtual.chave === "palavras" ? (
              <>
                <p className="gat-nota">
                  {traduzir("As palavras-chave valem para todos os gatilhos desta automação.")}
                </p>
                <div className="gat-palavras">
                  {palavrasAtuais.length === 0 ? (
                    <span className="gat-palavra-vazia">{traduzir("Qualquer palavra-chave")}</span>
                  ) : (
                    palavrasAtuais.map((p) => (
                      <span key={p} className="gat-palavra">
                        {p}
                        <button
                          type="button"
                          aria-label={traduzir("Tirar a palavra {p}", { p })}
                          onClick={() => mudarPalavras(palavrasAtuais.filter((x) => x !== p))}
                        >
                          <IconClose width={10} height={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="gat-palavra-nova">
                  <input
                    className="input"
                    value={palavraNova}
                    placeholder={traduzir("Ex.: quero, preço, guia")}
                    onChange={(e) => setPalavraNova(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const nova = palavraNova.trim();
                      if (nova && !palavrasAtuais.includes(nova)) mudarPalavras([...palavrasAtuais, nova]);
                      setPalavraNova("");
                    }}
                  />
                  <button
                    type="button"
                    className="btn ghost pequeno"
                    disabled={!palavraNova.trim()}
                    onClick={() => {
                      const nova = palavraNova.trim();
                      if (nova && !palavrasAtuais.includes(nova)) mudarPalavras([...palavrasAtuais, nova]);
                      setPalavraNova("");
                    }}
                  >
                    + {traduzir("Adicionar")}
                  </button>
                </div>
                <p className="gat-nota">
                  {traduzir("Sem nenhuma palavra, a automação vale para qualquer texto.")}
                </p>
              </>
            ) : etapaAtual.tipo === "comentario_instagram" ? (
              <ComentarioInstagramForm
                data={dados.comentario_instagram ?? {}}
                onChange={(novo) => mudarDados("comentario_instagram", novo as Record<string, unknown>)}
              />
            ) : etapaAtual.tipo === "instagram_story_respondido" ? (
              <StoryRespondidoForm
                data={dados.instagram_story_respondido ?? {}}
                onChange={(novo) => mudarDados("instagram_story_respondido", novo as Record<string, unknown>)}
              />
            ) : null}
          </div>
        )}
      </div>

      <footer className="cfg-rodape gat-rodape">
        <button type="button" className="btn ghost pequeno" onClick={voltar}>
          {traduzir("Voltar")}
        </button>
        <button type="button" className="cfg-salvar" disabled={marcados.length === 0} onClick={avancar}>
          {etapa + 1 < etapas.length ? traduzir("Continuar") : traduzir("Salvar")}
        </button>
      </footer>

      {explicacaoAberta ? (
        <div className="modal-overlay" onClick={() => setExplicacaoAberta(false)}>
          <div className="gat-modal" role="dialog" aria-label={traduzir("Como funciona cada gatilho?")} onClick={(e) => e.stopPropagation()}>
            <header className="tpl-topo">
              <h3>{traduzir("Como funciona cada gatilho?")}</h3>
              <button type="button" className="tpl-fechar" aria-label={traduzir("Fechar")} onClick={() => setExplicacaoAberta(false)}>
                <IconClose width={14} height={14} />
              </button>
            </header>
            <div className="gat-modal-corpo">
              {doInstagram.map((b) => (
                <div key={b.tipo} className="gat-modal-item">
                  <strong>{traduzir(b.label)}</strong>
                  <span>{traduzir(COMO_FUNCIONA[b.tipo] ?? b.descricao ?? "")}</span>
                </div>
              ))}
              <p className="gat-modal-fim">
                {traduzir("Em todos os casos, depois disso a conversa segue os passos da sua automação.")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
