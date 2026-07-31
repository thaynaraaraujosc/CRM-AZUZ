"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { equipe, type NegocioCard } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import { IconConfiguracoes } from "@/components/icons";
import { ChipFilters, Topbar } from "@/components/ui";

const ORIGENS_NEGOCIO: NegocioCard["origem"][] = [
  "Instagram",
  "TikTok",
  "Meta Ads",
  "Google Ads",
  "Indicação",
];

/** Mesmo dia de referência usado em todo o app (ver `today` em lib/data.ts). */
const HOJE_ISO = "2026-07-30";

export default function FunilPage() {
  return (
    <Suspense fallback={null}>
      <FunilPageInner />
    </Suspense>
  );
}

function FunilPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { funis, setFunis, funilAtivoId, setFunilAtivoId, excluirFunil } =
    useFunis();
  const [configAberto, setConfigAberto] = useState(false);

  const [novoFunilAberto, setNovoFunilAberto] = useState(false);
  const [atendenteNovoFunil, setAtendenteNovoFunil] = useState(
    equipe[0]?.nome ?? "",
  );
  const [novoNegocioAberto, setNovoNegocioAberto] = useState(
    () => searchParams.get("criarNegocio") === "1",
  );
  const [nomeNegocio, setNomeNegocio] = useState("");
  const [valorNegocio, setValorNegocio] = useState("");
  const [origemNegocio, setOrigemNegocio] = useState<NegocioCard["origem"]>(
    ORIGENS_NEGOCIO[0],
  );
  const [origensFiltro, setOrigensFiltro] = useState<Set<string>>(new Set());
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [arrastando, setArrastando] = useState<{
    coluna: number;
    card: number;
  } | null>(null);
  const [novaEtapaAberta, setNovaEtapaAberta] = useState(false);
  const [nomeNovaEtapa, setNomeNovaEtapa] = useState("");
  const [colunaRenomeando, setColunaRenomeando] = useState<number | null>(null);
  const [nomeRenomeando, setNomeRenomeando] = useState("");

  const funilAtivo = funis.find((f) => f.id === funilAtivoId) ?? funis[0];

  function passaNoFiltro(card: { origem: string; data: string }) {
    if (origensFiltro.size > 0 && !origensFiltro.has(card.origem)) {
      return false;
    }
    if (dataDe && card.data < dataDe) return false;
    if (dataAte && card.data > dataAte) return false;
    return true;
  }

  function alternarOrigemFiltro(origem: string) {
    setOrigensFiltro((prev) => {
      const next = new Set(prev);
      if (next.has(origem)) next.delete(origem);
      else next.add(origem);
      return next;
    });
  }

  const filtroAtivo = origensFiltro.size > 0 || dataDe !== "" || dataAte !== "";

  const totalVisivel =
    funilAtivo?.colunas.reduce((soma, coluna) => {
      const cards = filtroAtivo
        ? coluna.cards.filter(passaNoFiltro)
        : coluna.cards;
      return soma + (filtroAtivo ? cards.length : coluna.total);
    }, 0) ?? 0;

  function criarFunil() {
    const responsavel = atendenteNovoFunil.trim();
    if (!responsavel) return;
    const novo = {
      id: `funil-${Date.now()}`,
      nome: `Funil - ${responsavel}`,
      responsavel,
      colunas: [
        { titulo: "Novo", total: 0, cards: [] },
        { titulo: "Qualificado", total: 0, cards: [] },
        { titulo: "Proposta", total: 0, cards: [] },
        { titulo: "Fechado", total: 0, cards: [] },
      ],
    };
    setFunis((prev) => [...prev, novo]);
    setFunilAtivoId(novo.id);
    setAtendenteNovoFunil(equipe[0]?.nome ?? "");
    setNovoFunilAberto(false);
  }

  function criarNegocio() {
    const nome = nomeNegocio.trim();
    if (!nome || !funilAtivo) return;
    const novoCard: NegocioCard = {
      id: `negocio-${Date.now()}`,
      nome,
      valor: valorNegocio.trim() || "—",
      origem: origemNegocio,
      dias: "Hoje",
      data: HOJE_ISO,
    };
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c) => ({ ...c, cards: [...c.cards] }));
        colunas[0].cards.push(novoCard);
        colunas[0].total += 1;
        return { ...f, colunas };
      }),
    );
    setNomeNegocio("");
    setValorNegocio("");
    setOrigemNegocio(ORIGENS_NEGOCIO[0]);
    setNovoNegocioAberto(false);
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

  function criarEtapa() {
    const titulo = nomeNovaEtapa.trim();
    if (!titulo || !funilAtivo) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        return {
          ...f,
          colunas: [...f.colunas, { titulo, total: 0, cards: [] }],
        };
      }),
    );
    setNomeNovaEtapa("");
    setNovaEtapaAberta(false);
  }

  function renomearEtapa(colIndex: number) {
    const titulo = nomeRenomeando.trim();
    if (!titulo || !funilAtivo) {
      setColunaRenomeando(null);
      return;
    }
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        const colunas = f.colunas.map((c, i) =>
          i === colIndex ? { ...c, titulo } : c,
        );
        return { ...f, colunas };
      }),
    );
    setColunaRenomeando(null);
  }

  function excluirEtapa(colIndex: number) {
    if (!funilAtivo) return;
    setFunis((prev) =>
      prev.map((f) => {
        if (f.id !== funilAtivo.id) return f;
        return { ...f, colunas: f.colunas.filter((_, i) => i !== colIndex) };
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
            <button
              type="button"
              className="btn ghost"
              onClick={() => setNovaEtapaAberta((v) => !v)}
            >
              {novaEtapaAberta ? "Cancelar" : "+ Criar nova etapa"}
            </button>
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
            {funilAtivo ? (
              <div className="dropdown-anchor">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Configurações do funil ${funilAtivo.nome}`}
                  onClick={() => setConfigAberto((v) => !v)}
                >
                  <IconConfiguracoes />
                </button>
                {configAberto ? (
                  <>
                    <div
                      onClick={() => setConfigAberto(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 50 }}
                    />
                    <div className="dropdown-pop dropdown-pop-right">
                      <Link
                        href={`/automacoes?criarPara=${funilAtivo.id}`}
                        className="dropdown-item"
                        onClick={() => setConfigAberto(false)}
                      >
                        <span className="n">Criar automação pra esse funil</span>
                        <span className="r">Abre o construtor em Automações</span>
                      </Link>
                      <button
                        type="button"
                        className="dropdown-item"
                        style={{ width: "100%", textAlign: "left" }}
                        disabled={funis.length <= 1}
                        onClick={() => {
                          if (funis.length <= 1) return;
                          if (
                            window.confirm(
                              `Excluir o funil "${funilAtivo.nome}"? Os negócios dele somem junto.`,
                            )
                          ) {
                            excluirFunil(funilAtivo.id);
                          }
                          setConfigAberto(false);
                        }}
                      >
                        <span className="n">Excluir funil</span>
                        <span className="r">
                          {funis.length <= 1
                            ? "Precisa ter pelo menos um funil"
                            : "Remove esse funil e os negócios dele"}
                        </span>
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </>
        }
      />

      <div className="content">
        {novaEtapaAberta ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Nova etapa</p>
                <p className="s">
                  Entra como uma coluna nova no funil {funilAtivo?.nome}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovaEtapaAberta(false)}
              >
                Fechar ✕
              </span>
            </div>
            <div className="field">
              <label>Nome da etapa</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNovaEtapa}
                onChange={(e) => setNomeNovaEtapa(e.target.value)}
                placeholder="Ex.: Retorno agendado"
                onKeyDown={(e) => {
                  if (e.key === "Enter") criarEtapa();
                }}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarEtapa}
              >
                Criar etapa
              </button>
            </div>
          </section>
        ) : null}

        {novoFunilAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Novo funil</p>
                <p className="s">
                  Cada funil pertence a um atendente — as mensagens e tarefas
                  atribuídas a ele entram nesse funil. Já sai com o modelo
                  pronto: Novo, Qualificado, Proposta, Fechado.
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
              <label>Atendente responsável</label>
              <select
                className="input"
                style={{ width: "100%", cursor: "pointer" }}
                value={atendenteNovoFunil}
                onChange={(e) => setAtendenteNovoFunil(e.target.value)}
              >
                {equipe.map((m) => (
                  <option key={m.nome} value={m.nome}>
                    {m.nome}
                  </option>
                ))}
              </select>
              <p className="hint" style={{ marginTop: 6 }}>
                Nome do funil: <strong>Funil - {atendenteNovoFunil}</strong>
              </p>
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

        {novoNegocioAberto ? (
          <section className="open-conv mb14">
            <div className="open-conv-h">
              <div>
                <p className="n">Criar negociação</p>
                <p className="s">
                  Entra na etapa &quot;{funilAtivo?.colunas[0]?.titulo}&quot; do
                  funil {funilAtivo?.nome}
                </p>
              </div>
              <span
                className="close"
                style={{ cursor: "pointer" }}
                onClick={() => setNovoNegocioAberto(false)}
              >
                Fechar ✕
              </span>
            </div>
            <div className="field">
              <label>Nome do contato</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={nomeNegocio}
                onChange={(e) => setNomeNegocio(e.target.value)}
                placeholder="Ex.: Marina Costa"
              />
            </div>
            <div className="field">
              <label>Valor (opcional)</label>
              <input
                className="input"
                style={{ width: "100%" }}
                type="text"
                value={valorNegocio}
                onChange={(e) => setValorNegocio(e.target.value)}
                placeholder="Ex.: R$ 890"
              />
            </div>
            <div className="field">
              <label>Origem</label>
              <ChipFilters
                options={ORIGENS_NEGOCIO}
                initial={ORIGENS_NEGOCIO.indexOf(origemNegocio)}
                onChange={(o) => setOrigemNegocio(o as NegocioCard["origem"])}
              />
            </div>
            <div className="section-foot">
              <button
                type="button"
                className="btn primary block"
                onClick={criarNegocio}
              >
                Criar negociação
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
              <label>Origem do lead — pode escolher mais de uma</label>
              <div className="filters-row">
                <button
                  type="button"
                  className={`fchip${origensFiltro.size === 0 ? " active" : ""}`}
                  aria-pressed={origensFiltro.size === 0}
                  onClick={() => setOrigensFiltro(new Set())}
                >
                  Todas as origens
                </button>
                {ORIGENS_NEGOCIO.map((origem) => (
                  <button
                    type="button"
                    key={origem}
                    className={`fchip${origensFiltro.has(origem) ? " active" : ""}`}
                    aria-pressed={origensFiltro.has(origem)}
                    onClick={() => alternarOrigemFiltro(origem)}
                  >
                    {origem}
                  </button>
                ))}
              </div>
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
                    setOrigensFiltro(new Set());
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
                  {colunaRenomeando === colIndex ? (
                    <input
                      className="input"
                      autoFocus
                      style={{ flex: 1, marginRight: 8 }}
                      value={nomeRenomeando}
                      onChange={(e) => setNomeRenomeando(e.target.value)}
                      onBlur={() => renomearEtapa(colIndex)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renomearEtapa(colIndex);
                        if (e.key === "Escape") setColunaRenomeando(null);
                      }}
                    />
                  ) : (
                    <span
                      className="t"
                      style={{ cursor: "pointer" }}
                      title="Clique pra renomear"
                      onClick={() => {
                        setColunaRenomeando(colIndex);
                        setNomeRenomeando(coluna.titulo);
                      }}
                    >
                      <span className="dot" />
                      {coluna.titulo}
                    </span>
                  )}
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
                    <span className="c">
                      {filtroAtivo ? cardsVisiveis.length : coluna.total}
                    </span>
                    <span
                      role="button"
                      aria-label={`Excluir etapa ${coluna.titulo}`}
                      title="Excluir etapa"
                      style={{ cursor: "pointer", color: "var(--text-faint)" }}
                      onClick={() => excluirEtapa(colIndex)}
                    >
                      ✕
                    </span>
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
                    onDoubleClick={() =>
                      router.push(
                        `/conversas?contato=${encodeURIComponent(card.nome)}`,
                      )
                    }
                    title="Clique duas vezes pra abrir a conversa no WhatsApp"
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
