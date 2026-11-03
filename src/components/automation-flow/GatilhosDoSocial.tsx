"use client";

import { useState } from "react";

import { BLOCOS_DISPONIVEIS } from "@/lib/automation-flow/blocos";
import { IconClose, IconExpandir } from "@/components/icons";
import type { FlowNodeType } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

/**
 * A GAVETA DE GATILHOS DO SOCIAL SELLER.
 *
 * Antes isso era um modal no meio da tela com uma lista de botões. Na referência é uma gaveta pela
 * esquerda, com os gatilhos em linhas marcáveis, os menos usados atrás de "Opções avançadas", e um
 * link que abre a explicação de cada um. A diferença que importa não é a moldura: é que na lista
 * marcável dá pra LER os sete antes de escolher, e no modal de botões cada um era um clique que
 * fechava a tela.
 *
 * UM GATILHO POR AUTOMAÇÃO, e por isso as linhas são `radio` e não `checkbox`.
 *
 * A referência aceita vários ("Gatilhos ativos … +2"). O CRM guarda um bloco de gatilho por fluxo,
 * e aceitar vários é mudança de motor, não de tela — a execução precisa saber por qual evento ela
 * entrou. Desenhar caixas de marcar que só deixam marcar uma seria prometer o que não existe; a
 * forma redonda já conta a regra antes do primeiro clique.
 */

/** Os cinco que a referência mostra primeiro. O resto vai pra "Opções avançadas". */
const PRINCIPAIS: FlowNodeType[] = [
  "comentario_instagram",
  "instagram_story_respondido",
  "instagram_direct_recebido",
  "instagram_mencao_story",
];

/**
 * A explicação de cada gatilho em uma frase, no formato da referência: o que a pessoa faz e o que
 * a automação faz em seguida. É o conteúdo do "Como funciona cada gatilho?".
 *
 * Elas não substituem as descrições da biblioteca, que contam o que dá pra configurar (filtrar por
 * palavra, restringir a uma publicação). As duas respondem perguntas diferentes: esta é "quando
 * isso acontece?", a outra é "o que eu consigo ajustar?".
 */
const COMO_FUNCIONA: Partial<Record<FlowNodeType, string>> = {
  comentario_instagram: "Comentam no seu post ou Reels → a automação chama a pessoa no Direct.",
  instagram_story_respondido: "Respondem a um story seu → a automação continua a conversa no Direct.",
  instagram_direct_recebido: "Te mandam mensagem no Direct → a automação responde na hora.",
  instagram_mencao_story: "Marcam você em um story → a automação responde no Direct.",
  instagram_midia_recebida: "Mandam foto, vídeo ou áudio no Direct → a automação responde na hora.",
  instagram_publicacao_compartilhada: "Encaminham uma publicação pra você no Direct → a automação responde.",
  instagram_reacao_recebida: "Reagem com emoji a uma mensagem sua → a automação segue dali.",
  instagram_resposta_comentario: "Respondem a um comentário na sua publicação → a automação entra na conversa.",
};

export function GatilhosDoSocial({
  gatilhoAtual,
  onEscolher,
  onFechar,
}: {
  /** O tipo do gatilho que o fluxo já tem, se tiver. */
  gatilhoAtual?: FlowNodeType;
  onEscolher: (tipo: FlowNodeType) => void;
  onFechar: () => void;
}) {
  const { t: traduzir } = useIdioma();
  const [marcado, setMarcado] = useState<FlowNodeType | undefined>(gatilhoAtual);
  const [avancadoAberto, setAvancadoAberto] = useState(false);
  const [explicacaoAberta, setExplicacaoAberta] = useState(false);

  const doInstagram = BLOCOS_DISPONIVEIS.filter((b) => b.categoria === "gatilho" && b.grupo === "instagram");
  const principais = PRINCIPAIS.map((t) => doInstagram.find((b) => b.tipo === t)).filter(
    (b): b is (typeof doInstagram)[number] => Boolean(b),
  );
  const avancados = doInstagram.filter((b) => !PRINCIPAIS.includes(b.tipo));

  function Linha({ bloco }: { bloco: (typeof doInstagram)[number] }) {
    const escolhido = marcado === bloco.tipo;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={escolhido}
        className={`gat-item${escolhido ? " on" : ""}`}
        onClick={() => setMarcado(bloco.tipo)}
      >
        <span className="gat-marca" aria-hidden="true" />
        <span className="gat-textos">
          <strong>{traduzir(bloco.label)}</strong>
          {bloco.descricao ? <span>{traduzir(bloco.descricao)}</span> : null}
        </span>
      </button>
    );
  }

  return (
    <aside className="flow-config flow-config-social gat-gaveta" aria-label={traduzir("Gatilhos")}>
      <header className="cfg-topo">
        <h2>{traduzir("Gatilhos")}</h2>
        <button type="button" className="cfg-fechar" aria-label={traduzir("Fechar")} onClick={onFechar}>
          <IconClose width={14} height={14} />
        </button>
      </header>

      <div className="flow-config-body">
        <p className="gat-pergunta">{traduzir("O que inicia essa automação?")}</p>
        <button type="button" className="gat-ajuda" onClick={() => setExplicacaoAberta(true)}>
          <span aria-hidden="true">?</span> {traduzir("Como funciona cada gatilho?")}
        </button>

        <div className="gat-lista" role="radiogroup" aria-label={traduzir("O que inicia essa automação?")}>
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
              <div className="gat-lista" role="radiogroup" aria-label={traduzir("Opções avançadas")}>
                {avancados.map((b) => (
                  <Linha key={b.tipo} bloco={b} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <footer className="cfg-rodape gat-rodape">
        <button type="button" className="btn ghost pequeno" onClick={onFechar}>
          {traduzir("Voltar")}
        </button>
        <button
          type="button"
          className="cfg-salvar"
          disabled={!marcado || marcado === gatilhoAtual}
          onClick={() => marcado && onEscolher(marcado)}
        >
          {gatilhoAtual ? traduzir("Salvar") : traduzir("Continuar")}
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
