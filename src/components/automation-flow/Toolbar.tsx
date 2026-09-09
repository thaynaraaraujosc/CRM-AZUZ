"use client";

import Link from "next/link";
import { useState } from "react";
import { IconCheck } from "@/components/icons";

export function Toolbar({
  nome,
  onChangeNome,
  status,
  salvando,
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
  const [editandoNome, setEditandoNome] = useState(false);

  return (
    <header className="flow-toolbar">
      <div className="flow-toolbar-esq">
        <Link href="/automacoes" className="icon-btn subtle" aria-label="Voltar pra lista de automações">
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
            aria-label="Nome do fluxo"
          />
        ) : (
          <button type="button" className="flow-toolbar-nome" onClick={() => setEditandoNome(true)}>
            {nome || "Sem nome"}
          </button>
        )}

        <span className={`pill${status === "publicado" ? " on" : ""}`}>{status === "publicado" ? "Publicado" : "Rascunho"}</span>
        <span className="flow-save-indicator">{salvando ? "Salvando…" : "Todas as alterações foram salvas"}</span>
      </div>

      <div className="flow-toolbar-dir">
        <div className="flow-toolbar-modo" role="tablist" aria-label="Modo do editor">
          <button
            type="button"
            role="tab"
            aria-selected={modoConstrucao}
            className={`flow-toolbar-modo-btn${modoConstrucao ? " active" : ""}`}
            onClick={() => !modoConstrucao && onAlternarModo()}
          >
            Construir
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modoPassos}
            className={`flow-toolbar-modo-btn${modoPassos ? " active" : ""}`}
            title="Ler a automação como uma lista de passos, na ordem em que a pessoa é atendida"
            onClick={() => onModoPassos(!modoPassos)}
          >
            Passos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!modoConstrucao}
            className={`flow-toolbar-modo-btn${!modoConstrucao ? " active" : ""}`}
            title="Revisar o fluxo sem risco de mexer em nada sem querer"
            onClick={() => modoConstrucao && onAlternarModo()}
          >
            Visualizar
          </button>
        </div>
        <button type="button" className="icon-btn subtle" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!podeDesfazer || !modoConstrucao} onClick={onUndo}>
          ↶
        </button>
        <button type="button" className="icon-btn subtle" aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={!podeRefazer || !modoConstrucao} onClick={onRedo}>
          ↷
        </button>
        <button type="button" className="btn ghost" disabled={!modoConstrucao} onClick={onOrganizarAutomaticamente}>
          Organizar automaticamente
        </button>
        <button
          type="button"
          className={`btn ghost${entenderFluxoAtivo ? " active" : ""}`}
          title="Numera os blocos na ordem em que acontecem e mostra uma explicação curta de cada um"
          onClick={onAlternarEntenderFluxo}
        >
          {entenderFluxoAtivo ? (
            <>
              <IconCheck width={12} height={12} aria-hidden="true" /> Entender fluxo
            </>
          ) : (
            "Entender fluxo"
          )}
        </button>
        <button type="button" className="btn ghost" onClick={onAbrirHistorico}>
          Histórico de versões
        </button>
        <button type="button" className="btn ghost" onClick={onAbrirExecucoes}>
          Execuções
        </button>
        <button type="button" className="btn ghost" onClick={onTestar}>
          Testar
        </button>

        <div className="flow-toolbar-toggle" title={podeAtivar ? undefined : "Publique o fluxo pra poder ativar"}>
          <span className="tl">{ativa ? "Ativo" : "Pausado"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={ativa}
            aria-label="Ativar ou pausar o fluxo"
            className={`toggle${ativa ? " on" : ""}`}
            disabled={!podeAtivar}
            onClick={onToggleAtiva}
          >
            <span className="knob" />
          </button>
        </div>

        <button type="button" className="btn ghost" onClick={onSalvarRascunho}>
          Salvar rascunho
        </button>
        <button type="button" className="btn primary" onClick={onPublicar}>
          Publicar
        </button>
      </div>
    </header>
  );
}
