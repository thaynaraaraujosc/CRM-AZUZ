"use client";

import { useState } from "react";

import { ETAPAS_PADRAO_FUNIL, funis as funisIniciais } from "@/lib/data";
import type { Funil } from "@/lib/data";
import { ChipFilters, Topbar } from "@/components/ui";

const FILTROS_ORIGEM = [
  "Todas as origens",
  "Instagram",
  "TikTok",
  "Meta Ads",
  "Google Ads",
  "Indicação",
];

function cloneFunis(lista: Funil[]): Funil[] {
  return lista.map((f) => ({
    ...f,
    colunas: f.colunas.map((c) => ({ ...c, cards: [...c.cards] })),
  }));
}

export default function FunilPage() {
  const [funis, setFunis] = useState<Funil[]>(() => cloneFunis(funisIniciais));
  const [funilAtivoId, setFunilAtivoId] = useState(funisIniciais[0]?.id ?? "");
  const [novoFunilAberto, setNovoFunilAberto] = useState(false);
  const [nomeNovoFunil, setNomeNovoFunil] = useState("");
  const [origemFiltro, setOrigemFiltro] = useState("Todas as origens");
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [arrastando, setArrastando] = useState<{
    coluna: number;
    card: number;
  } | null>(null);

  const funilAtivo = funis.find((f) => f.id === funilAtivoId) ?? funis[0];

  function passaNoFiltro(card: { origem: string; data: string }) {
    if (origemFiltro !== "Todas as origens" && card.origem !== origemFiltro) {
      return false;
    }
    if (dataDe && card.data < dataDe) return false;
    if (dataAte && card.data > dataAte) return false;
    return true;
  }

  const filtroAtivo =
    origemFiltro !== "Todas as origens" || dataDe !== "" || dataAte !== "";

  const totalVisivel =
    funilAtivo?.colunas.reduce((soma, coluna) => {
      const cards = filtroAtivo
        ? coluna.cards.filter(passaNoFiltro)
        : coluna.cards;
      return soma + (filtroAtivo ? cards.length : coluna.total);
    }, 0) ?? 0;

  function criarFunil() {
    const nome = nomeNovoFunil.trim();
    if (!nome) return;
    const novo: Funil = {
      id: `funil-${Date.now()}`,
      nome,
      colunas: ETAPAS_PADRAO_FUNIL.map((titulo) => ({
        titulo,
        total: 0,
        cards: [],
      })),
    };
    setFunis((prev) => [...prev, novo]);
    setFunilAtivoId(novo.id);
    setNomeNovoFunil("");
    setNovoFunilAberto(false);
  }

  function moverCard(colunaDestino: number) {
    if (!arrastando || !funilAtivo) return;
    const { coluna: colunaOrigem, card: indiceCard } = arrastando;
    setArrastando(null);
    if (colunaOrigem === colunaDestino) return;

    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c) => ({ ...c, cards: [...c.cards] }));
        const [card] = colunas[colunaOrigem].cards.splice(indiceCard, 1);
        if (!card) return f;
        colunas[colunaOrigem].total = Math.max(0, colunas[colunaOrigem].total - 1);
        colunas[colunaDestino].cards.push(card);
        colunas[colunaDestino].total += 1;
        return { ...f, colunas };
      }),
    );
  }

  return (
    <>
      <Topbar
        title="Funil"
        sub={`${funilAtivo?.nome ?? ""} · ${totalVisivel} ${totalVisivel === 1 ? "negócio" : "negócios"} ${filtroAtivo ? (totalVisivel === 1 ? "encontrado" : "encontrados") : "no funil"}`}
        actions={
          <>
            <select
              className="fsel"
              value={funilAtivoId}
              onChange={(e) => setFunilAtivoId(e.target.value)}
              style={{ cursor: "pointer" }}
            >
              {funis.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setNovoFunilAberto((v) => !v)}
            >
              {novoFunilAberto ? "Cancelar" : "+ Novo funil"}
            </button>
            <button
              type="button"
              className={`btn ${filtroAberto || filtroAtivo ? "primary" : "ghost"}`}
              onClick={() => setFiltroAberto((v) => !v)}
            >
              {filtroAberto ? "Fechar filtro" : "+ Filtrar"}
            </button>
          </>
        }
      />

      <div className="content">
        {novoFunilAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Novo funil</p>
                <p className="s">
                  Já entra com o modelo pronto: Novo, Qualificado, Não
                  respondeu, Proposta, Fechado
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovoFunilAberto(false)}
              >
                Fechar ✕
              </span>
            </div>
            <div className="field">
              <label>Nome do funil</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNovoFunil}
                onChange={(e) => setNomeNovoFunil(e.target.value)}
                placeholder="Ex.: Ortodontia · avaliação gratuita"
                onKeyDown={(e) => {
                  if (e.key === "Enter") criarFunil();
                }}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarFunil}
              >
                Criar funil
              </button>
            </div>
          </section>
        ) : null}

        {filtroAberto ? (
          <section className="card mb14">
            <div className="panel-h">
              <h4>Filtrar — qual origem e qual período</h4>
            </div>
            <div className="field">
              <label>Origem do lead</label>
              <ChipFilters
                options={FILTROS_ORIGEM}
                initial={FILTROS_ORIGEM.indexOf(origemFiltro)}
                onChange={(opcao) => setOrigemFiltro(opcao)}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                padding: "0 17px 14px",
                flexWrap: "wrap",
                alignItems: "flex-end",
              }}
            >
              <div className="field" style={{ padding: 0, flex: "1 1 160px" }}>
                <label>De</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  type="date"
                  value={dataDe}
                  onChange={(e) => setDataDe(e.target.value)}
                />
              </div>
              <div className="field" style={{ padding: 0, flex: "1 1 160px" }}>
                <label>Até</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  type="date"
                  value={dataAte}
                  onChange={(e) => setDataAte(e.target.value)}
                />
              </div>
              {filtroAtivo ? (
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setOrigemFiltro("Todas as origens");
                    setDataDe("");
                    setDataAte("");
                  }}
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="kanban">
          {funilAtivo?.colunas.map((coluna, colIndex) => {
            const cardsComIndice = coluna.cards.map((card, cardIndex) => ({
              card,
              cardIndex,
            }));
            const cardsVisiveis = filtroAtivo
              ? cardsComIndice.filter(({ card }) => passaNoFiltro(card))
              : cardsComIndice;

            return (
              <div
                key={coluna.titulo}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  moverCard(colIndex);
                }}
                style={{ minHeight: 60 }}
              >
                <div className="kcol-h">
                  <span className="t">
                    <span className="dot" />
                    {coluna.titulo}
                  </span>
                  <span className="c">
                    {filtroAtivo ? cardsVisiveis.length : coluna.total}
                  </span>
                </div>
                {cardsVisiveis.map(({ card, cardIndex }) => (
                  <button
                    type="button"
                    className="lead-card"
                    key={card.id}
                    draggable
                    onDragStart={() =>
                      setArrastando({ coluna: colIndex, card: cardIndex })
                    }
                    onDragEnd={() => setArrastando(null)}
                    style={{ cursor: "grab" }}
                  >
                    <span className="lr1">
                      <span className="lname">{card.nome}</span>
                      <span className="lval">{card.valor}</span>
                    </span>
                    <span className="lr2">
                      <span className="tag">{card.origem}</span>
                      <span className="days">{card.dias}</span>
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
