"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { IconCheck, IconEdit, IconMaisOpcoes } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

/**
 * O CABEÇALHO DO EDITOR DO SOCIAL SELLER.
 *
 * A barra do funil tem doze controles na mesma linha: voltar, nome, etiqueta de status, aviso de
 * pendência, três modos, desfazer, refazer, organizar, entender fluxo, histórico, execuções,
 * testar, um interruptor de ativo e dois botões de gravar. Cabe porque foi crescendo, não porque
 * foi desenhado — e numa automação de Instagram, que é curta e se monta em dois minutos, essa
 * barra é mais complicada que a própria automação.
 *
 * Aqui ficam só as quatro coisas que se usa o tempo todo: voltar, o nome (com o lápis, porque sem
 * ele ninguém adivinha que o texto é clicável), publicar e o resto. **O resto** é o menu "⋮": tudo
 * o que saiu da barra está lá dentro, nada foi removido do editor.
 *
 * A barra de ferramentas do canvas (zoom, desfazer, refazer, organizar) virou uma COLUNA à direita,
 * perto de onde a mão está enquanto se arrasta bloco. Ver `BarraFerramentasSocial`.
 *
 * VALE PRO FUNIL TAMBÉM, desde que a Thaynara comparou as duas telas com a do Kommo: "a gente tem
 * muita informação nessa tela que precisamos retirar... quando começa um do zero, ele começa com
 * a tela limpa". A barra antiga do funil tinha doze controles numa linha — três modos, desfazer,
 * refazer, organizar, entender fluxo, histórico, execuções, testar, um interruptor e dois botões
 * de gravar. Tudo continua existindo: o que se usa o tempo todo ficou na barra, o resto está no
 * "⋮" e na coluna de ferramentas do canvas.
 */
