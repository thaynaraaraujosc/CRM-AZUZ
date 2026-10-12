"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCheck } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

export function Toolbar({
  nome,
  onChangeNome,
  status,
  salvando,
  temPendencia,
  onSalvarAlteracoes,
  onDescartarAlteracoes,
  ativa,
  podeAtivar,
  onToggleAtiva,
  podeDesfazer,
  podeRefazer,
  onUndo,
  onRedo,
  onTestar,
  onAbrirExecucoes,
  onSalvarRascunho,
  onPublicar,
  onAbrirHistorico,
  onOrganizarAutomaticamente,
  entenderFluxoAtivo,
  onAlternarEntenderFluxo,
  modoConstrucao,
  modoPassos,
  onModoPassos,
  onAlternarModo,
}: {
  nome: string;
  onChangeNome: (v: string) => void;
  status: "rascunho" | "publicado";
  salvando: boolean;
  /** Existe alteração digitada que ainda não foi gravada. */
  temPendencia: boolean;
  onSalvarAlteracoes: () => void;
  onDescartarAlteracoes: () => void;
  ativa: boolean;
  podeAtivar: boolean;
  onToggleAtiva: () => void;
  podeDesfazer: boolean;
  podeRefazer: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTestar: () => void;
  /** Abre o histórico do que a automação já fez, por contato. */
  onAbrirExecucoes: () => void;
  onSalvarRascunho: () => void;
  onPublicar: () => void;
  onAbrirHistorico: () => void;
  onOrganizarAutomaticamente: () => void;
  entenderFluxoAtivo: boolean;
  onAlternarEntenderFluxo: () => void;
  modoConstrucao: boolean;
  /** A leitura em lista numerada. Convive com Construir: é outra forma de ver o mesmo fluxo. */
  modoPassos: boolean;
  onModoPassos: (ligado: boolean) => void;
  onAlternarModo: () => void;
}) {
  const { t: traduzir } = useIdioma();
  const [editandoNome, setEditandoNome] = useState(false);

  return (
    <header className="flow-toolbar">
      <div className="flow-toolbar-esq">
        <Link href="/automacoes" className="icon-btn subtle" aria-label={traduzir("Voltar pra lista de automações")}>
          ←
        </Link>

        {editandoNome ? (
          <input
            className="input flow-toolbar-nome-input"
            autoFocus
            value={nome}
            onChange={(e) => onChangeNome(e.target.value)}
            onBlur={() => setEditandoNome(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditandoNome(false)}
            aria-label={traduzir("Nome do fluxo")}
          />
        ) : (
          <button type="button" className="flow-toolbar-nome" onClick={() => setEditandoNome(true)}>
            {nome || "Sem nome"}
          </button>
        )}

        <span className={`pill${status === "publicado" ? " on" : ""}`}>{status === "publicado" ? "Publicado" : "Rascunho"}</span>
        {/*
          O editor não grava mais sozinho. Antes ele gravava a cada meia tecla, e com o robô ligado
          isso significava duas coisas ruins ao mesmo tempo: a tela piscando enquanto se digitava um
          título, e um erro de digitação indo pro ar antes de a frase terminar.

          Por isso a alteração fica À VISTA, com os dois caminhos ao lado dela. "Descartar" existe
          porque errar ao digitar é o caso comum, e desfazer tecla a tecla não é resposta.
        */}
        {temPendencia ? (
          <span className="flow-pendencia">
            <span className="flow-pendencia-aviso">{traduzir("Alterações não salvas")}</span>
            <button type="button" className="btn primary" onClick={onSalvarAlteracoes}>
              {traduzir("Salvar")}
            </button>
            <button type="button" className="btn ghost" onClick={onDescartarAlteracoes}>
              {traduzir("Descartar")}
            </button>
          </span>
        ) : (
          <span className="flow-save-indicator">{salvando ? "Salvando…" : traduzir("Todas as alterações foram salvas")}</span>
        )}
      </div>

      <div className="flow-toolbar-dir">
        <div className="flow-toolbar-modo" role="tablist" aria-label={traduzir("Modo do editor")}>
          <button
            type="button"
            role="tab"
            aria-selected={modoConstrucao}
            className={`flow-toolbar-modo-btn${modoConstrucao ? " active" : ""}`}
            onClick={() => !modoConstrucao && onAlternarModo()}
          >
            {traduzir("Construir")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modoPassos}
            className={`flow-toolbar-modo-btn${modoPassos ? " active" : ""}`}
            title={traduzir("Ler a automação como uma lista de passos, na ordem em que a pessoa é atendida")}
            onClick={() => onModoPassos(!modoPassos)}
          >
            {traduzir("Passos")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!modoConstrucao}
            className={`flow-toolbar-modo-btn${!modoConstrucao ? " active" : ""}`}
            title={traduzir("Revisar o fluxo sem risco de mexer em nada sem querer")}
            onClick={() => modoConstrucao && onAlternarModo()}
          >
            {traduzir("Visualizar")}
          </button>
        </div>
        <button type="button" className="icon-btn subtle" aria-label={traduzir("Desfazer")} title={traduzir("Desfazer (Ctrl+Z)")} disabled={!podeDesfazer || !modoConstrucao} onClick={onUndo}>
          ↶
        </button>
        <button type="button" className="icon-btn subtle" aria-label={traduzir("Refazer")} title={traduzir("Refazer (Ctrl+Shift+Z)")} disabled={!podeRefazer || !modoConstrucao} onClick={onRedo}>
          ↷
        </button>
        <button type="button" className="btn ghost" disabled={!modoConstrucao} onClick={onOrganizarAutomaticamente}>
          {traduzir("Organizar automaticamente")}
        </button>
        <button
          type="button"
          className={`btn ghost${entenderFluxoAtivo ? " active" : ""}`}
          title={traduzir("Numera os blocos na ordem em que acontecem e mostra uma explicação curta de cada um")}
          onClick={onAlternarEntenderFluxo}
        >
          {entenderFluxoAtivo ? (
            <>
              <IconCheck width={12} height={12} aria-hidden="true" /> {traduzir("Entender fluxo")}
            </>
          ) : (
            "Entender fluxo"
          )}
        </button>
        <button type="button" className="btn ghost" onClick={onAbrirHistorico}>
          {traduzir("Histórico de versões")}
        </button>
        <button type="button" className="btn ghost" onClick={onAbrirExecucoes}>
          {traduzir("Execuções")}
        </button>
        <button type="button" className="btn ghost" onClick={onTestar}>
          {traduzir("Testar")}
        </button>

        <div className="flow-toolbar-toggle" title={podeAtivar ? undefined : traduzir("Publique o fluxo pra poder ativar")}>
          <span className="tl">{ativa ? "Ativo" : "Pausado"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={ativa}
            aria-label={traduzir("Ativar ou pausar o fluxo")}
            className={`toggle${ativa ? " on" : ""}`}
            disabled={!podeAtivar}
            onClick={onToggleAtiva}
          >
            <span className="knob" />
          </button>
        </div>

        <button type="button" className="btn ghost" onClick={onSalvarRascunho}>
          {traduzir("Salvar rascunho")}
        </button>
        <button type="button" className="btn primary" onClick={onPublicar}>
          {traduzir("Publicar")}
        </button>
      </div>
    </header>
  );
}
