"use client";

import { useState } from "react";

import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { useIntegracaoMeta } from "./useIntegracaoMeta";

const GATILHOS = ["receber mensagem", "receber comentário com palavra-chave", "preencher formulário", "responder story"];

/** Instagram e Facebook (item 29) — o card de conexão no topo é real (OAuth com a Meta); o
 * construtor visual de "quando X, fazer Y" abaixo continua só front-end (a automação em si ainda
 * não está ligada às mensagens/comentários reais recebidos). */
export function InstagramSecao() {
  const { membros: equipe } = useEquipe();
  const { funis } = useFunis();
  const { integracao, desconectando, desconectar, erroDoRedirect } = useIntegracaoMeta("meta_instagram");
  const [gatilho, setGatilho] = useState(GATILHOS[1]);
  const [palavraChave, setPalavraChave] = useState("QUERO");
  const [funil, setFunil] = useState(funis[0]?.nome ?? "");
  const [etapa, setEtapa] = useState(funis[0]?.colunas[0]?.titulo ?? "");
  const [etiqueta, setEtiqueta] = useState("Instagram");
  const [equipeResp, setEquipeResp] = useState(equipe[0]?.nome ?? "");

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Instagram e Facebook" descricao="Comentários, mensagens diretas e formulários de leads." />

      {erroDoRedirect ? (
        <p className="hint" style={{ color: "var(--danger)", marginBottom: 10 }}>
          ⚠ Não foi possível conectar: {erroDoRedirect}
        </p>
      ) : null}

      <div className="card" style={{ padding: 14, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="int-title" style={{ margin: 0 }}>Instagram (API oficial da Meta)</p>
          {integracao?.status === "conectado" ? (
            <p className="int-sub" style={{ margin: "4px 0 0" }}>
              Conectado — @{(integracao.metadados?.instagramUsername as string | undefined) ?? "conta não identificada"}
            </p>
          ) : integracao?.status === "erro" ? (
            <p className="int-sub" style={{ margin: "4px 0 0", color: "var(--danger)" }}>
              Erro na última tentativa: {integracao.erroMensagem}
            </p>
          ) : (
            <p className="int-sub" style={{ margin: "4px 0 0" }}>Ainda não conectado.</p>
          )}
        </div>
        {integracao?.status === "conectado" ? (
          <button type="button" className="btn danger" onClick={desconectar} disabled={desconectando}>
            {desconectando ? "Desconectando…" : "Desconectar"}
          </button>
        ) : (
          <a className="btn primary" href="/api/integracoes/meta/conectar?provedor=meta_instagram">
            Conectar com a Meta
          </a>
        )}
      </div>

      <div className="config-bloco">
        <p className="hint mb14">
          ⓘ As regras abaixo ainda são só uma prévia visual — receber mensagem direta já funciona de
          verdade (assim que a conta estiver conectada); comentário/story/formulário ainda são mockados.
        </p>
        <p className="config-bloco-titulo">Criar contato quando</p>
        <div className="filters-row mb14">
          {GATILHOS.map((g) => (
            <button type="button" key={g} className={`fchip${gatilho === g ? " active" : ""}`} onClick={() => setGatilho(g)}>
              {g}
            </button>
          ))}
        </div>

        {gatilho === "receber comentário com palavra-chave" ? (
          <div className="field">
            <label>Palavra-chave</label>
            <input className="input" value={palavraChave} onChange={(e) => setPalavraChave(e.target.value)} />
          </div>
        ) : null}

        <div className="config-grid-2">
          <div className="field">
            <label>Funil</label>
            <select className="input" value={funil} onChange={(e) => setFunil(e.target.value)}>
              {funis.map((f) => (
                <option key={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Etapa</label>
            <select className="input" value={etapa} onChange={(e) => setEtapa(e.target.value)}>
              {funis.find((f) => f.nome === funil)?.colunas.map((c) => (
                <option key={c.id}>{c.titulo}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Etiqueta</label>
            <input className="input" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} />
          </div>
          <div className="field">
            <label>Equipe</label>
            <select className="input" value={equipeResp} onChange={(e) => setEquipeResp(e.target.value)}>
              {equipe.map((m) => (
                <option key={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="config-exemplo-visual">
          Quando alguém {gatilho === "receber comentário com palavra-chave" ? `comentar "${palavraChave}"` : gatilho}, criar contato, adicionar
          etiqueta <strong>{etiqueta}</strong> e mover pra etapa <strong>{etapa}</strong> do funil <strong>{funil}</strong>, com a equipe{" "}
          <strong>{equipeResp}</strong> responsável.
        </div>
      </div>
    </div>
  );
}
