"use client";

import { useState } from "react";

import { equipe, funis } from "@/lib/data";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

const GATILHOS = ["receber mensagem", "receber comentário com palavra-chave", "preencher formulário", "responder story"];

/** Instagram e Facebook (item 29) — construtor visual simples de "quando X, fazer Y", só front-end
 * (nenhuma conta é conectada de verdade). */
export function InstagramSecao() {
  const [gatilho, setGatilho] = useState(GATILHOS[1]);
  const [palavraChave, setPalavraChave] = useState("QUERO");
  const [funil, setFunil] = useState(funis[0]?.nome ?? "");
  const [etapa, setEtapa] = useState(funis[0]?.colunas[0]?.titulo ?? "");
  const [etiqueta, setEtiqueta] = useState("Instagram");
  const [equipeResp, setEquipeResp] = useState(equipe[0]?.nome ?? "");

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Instagram e Facebook" descricao="Comentários, mensagens diretas e formulários de leads." />

      <div className="config-bloco">
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
                <option key={m.nome}>{m.nome}</option>
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
