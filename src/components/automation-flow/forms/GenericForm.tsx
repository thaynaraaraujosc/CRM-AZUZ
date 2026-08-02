"use client";

import { equipe } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import type { FlowNode } from "@/lib/automation-flow/types";

/** Rótulo amigável a partir do nome da chave (`etapaTitulo` -> "Etapa titulo"). */
function rotuloDaChave(chave: string): string {
  const comEspacos = chave.replace(/([A-Z])/g, " $1").toLowerCase();
  return comEspacos.charAt(0).toUpperCase() + comEspacos.slice(1);
}

const CHAVES_FUNIL = new Set(["funilId"]);
const CHAVES_ETAPA_TITULO = new Set(["etapaTitulo"]);
const CHAVES_ETAPA_ID = new Set(["etapaId"]);
const CHAVES_ATENDENTE = new Set(["atendenteNome", "responsavel"]);
const CHAVES_UNIDADE_TEMPO = new Set(["tempoUnidade", "prazoUnidade"]);
const CHAVES_TEXTAREA = new Set(["payload", "observacao", "motivo"]);
const CHAVES_OCULTAS = new Set(["variaveis", "candidatos", "anexos", "variaveisUsadas"]);

/**
 * Fallback genérico pros ~40 tipos de nó sem formulário dedicado — reflete
 * sobre as chaves já presentes em `node.data` (nunca some/aparece campo à
 * toa: o conjunto de chaves vem de `dataPadrao()` no momento em que o bloco
 * foi criado) e escolhe o melhor controle pra cada uma por heurística de nome/tipo.
 */
export function GenericForm({ node, onChange }: { node: FlowNode; onChange: (data: Record<string, unknown>) => void }) {
  const { funis } = useFunis();
  const d = node.data as Record<string, unknown>;
  const chaves = Object.keys(d);

  function set(chave: string, valor: unknown) {
    onChange({ ...d, [chave]: valor });
  }

  if (chaves.length === 0) {
    return <p className="hint">Esse bloco não tem opções — só o título/observação, ali em cima.</p>;
  }

  const funilEscolhidoId = typeof d.funilId === "string" ? d.funilId : undefined;
  const funilEscolhido = funis.find((f) => f.id === funilEscolhidoId);

  return (
    <div className="flow-form">
      {chaves.map((chave) => {
        if (CHAVES_OCULTAS.has(chave)) return null;
        const valor = d[chave];

        if (CHAVES_FUNIL.has(chave)) {
          return (
            <div className="field" key={chave}>
              <label>Funil</label>
              <select className="input" value={typeof valor === "string" ? valor : ""} onChange={(e) => set(chave, e.target.value)}>
                <option value="">Selecione um funil…</option>
                {funis.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (CHAVES_ETAPA_TITULO.has(chave)) {
          return (
            <div className="field" key={chave}>
              <label>Etapa</label>
              <select className="input" value={typeof valor === "string" ? valor : ""} onChange={(e) => set(chave, e.target.value)} disabled={!funilEscolhido}>
                <option value="">{funilEscolhido ? "Selecione uma etapa…" : "Escolha um funil primeiro"}</option>
                {(funilEscolhido?.colunas ?? []).map((c) => (
                  <option key={c.id} value={c.titulo}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (CHAVES_ETAPA_ID.has(chave)) {
          return (
            <div className="field" key={chave}>
              <label>Etapa</label>
              <select className="input" value={typeof valor === "string" ? valor : ""} onChange={(e) => set(chave, e.target.value)} disabled={!funilEscolhido}>
                <option value="">{funilEscolhido ? "Qualquer etapa" : "Escolha um funil primeiro"}</option>
                {(funilEscolhido?.colunas ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (CHAVES_ATENDENTE.has(chave)) {
          return (
            <div className="field" key={chave}>
              <label>{rotuloDaChave(chave)}</label>
              <select className="input" value={typeof valor === "string" ? valor : ""} onChange={(e) => set(chave, e.target.value)}>
                <option value="">Selecione…</option>
                {equipe.map((m) => (
                  <option key={m.nome} value={m.nome}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (CHAVES_UNIDADE_TEMPO.has(chave)) {
          return (
            <div className="field" key={chave}>
              <label>{rotuloDaChave(chave)}</label>
              <select className="input" value={typeof valor === "string" ? valor : "horas"} onChange={(e) => set(chave, e.target.value)}>
                <option value="minutos">Minutos</option>
                <option value="horas">Horas</option>
                <option value="dias">Dias</option>
              </select>
            </div>
          );
        }

        if (typeof valor === "boolean") {
          return (
            <div className="toggle-row" key={chave}>
              <span className="tl">{rotuloDaChave(chave)}</span>
              <button
                type="button"
                role="switch"
                aria-checked={valor}
                aria-label={rotuloDaChave(chave)}
                className={`toggle${valor ? " on" : ""}`}
                onClick={() => set(chave, !valor)}
              >
                <span className="knob" />
              </button>
            </div>
          );
        }

        if (typeof valor === "number") {
          return (
            <div className="field" key={chave}>
              <label>{rotuloDaChave(chave)}</label>
              <input className="input" type="number" value={valor} onChange={(e) => set(chave, Number(e.target.value) || 0)} />
            </div>
          );
        }

        if (valor !== null && typeof valor === "object") {
          // Estrutura aninhada (ex.: `tempoMaximo`, `variaveis`) — sem editor dedicado nesse fallback genérico.
          return (
            <p className="hint" key={chave}>
              &quot;{rotuloDaChave(chave)}&quot; tem uma estrutura própria, sem edição nesse formulário genérico.
            </p>
          );
        }

        return (
          <div className="field" key={chave}>
            <label>{rotuloDaChave(chave)}</label>
            {CHAVES_TEXTAREA.has(chave) ? (
              <textarea
                className="input"
                style={{ width: "100%", minHeight: 60, resize: "vertical" }}
                value={typeof valor === "string" ? valor : ""}
                onChange={(e) => set(chave, e.target.value)}
              />
            ) : (
              <input className="input" value={typeof valor === "string" ? valor : ""} onChange={(e) => set(chave, e.target.value)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
