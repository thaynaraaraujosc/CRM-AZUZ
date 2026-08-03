"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { EVENTO_CATEGORIA, type CategoriaEvento, type Evento } from "@/lib/timeline";
import { classeOrigem } from "@/lib/data";

const ICONE_CATEGORIA: Record<CategoriaEvento, string> = {
  Conversas: "💬",
  Atividades: "✅",
  Funil: "📍",
  Automações: "⚙️",
  Negociações: "🤝",
  Compras: "💰",
  Documentos: "📄",
  Anotações: "📝",
};

/**
 * Linha do tempo unificada — usada dentro do painel de um contato, de uma
 * negociação, ou na tela "Jornada do cliente". Sempre recebe eventos já
 * derivados (ver `gerarLinhaDoTempo` em `src/lib/timeline.ts`), nunca gera
 * dado próprio. Cada evento com `link` abre a origem (conversa, tarefa,
 * funil...), como pedido na seção 3/14 do escopo: todo evento tem que levar
 * pra onde ele aconteceu de verdade. O filtro é por categoria (Conversas,
 * Atividades, Funil, Automações, Negociações, Compras, Documentos,
 * Anotações), a mesma usada no relatório da jornada.
 */
export function Timeline({ eventos }: { eventos: Evento[] }) {
  const [filtro, setFiltro] = useState<CategoriaEvento | "todos">("todos");

  const categoriasPresentes = useMemo(() => {
    const s = new Set<CategoriaEvento>();
    eventos.forEach((e) => s.add(EVENTO_CATEGORIA[e.tipo]));
    return Array.from(s);
  }, [eventos]);

  const filtrados = useMemo(
    () => (filtro === "todos" ? eventos : eventos.filter((e) => EVENTO_CATEGORIA[e.tipo] === filtro)),
    [eventos, filtro],
  );

  if (eventos.length === 0) {
    return <p className="timeline-empty">Ainda não há eventos registrados para esse contato.</p>;
  }

  return (
    <div>
      {categoriasPresentes.length > 1 ? (
        <div className="timeline-filtros">
          <button
            type="button"
            className={`fchip${filtro === "todos" ? " active" : ""}`}
            onClick={() => setFiltro("todos")}
          >
            Tudo
          </button>
          {categoriasPresentes.map((cat) => (
            <button
              type="button"
              key={cat}
              className={`fchip${filtro === cat ? " active" : ""}`}
              onClick={() => setFiltro(cat)}
            >
              {ICONE_CATEGORIA[cat]} {cat}
            </button>
          ))}
        </div>
      ) : null}

      <div className="timeline">
        {filtrados.map((evento) => (
          <TimelineItem key={evento.id} evento={evento} />
        ))}
      </div>
    </div>
  );
}

function TimelineItem({ evento }: { evento: Evento }) {
  const categoria = EVENTO_CATEGORIA[evento.tipo];
  const conteudo = (
    <>
      <div className="timeline-card-top">
        <span className="timeline-card-titulo">
          <span aria-hidden="true">{ICONE_CATEGORIA[categoria]}</span> {evento.titulo}
        </span>
        <span className="timeline-card-quando">{evento.quando}</span>
      </div>
      {evento.descricao ? <p className="timeline-card-desc">{evento.descricao}</p> : null}
      {evento.origem || evento.responsavel ? (
        <div className="timeline-card-meta">
          {evento.origem ? (
            <span className={`origin-tag ${classeOrigem(evento.origem)}`}>{evento.origem}</span>
          ) : null}
          {evento.responsavel ? <span>Responsável: {evento.responsavel}</span> : null}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="timeline-item">
      <span className="timeline-dot" />
      {evento.link ? (
        <Link href={evento.link.href} className="timeline-card">
          {conteudo}
        </Link>
      ) : (
        <div className="timeline-card">{conteudo}</div>
      )}
    </div>
  );
}
