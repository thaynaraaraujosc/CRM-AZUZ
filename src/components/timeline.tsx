"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { EVENTO_CATEGORIA, type CategoriaEvento, type Evento } from "@/lib/timeline";
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

/**
 * Um evento da linha do tempo.
 *
 * Era um card por evento — a lista virava uma pilha de caixas e a cronologia, que é o assunto da
 * tela, ficava escondida atrás delas. Agora o que estrutura é a própria linha: marcador com o
 * ícone da categoria, fio fino descendo, e o texto solto ao lado. Sem borda, sem fundo, sem
 * sombra. Quem tem link continua clicável — o realce vira fundo sutil, não card levantando.
 */
function TimelineItem({ evento }: { evento: Evento }) {
  const categoria = EVENTO_CATEGORIA[evento.tipo];
  const IconeCategoria = ICONE_CATEGORIA[categoria];

  // Responsável · quando · origem numa linha só de metadado. `filter` porque evento sem
  // responsável ou sem origem deixaria um separador solto no fim.
  const meta = [evento.responsavel, evento.quando, evento.origem].filter(Boolean);

  const conteudo = (
    <>
      <span className="timeline-titulo">{evento.titulo}</span>
      {evento.descricao ? <span className="timeline-desc">{evento.descricao}</span> : null}
      {meta.length > 0 ? <span className="timeline-meta">{meta.join(" · ")}</span> : null}
    </>
  );

  return (
    <div className="timeline-item">
      <span className="timeline-marcador" aria-hidden="true">
        <IconeCategoria width={13} height={13} />
      </span>
      {evento.link ? (
        <Link href={evento.link.href} className="timeline-conteudo">
          {conteudo}
        </Link>
      ) : (
        <div className="timeline-conteudo">{conteudo}</div>
      )}
    </div>
  );
}