export function ToolbarSocial({
  hrefVoltar,
  nome,
  onChangeNome,
  status,
  salvando,
  salvoEm,
  temPendencia,
  onSalvarAlteracoes,
  onDescartarAlteracoes,
  ativa,
  podeAtivar,
  onToggleAtiva,
  onTestar,
  onAbrirExecucoes,
  onSalvarRascunho,
  onPublicar,
  onAbrirHistorico,
  onAbrirConfiguracoes,
  entenderFluxoAtivo,
  onAlternarEntenderFluxo,
  modoConstrucao,
  modoPassos,
  onModoPassos,
  onAlternarModo,
}: {
  /** Pra onde a setinha de voltar leva. Muda por módulo: o funil volta pra Automações. */
  hrefVoltar: string;
  nome: string;
  onChangeNome: (v: string) => void;
  status: "rascunho" | "publicado";
  salvando: boolean;
  /** ISO da última gravação, pro "Salvo em …". Nulo = nunca gravou nesta sessão. */
  salvoEm: string | null;
  temPendencia: boolean;
  onSalvarAlteracoes: () => void;
  onDescartarAlteracoes: () => void;
  ativa: boolean;
  podeAtivar: boolean;
  onToggleAtiva: () => void;
  onTestar: () => void;
  onAbrirExecucoes: () => void;
  onSalvarRascunho: () => void;
  onPublicar: () => void;
  onAbrirHistorico: () => void;
  /** As configurações gerais do fluxo: nome, descrição, horários. */
  onAbrirConfiguracoes: () => void;
  entenderFluxoAtivo: boolean;
  onAlternarEntenderFluxo: () => void;
  modoConstrucao: boolean;
  modoPassos: boolean;
  onModoPassos: (ligado: boolean) => void;
  onAlternarModo: () => void;
}) {
  const { t: traduzir } = useIdioma();
  const [editandoNome, setEditandoNome] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [publicarAberto, setPublicarAberto] = useState(false);
  const caixa = useRef<HTMLDivElement | null>(null);

  /* Fechar clicando fora: sem isto os dois menus ficam abertos enquanto se mexe no canvas, e o de
     publicar fica por cima do primeiro bloco. */
  useEffect(() => {
    if (!menuAberto && !publicarAberto) return;
    function aoClicar(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) {
        setMenuAberto(false);
        setPublicarAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [menuAberto, publicarAberto]);

  function fecharEntao(acao: () => void) {
    setMenuAberto(false);
    setPublicarAberto(false);
    acao();
  }

  return (
    <header className="flow-toolbar ss-toolbar">
      <div className="ss-toolbar-esq">
        <Link
          href={hrefVoltar}
          className="ss-toolbar-voltar"
          aria-label={traduzir("Voltar pras automações")}
        >
          <span aria-hidden="true">‹</span>
        </Link>

        {editandoNome ? (
          <input
            className="input ss-toolbar-nome-input"
            autoFocus
            value={nome}
            onChange={(e) => onChangeNome(e.target.value)}
            onBlur={() => setEditandoNome(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditandoNome(false)}
            aria-label={traduzir("Nome da automação")}
          />
        ) : (
          <>
            <h1 className="ss-toolbar-nome">{nome || traduzir("Sem título")}</h1>
            {/* O lápis existe porque texto clicável sem marca nenhuma não é descoberto: quem não
                sabe que dá pra renomear nunca renomeia. */}
            <button
              type="button"
              className="ss-toolbar-lapis"
              aria-label={traduzir("Renomear")}
              onClick={() => setEditandoNome(true)}
            >
              <IconEdit width={14} height={14} />
            </button>
          </>
        )}

        {status === "publicado" ? <span className="pill on">{traduzir("Publicado")}</span> : null}
      </div>

      <div className="ss-toolbar-dir" ref={caixa}>
        {/*
          A PENDÊNCIA CONTINUA À VISTA. O editor não grava sozinho, e a alteração não salva é a
          única coisa que não pode ficar escondida num menu: sair da tela com ela pendente perde o
          trabalho.
        */}
        {temPendencia ? (
          <span className="ss-toolbar-pendencia">
            <span>{traduzir("Alterações não salvas")}</span>
            <button type="button" className="btn ghost pequeno" onClick={onDescartarAlteracoes}>
              {traduzir("Descartar")}
            </button>
            <button type="button" className="btn ghost pequeno" onClick={onSalvarAlteracoes}>
              {traduzir("Salvar")}
            </button>
          </span>
        ) : null}

        <div className="ss-toolbar-caixa">
          <button
            type="button"
            className="ss-toolbar-publicar"
            aria-expanded={publicarAberto}
            onClick={() => {
              setMenuAberto(false);
              setPublicarAberto((v) => !v);
            }}
          >
            {traduzir("Testar e publicar")}
          </button>
          {publicarAberto ? (
            /*
              DOIS CAMINHOS, e não um botão que faz as duas coisas.
              
              "Testar e publicar" num botão só teria que escolher por conta própria entre abrir o
              simulador e pôr no ar — e as duas respostas estão certas em momentos diferentes.
            */
            <div className="ss-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => fecharEntao(onTestar)}>
                {traduzir("Testar a automação")}
                <em>{traduzir("Roda o fluxo com um contato de mentira, sem mandar nada.")}</em>
              </button>
              <button type="button" role="menuitem" onClick={() => fecharEntao(onPublicar)}>
                {traduzir("Publicar agora")}
                <em>{traduzir("Põe no ar a versão que está na tela.")}</em>
              </button>
              <button type="button" role="menuitem" onClick={() => fecharEntao(onSalvarRascunho)}>
                {traduzir("Salvar rascunho")}
                <em>{traduzir("Grava sem pôr no ar.")}</em>
              </button>
            </div>
          ) : null}
        </div>

        <div className="ss-toolbar-caixa">
          <button
            type="button"
            className="ss-toolbar-mais"
            aria-label={traduzir("Mais opções")}
            aria-expanded={menuAberto}
            onClick={() => {
              setPublicarAberto(false);
              setMenuAberto((v) => !v);
            }}
          >
            <IconMaisOpcoes width={16} height={16} />
          </button>
          {menuAberto ? (
            <div className="ss-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => fecharEntao(onAbrirConfiguracoes)}>
                {traduzir("Configurações da automação")}
                <em>{traduzir("Nome, descrição e horários em que ela pode rodar.")}</em>
              </button>
              <hr />
              <button
                type="button"
                role="menuitem"
                disabled={!podeAtivar}
                title={podeAtivar ? undefined : traduzir("Publique a automação pra poder ligar")}
                onClick={() => fecharEntao(onToggleAtiva)}
              >
                {ativa ? traduzir("Pausar a automação") : traduzir("Ligar a automação")}
                <em>{ativa ? traduzir("Ela para de responder, sem perder nada.") : traduzir("Ela volta a responder.")}</em>
              </button>
              <hr />
              <button type="button" role="menuitem" onClick={() => fecharEntao(() => onModoPassos(!modoPassos))}>
                {modoPassos ? traduzir("Voltar ao desenho") : traduzir("Ler como lista de passos")}
              </button>
              <button type="button" role="menuitem" onClick={() => fecharEntao(onAlternarModo)}>
                {modoConstrucao ? traduzir("Só visualizar") : traduzir("Voltar a construir")}
              </button>
              <button type="button" role="menuitem" onClick={() => fecharEntao(onAlternarEntenderFluxo)}>
                {entenderFluxoAtivo ? <IconCheck width={12} height={12} aria-hidden="true" /> : null}
                {traduzir("Entender fluxo")}
              </button>
              <hr />
              <button type="button" role="menuitem" onClick={() => fecharEntao(onAbrirExecucoes)}>
                {traduzir("Execuções")}
              </button>
              <button type="button" role="menuitem" onClick={() => fecharEntao(onAbrirHistorico)}>
                {traduzir("Histórico de versões")}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* "Salvo em…" não fica aqui em cima: ele mora no canto do canvas, longe dos botões, porque
          é informação e não controle. Ver `ss-salvo` no FlowEditor. */}
      <span className="sr-only" aria-live="polite">
        {salvando ? traduzir("Salvando") : salvoEm ? traduzir("Salvo") : ""}
      </span>
    </header>
  );
}
