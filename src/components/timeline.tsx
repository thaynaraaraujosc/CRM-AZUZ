"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { EVENTO_CATEGORIA, type CategoriaEvento, type Evento } from "@/lib/timeline";
import { classeOrigem } from "@/lib/data";
import {
  IconAperto,
  IconAutomacoes,
  IconCheck,
  IconConversas,
  IconDoc,
  IconLocalizacao,
  IconMoeda,
  IconText,
} from "@/components/icons";

const ICONE_CATEGORIA: Record<CategoriaEvento, typeof IconConversas> = {
  Conversas: IconConversas,
  Atividades: IconCheck,
  Funil: IconLocalizacao,
  Automações: IconAutomacoes,
  Negociações: IconAperto,
  Compras: IconMoeda,
  Documentos: IconDoc,
  Anotações: IconText,
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
          {categoriasPresentes.map((cat) => {
            const IconeCategoria = ICONE_CATEGORIA[cat];
            return (
              <button
                type="button"
                key={cat}
                className={`fchip${filtro === cat ? " active" : ""}`}
                onClick={() => setFiltro(cat)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <IconeCategoria width={12} height={12} /> {cat}
              </button>
            );
          })}
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
  const IconeCategoria = ICONE_CATEGORIA[categoria];
  const conteudo = (
    <>
      <div className="timeline-card-top">
        <span className="timeline-card-titulo">
          <span aria-hidden="true" style={{ display: "inline-flex" }}><IconeCategoria width={13} height={13} /></span> {evento.titulo}
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
