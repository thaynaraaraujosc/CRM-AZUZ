"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { classeOrigem, conversas, oportunidadesPerdidas, tarefas } from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { useFunis } from "@/lib/funis-context";
import { Topbar } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { gerarLinhaDoTempo, inferirEstadoCicloDeVida, type EstadoCicloDeVida } from "@/lib/timeline";

const CLASSE_ESTADO: Record<EstadoCicloDeVida, string> = {
  "Novo lead": "stage-tag",
  "Em atendimento": "stage-tag",
  "Em negociação": "stage-tag",
  Cliente: "stage-tag won",
  Perdido: "stage-tag",
};

export default function JornadaClientePage() {
  return (
    <Suspense fallback={null}>
      <JornadaClientePageInner />
    </Suspense>
  );
}

function JornadaClientePageInner() {
  const searchParams = useSearchParams();
  const { contatos } = useContatos();
  const { funis } = useFunis();
  const [selecionadoId, setSelecionadoId] = useState<string | null>(
    searchParams.get("contato"),
  );

  const contato = contatos.find((c) => c.id === selecionadoId) ?? null;
  const eventos = contato
    ? gerarLinhaDoTempo(contato.id, { contatos, conversas, tarefas, funis, oportunidadesPerdidas })
    : [];
  const estado = contato ? inferirEstadoCicloDeVida(contato, oportunidadesPerdidas) : null;

  return (
    <>
      <Topbar
        title="Jornada do cliente"
        sub="A jornada completa de um contato — desde a primeira entrada até a última interação — num só lugar"
      />

      <div className="content jornada-cliente">
        <div className="card mb14">
          <div className="panel-h">
            <h4>Escolha um contato</h4>
          </div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Origem</th>
                  <th>Etapa atual</th>
                  <th>Responsável</th>
                  <th>Última interação</th>
                </tr>
              </thead>
              <tbody>
                {contatos.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        type="button"
                        className="name-cell"
                        style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
                        onClick={() => setSelecionadoId((atual) => (atual === c.id ? null : c.id))}
                      >
                        <div className="avatar">{c.initials}</div>
                        <span
                          className="n"
                          style={{ color: selecionadoId === c.id ? "var(--blue)" : undefined }}
                        >
                          {c.nome}
                        </span>
                      </button>
                    </td>
                    <td>
                      <span className={`origin-tag ${classeOrigem(c.origem)}`}>{c.origem}</span>
                    </td>
                    <td>
                      <span className={`stage-tag${c.etapa === "Fechado" ? " won" : ""}`}>
                        {c.etapa}
                      </span>
                    </td>
                    <td>{c.responsavel}</td>
                    <td>{c.ultima}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {contato ? (
          <div className="card">
            <div className="panel-h">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="avatar">{contato.initials}</div>
                <div>
                  <h4 style={{ margin: 0 }}>{contato.nome}</h4>
                  <p className="hint" style={{ margin: 0 }}>
                    {contato.origem} · responsável: {contato.responsavel}
                  </p>
                </div>
              </div>
              {estado ? <span className={CLASSE_ESTADO[estado]}>{estado}</span> : null}
            </div>
            <div style={{ padding: 17 }}>
              <Timeline eventos={eventos} />
            </div>
          </div>
        ) : (
          <p className="hint">Selecione um contato acima pra ver a jornada completa dele.</p>
        )}
      </div>
    </>
  );
}
