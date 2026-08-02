"use client";

import { useState } from "react";

import {
  CATEGORIAS_TIMELINE,
  iconeCategoriaTimeline,
  type CategoriaEventoTimeline,
  type EventoTimeline,
} from "@/lib/timeline";

/**
 * Linha do tempo única, reutilizável — pensada pra ser o mesmo componente em
 * WhatsApp, Contato, Empresa, Negociação, Funil, Gestão de Atividade e
 * Relatórios (não um histórico próprio por tela). Só recebe `eventos` já
 * prontos; quem monta a lista decide de onde os dados vêm.
 */
export function Timeline({
  eventos,
  carregando = false,
  erro = null,
  onTentarNovamente,
  vazioTitulo = "Nada por aqui ainda",
  vazioDescricao = "Assim que algo acontecer, vai aparecer nessa linha do tempo.",
  mostrarFiltros = true,
}: {
  eventos: EventoTimeline[];
  carregando?: boolean;
  erro?: string | null;
  onTentarNovamente?: () => void;
  vazioTitulo?: string;
  vazioDescricao?: string;
  mostrarFiltros?: boolean;
}) {
  const [filtro, setFiltro] = useState<CategoriaEventoTimeline | "tudo">("tudo");

  const categoriasPresentes = new Set(eventos.map((e) => e.categoria));
  const eventosFiltrados =
    filtro === "tudo" ? eventos : eventos.filter((e) => e.categoria === filtro);

  if (erro) {
    return (
      <div className="timeline-estado">
        <p className="timeline-estado-titulo">Não deu pra carregar o histórico</p>
        <p className="timeline-estado-desc">{erro}</p>
        {onTentarNovamente ? (
          <button type="button" className="btn ghost" onClick={onTentarNovamente}>
            Tentar novamente
          </button>
        ) : null}
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="timeline-lista">
        {[1, 2, 3].map((i) => (
          <div className="timeline-item timeline-item-skeleton" key={i} aria-hidden="true">
            <span className="timeline-icone timeline-skeleton-bloco" />
            <span className="timeline-corpo">
              <span className="timeline-skeleton-linha" style={{ width: "60%" }} />
              <span className="timeline-skeleton-linha" style={{ width: "85%" }} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="timeline">
      {mostrarFiltros ? (
        <div className="filters-row timeline-filtros">
          <button
            type="button"
            className={`fchip${filtro === "tudo" ? " active" : ""}`}
            aria-pressed={filtro === "tudo"}
            onClick={() => setFiltro("tudo")}
          >
            Tudo
          </button>
          {CATEGORIAS_TIMELINE.filter((c) => categoriasPresentes.has(c.id)).map((c) => (
            <button
              type="button"
              key={c.id}
              className={`fchip${filtro === c.id ? " active" : ""}`}
              aria-pressed={filtro === c.id}
              onClick={() => setFiltro(c.id)}
            >
              {c.icone} {c.label}
            </button>
          ))}
        </div>
      ) : null}

      {eventosFiltrados.length === 0 ? (
        <div className="timeline-estado">
          <p className="timeline-estado-titulo">{vazioTitulo}</p>
          <p className="timeline-estado-desc">{vazioDescricao}</p>
        </div>
      ) : (
        <div className="timeline-lista">
          {eventosFiltrados.map((evento) => (
            <div className="timeline-item" key={evento.id}>
              <span
                className={`timeline-icone timeline-icone-${evento.categoria}`}
                aria-hidden="true"
              >
                {iconeCategoriaTimeline(evento.categoria)}
              </span>
              <span className="timeline-corpo">
                <span className="timeline-topo">
                  <span className="timeline-titulo">{evento.titulo}</span>
                  <span className="timeline-quando">{evento.quando}</span>
                </span>
                {evento.descricao ? (
                  <span className="timeline-descricao">{evento.descricao}</span>
                ) : null}
                <span className="timeline-meta">
                  {evento.responsavel ? <span>{evento.responsavel}</span> : null}
                  {evento.origem ? <span>{evento.origem}</span> : null}
                  {evento.aoAbrirDetalhes ? (
                    <button
                      type="button"
                      className="timeline-detalhes-btn"
                      onClick={evento.aoAbrirDetalhes}
                    >
                      Ver detalhes
                    </button>
                  ) : null}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
