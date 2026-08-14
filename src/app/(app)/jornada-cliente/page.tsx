"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  classeOrigem,
  oportunidadesPerdidas,
  type Canal,
  type Contato,
} from "@/lib/data";
import { useContatos } from "@/lib/contatos-context";
import { useConversas } from "@/lib/conversas-context";
import { useMensagensExtra } from "@/lib/mensagens-extra-context";
import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { useTarefas } from "@/lib/tarefas-context";
import { IconSearch } from "@/components/icons";
import { FloatingDropdown } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import {
  calcularResumoJornada,
  estimarMinutosAtras,
  gerarLinhaDoTempo,
  inferirEstadoCicloDeVida,
  type EstadoCicloDeVida,
  type Evento,
  type ResumoJornada,
} from "@/lib/timeline";
import {
  lerContatosRecentes,
  lerHistoricosRecentes,
  registrarContatoRecente,
  registrarHistoricoRecente,
  removerContatoRecente,
  type ContatoRecente,
  type HistoricoRecente,
} from "@/lib/jornada-recentes";
import { ReportWizard } from "@/components/report-wizard";

const CANAIS: Canal[] = ["WhatsApp", "Instagram", "TikTok"];
const ESTADOS: EstadoCicloDeVida[] = ["Novo lead", "Em atendimento", "Em negociação", "Cliente", "Perdido"];

const CLASSE_ESTADO: Record<EstadoCicloDeVida, string> = {
  "Novo lead": "stage-tag",
  "Em atendimento": "stage-tag",
  "Em negociação": "stage-tag",
  Cliente: "stage-tag won",
  Perdido: "stage-tag",
};

type ColunaOpcional = "primeiraEntrada" | "ultimaCompra" | "valorAcumulado" | "proximaAtividade" | "situacao";

const COLUNAS_OPCIONAIS: { chave: ColunaOpcional; label: string }[] = [
  { chave: "primeiraEntrada", label: "Primeira entrada" },
  { chave: "ultimaCompra", label: "Última compra" },
  { chave: "valorAcumulado", label: "Valor acumulado" },
  { chave: "proximaAtividade", label: "Próxima atividade" },
  { chave: "situacao", label: "Situação" },
];

type Ordenacao = { coluna: string; asc: boolean };

/** Remove acentos e normaliza caixa — a pesquisa ignora os dois. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export default function JornadaClientePage() {
  return (
    <Suspense fallback={null}>
      <JornadaClientePageInner />
    </Suspense>
  );
}

function JornadaClientePageInner() {
  const searchParams = useSearchParams();
  const { data: sessao } = useSession();
  const nomeUsuario = sessao?.user?.name ?? "";
  const { contatos, alternarFavorito } = useContatos();
  const { conversas } = useConversas();
  const { mensagensExtraPorContato } = useMensagensExtra();
  const { funis } = useFunis();
  const { colunas: tarefas } = useTarefas();
  const { membros: equipe } = useEquipe();

  const [busca, setBusca] = useState(searchParams.get("busca") ?? "");
  const [buscaDebounced, setBuscaDebounced] = useState(busca);
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [filtrosRect, setFiltrosRect] = useState<DOMRect | null>(null);
  const [colunasAberto, setColunasAberto] = useState(false);
  const [colunasRect, setColunasRect] = useState<DOMRect | null>(null);

  const [filtros, setFiltros] = useState<Record<string, string>>({
    origem: "Todos",
    canal: "Todos",
    etapa: "Todos",
    funil: "Todos",
    responsavel: "Todos",
    papel: "Todos",
    etiqueta: "Todos",
    situacao: "Todos",
    clienteOuLead: "Todos",
    negociacao: "Todos",
    compra: "Todos",
    ativo: "Todos",
    primeiraEntrada: "Todos",
  });

  const [colunasVisiveis, setColunasVisiveis] = useState<Set<ColunaOpcional>>(new Set());
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ coluna: "ultima", asc: false });
  const [pagina, setPagina] = useState(1);
  const [tamanhoPagina, setTamanhoPagina] = useState(5);

  const [selecionadoId, setSelecionadoId] = useState<string | null>(searchParams.get("contato"));
  const [painelMobileAberto, setPainelMobileAberto] = useState(!!searchParams.get("contato"));

  // Começa vazio (igual ao HTML pré-renderizado no build) e só lê o
  // localStorage depois de montar — inicializar direto no useState causaria
  // erro de hidratação sempre que o navegador já tivesse recentes salvos
  // (a página é pré-renderizada estática, sem acesso a localStorage).
  const [contatosRecentes, setContatosRecentes] = useState<ContatoRecente[]>([]);
  const [historicosRecentes, setHistoricosRecentes] = useState<HistoricoRecente[]>([]);
  const [verTodosRecentes, setVerTodosRecentes] = useState(false);

  const [anotacoes, setAnotacoes] = useState<Record<string, Evento[]>>({});
  const [notaTexto, setNotaTexto] = useState("");
  const [notaAberta, setNotaAberta] = useState(false);
  const [wizardAberto, setWizardAberto] = useState(false);

  // Hidratação: começa vazio (igual ao HTML estático) e só lê o
  // localStorage depois de montar — ver comentário nos useState acima.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContatosRecentes(lerContatosRecentes());
    setHistoricosRecentes(lerHistoricosRecentes());
  }, []);

  // Espera 220ms sem digitar antes de aplicar o termo — mesma UX que uma
  // busca remota teria (ver seção 1: "preparar busca remota para o
  // back-end"). Enquanto `busca` e `buscaDebounced` divergem, a lista
  // mostra "Buscando…"; o setState só acontece dentro do timeout, nunca
  // direto no corpo do efeito.
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 220);
    return () => clearTimeout(t);
  }, [busca]);
  const buscando = busca !== buscaDebounced;

  const contato = contatos.find((c) => c.id === selecionadoId) ?? null;

  const etiquetasDisponiveis = useMemo(
    () => Array.from(new Set(contatos.flatMap((c) => c.etiquetas ?? []))).sort(),
    [contatos],
  );
  const papeisDisponiveis = useMemo(() => Array.from(new Set(equipe.map((m) => m.papel))).sort(), [equipe]);

  function temNegociacao(c: Contato): boolean {
    return funis.some((f) => f.colunas.some((col) => col.cards.some((card) => card.nome === c.nome)));
  }
  function temCompra(c: Contato): boolean {
    return funis.some((f) =>
      f.colunas.some((col) => col.titulo.startsWith("Fechado") && col.cards.some((card) => card.nome === c.nome)),
    );
  }
  function conversaDe(c: Contato) {
    return conversas.find((cv) => cv.nome === c.nome);
  }

  const termo = normalizar(buscaDebounced);
  // A busca roda sobre TODOS os contatos (não só os visíveis na página
  // atual) — seção 1: "não pesquisar somente os contatos visíveis na tela".
  const resultadosBusca = useMemo(() => {
    if (!termo) return contatos;
    return contatos.filter((c) => {
      const campos = [
        c.nome,
        c.sobrenome,
        c.whatsapp,
        c.telefoneFixo,
        c.email,
        c.empresa,
        c.id,
        ...(c.etiquetas ?? []),
      ];
      return campos.filter(Boolean).some((v) => normalizar(String(v)).includes(termo));
    });
  }, [contatos, termo]);

  const filtrados = useMemo(() => {
    return resultadosBusca.filter((c) => {
      if (filtros.origem !== "Todos" && c.origem !== filtros.origem) return false;
      if (filtros.canal !== "Todos" && conversaDe(c)?.canal !== filtros.canal) return false;
      if (filtros.etapa !== "Todos" && c.etapa !== filtros.etapa) return false;
      if (filtros.funil !== "Todos") {
        const f = funis.find((f) => f.nome === filtros.funil);
        if (!f || !f.colunas.some((col) => col.cards.some((card) => card.nome === c.nome))) return false;
      }
      if (filtros.responsavel !== "Todos" && c.responsavel !== filtros.responsavel) return false;
      if (filtros.papel !== "Todos") {
        const m = equipe.find((m) => m.nome === c.responsavel);
        if (!m || m.papel !== filtros.papel) return false;
      }
      if (filtros.etiqueta !== "Todos" && !(c.etiquetas ?? []).includes(filtros.etiqueta)) return false;
      if (filtros.situacao !== "Todos" && inferirEstadoCicloDeVida(c, oportunidadesPerdidas) !== filtros.situacao)
        return false;
      if (filtros.clienteOuLead !== "Todos") {
        const cliente = c.etapa === "Fechado";
        if (filtros.clienteOuLead === "Cliente" && !cliente) return false;
        if (filtros.clienteOuLead === "Lead" && cliente) return false;
      }
      if (filtros.negociacao !== "Todos") {
        const tem = temNegociacao(c);
        if (filtros.negociacao === "Com negociação" && !tem) return false;
        if (filtros.negociacao === "Sem negociação" && tem) return false;
      }
      if (filtros.compra !== "Todos") {
        const tem = temCompra(c);
        if (filtros.compra === "Com compra" && !tem) return false;
        if (filtros.compra === "Sem compra" && tem) return false;
      }
      if (filtros.ativo !== "Todos") {
        const ativo = estimarMinutosAtras(c.ultima) <= 30 * 1440;
        if (filtros.ativo === "Ativo" && !ativo) return false;
        if (filtros.ativo === "Inativo" && ativo) return false;
      }
      if (filtros.primeiraEntrada !== "Todos") {
        const eventos = gerarLinhaDoTempo(c.id, { contatos, conversas, mensagensPorContato: mensagensExtraPorContato, tarefas, funis, oportunidadesPerdidas });
        const primeiro = eventos[eventos.length - 2];
        const dias = primeiro ? primeiro.minutosAtras / 1440 : null;
        if (filtros.primeiraEntrada === "Últimos 7 dias" && (dias === null || dias > 7)) return false;
        if (filtros.primeiraEntrada === "Últimos 30 dias" && (dias === null || dias > 30)) return false;
        if (filtros.primeiraEntrada === "Mais de 30 dias" && (dias === null || dias <= 30)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultadosBusca, filtros, funis]);

  const filtrosAtivos = Object.entries(filtros).filter(([, v]) => v !== "Todos");

  const resumosPorContato = useMemo(() => {
    if (colunasVisiveis.size === 0) return new Map<string, ResumoJornada>();
    const mapa = new Map<string, ResumoJornada>();
    for (const c of filtrados) {
      const eventos = gerarLinhaDoTempo(c.id, { contatos, conversas, mensagensPorContato: mensagensExtraPorContato, tarefas, funis, oportunidadesPerdidas });
      mapa.set(c.id, calcularResumoJornada(c, eventos, { funis, tarefas, conversas }));
    }
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, colunasVisiveis, funis]);

  function valorOrdenacao(c: Contato, coluna: string): string | number {
    switch (coluna) {
      case "nome":
        return c.nome;
      case "empresa":
        return c.empresa ?? "";
      case "origem":
        return c.origem;
      case "etapa":
        return c.etapa;
      case "responsavel":
        return c.responsavel;
      case "ultima":
        return estimarMinutosAtras(c.ultima);
      default:
        return c.nome;
    }
  }

  const ordenados = useMemo(() => {
    const arr = [...filtrados];
    arr.sort((a, b) => {
      const av = valorOrdenacao(a, ordenacao.coluna);
      const bv = valorOrdenacao(b, ordenacao.coluna);
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return ordenacao.asc ? cmp : -cmp;
    });
    return arr;
  }, [filtrados, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginados = ordenados.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  function ordenarPor(coluna: string) {
    setOrdenacao((atual) => (atual.coluna === coluna ? { coluna, asc: !atual.asc } : { coluna, asc: true }));
  }

  function alternarColuna(chave: ColunaOpcional) {
    setColunasVisiveis((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  }

  function selecionarContato(id: string) {
    setSelecionadoId(id);
    setPainelMobileAberto(true);
    setNotaAberta(false);
    setContatosRecentes(registrarContatoRecente(id, nomeUsuario));
    const c = contatos.find((x) => x.id === id);
    if (c) {
      setHistoricosRecentes(
        registrarHistoricoRecente(
          {
            contatoId: id,
            ultimaInteracaoRegistrada: c.ultima,
            etapa: c.etapa,
            responsavel: c.responsavel,
          },
          nomeUsuario,
        ),
      );
    }
  }

  function fecharPainel() {
    setPainelMobileAberto(false);
    setSelecionadoId(null);
  }

  function limparFiltros() {
    setFiltros({
      origem: "Todos",
      canal: "Todos",
      etapa: "Todos",
      funil: "Todos",
      responsavel: "Todos",
      papel: "Todos",
      etiqueta: "Todos",
      situacao: "Todos",
      clienteOuLead: "Todos",
      negociacao: "Todos",
      compra: "Todos",
      ativo: "Todos",
      primeiraEntrada: "Todos",
    });
    setPagina(1);
  }

  function adicionarAnotacao() {
    if (!contato || !notaTexto.trim()) return;
    const evento: Evento = {
      id: `anotacao-${contato.id}-${anotacoes[contato.id]?.length ?? 0}`,
      contatoId: contato.id,
      tipo: "anotacao",
      titulo: "Anotação",
      descricao: notaTexto.trim(),
      quando: "Agora",
      minutosAtras: 0,
    };
    setAnotacoes((prev) => ({ ...prev, [contato.id]: [evento, ...(prev[contato.id] ?? [])] }));
    setNotaTexto("");
    setNotaAberta(false);
  }

  const eventos = contato
    ? gerarLinhaDoTempo(
        contato.id,
        { contatos, conversas, mensagensPorContato: mensagensExtraPorContato, tarefas, funis, oportunidadesPerdidas },
        anotacoes[contato.id] ?? [],
      )
    : [];
  const estado = contato ? inferirEstadoCicloDeVida(contato, oportunidadesPerdidas) : null;
  const resumo = contato ? calcularResumoJornada(contato, eventos, { funis, tarefas, conversas }) : null;

  const filtroDefs: { chave: string; label: string; opcoes: string[] }[] = [
    { chave: "origem", label: "Origem", opcoes: ["Todos", "Meta Ads", "Google Ads", "Instagram", "TikTok", "Indicação"] },
    { chave: "canal", label: "Canal", opcoes: ["Todos", ...CANAIS] },
    { chave: "etapa", label: "Etapa", opcoes: ["Todos", "Novo", "Qualificado", "Proposta", "Fechado"] },
    { chave: "funil", label: "Funil", opcoes: ["Todos", ...funis.map((f) => f.nome)] },
    { chave: "responsavel", label: "Responsável", opcoes: ["Todos", ...equipe.map((m) => m.nome)] },
    { chave: "papel", label: "Equipe / papel", opcoes: ["Todos", ...papeisDisponiveis] },
    { chave: "etiqueta", label: "Etiqueta", opcoes: ["Todos", ...etiquetasDisponiveis] },
    { chave: "situacao", label: "Situação", opcoes: ["Todos", ...ESTADOS] },
    { chave: "clienteOuLead", label: "Cliente ou lead", opcoes: ["Todos", "Cliente", "Lead"] },
    { chave: "negociacao", label: "Negociação", opcoes: ["Todos", "Com negociação", "Sem negociação"] },
    { chave: "compra", label: "Compra", opcoes: ["Todos", "Com compra", "Sem compra"] },
    { chave: "ativo", label: "Cliente ativo/inativo", opcoes: ["Todos", "Ativo", "Inativo"] },
    { chave: "primeiraEntrada", label: "Primeira entrada", opcoes: ["Todos", "Últimos 7 dias", "Últimos 30 dias", "Mais de 30 dias"] },
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title-row">
            <h2>Jornada do cliente</h2>
          </div>
          <p className="sub">A jornada completa de um contato — desde a primeira entrada até a última interação</p>
        </div>
      </div>

      <div className="content jornada-cliente">
        <div className="jornada-busca-row">
          <label className="search jornada-search">
            <IconSearch />
            <input
              placeholder="Pesquisar por nome, telefone, e-mail ou empresa..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
              aria-label="Pesquisar contato"
            />
            {busca ? (
              <button type="button" className="jornada-busca-limpar" onClick={() => setBusca("")} aria-label="Limpar pesquisa">
                ✕
              </button>
            ) : null}
          </label>
          <button
            type="button"
            className="btn ghost"
            onClick={(e) => {
              setFiltrosRect(e.currentTarget.getBoundingClientRect());
              setFiltrosAberto((v) => !v);
            }}
          >
            Filtros{filtrosAtivos.length > 0 ? ` · ${filtrosAtivos.length}` : ""}
          </button>
          <FloatingDropdown
            anchorRect={filtrosAberto ? filtrosRect : null}
            onClose={() => setFiltrosAberto(false)}
            width={320}
            maxHeight={480}
            align="right"
          >
            <div className="filterbar-panel">
              {filtroDefs.map((f) => (
                <div className="filterbar-field" key={f.chave}>
                  <label>{f.label}</label>
                  <select
                    className="input"
                    value={filtros[f.chave]}
                    onChange={(e) => {
                      setFiltros((prev) => ({ ...prev, [f.chave]: e.target.value }));
                      setPagina(1);
                    }}
                  >
                    {f.opcoes.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="filterbar-foot">
                <button type="button" className="link" onClick={limparFiltros}>
                  Limpar
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn ghost" onClick={() => setFiltrosAberto(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn primary" onClick={() => setFiltrosAberto(false)}>
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </FloatingDropdown>
        </div>

        {filtrosAtivos.length > 0 ? (
          <div className="filterbar-chips mb14">
            {filtrosAtivos.map(([chave, valor]) => (
              <span className="filterbar-chip" key={chave}>
                {filtroDefs.find((f) => f.chave === chave)?.label}: {valor}
                <button type="button" onClick={() => setFiltros((prev) => ({ ...prev, [chave]: "Todos" }))}>
                  ✕
                </button>
              </span>
            ))}
            <button type="button" className="link" onClick={limparFiltros} style={{ fontSize: 11 }}>
              Limpar tudo
            </button>
          </div>
        ) : null}

        <SecaoContatosRecentes
          recentes={contatosRecentes}
          contatos={contatos}
          verTodos={verTodosRecentes}
          onVerTodos={() => setVerTodosRecentes((v) => !v)}
          onAbrir={selecionarContato}
          onFavoritar={alternarFavorito}
          onRemover={(id) => setContatosRecentes(removerContatoRecente(id))}
        />

        <SecaoHistoricosRecentes recentes={historicosRecentes} contatos={contatos} onContinuar={selecionarContato} />

        <div className={`jornada-layout${contato && painelMobileAberto ? " jornada-layout-aberta" : ""}`}>
          <div className="card jornada-lista">
            <div className="panel-h">
              <h4>
                {buscando
                  ? "Buscando…"
                  : `${ordenados.length} ${ordenados.length === 1 ? "contato encontrado" : "contatos encontrados"}`}
              </h4>
              <div className="filters-row" style={{ margin: 0 }}>
                <button
                  type="button"
                  className="fsel"
                  onClick={(e) => {
                    setColunasRect(e.currentTarget.getBoundingClientRect());
                    setColunasAberto((v) => !v);
                  }}
                >
                  Colunas ▾
                </button>
                <FloatingDropdown
                  anchorRect={colunasAberto ? colunasRect : null}
                  onClose={() => setColunasAberto(false)}
                  width={220}
                  align="right"
                >
                  {COLUNAS_OPCIONAIS.map((c) => (
                    <label key={c.chave} className="dropdown-item" style={{ width: "100%", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={colunasVisiveis.has(c.chave)}
                        onChange={() => alternarColuna(c.chave)}
                        style={{ marginRight: 8 }}
                      />
                      <span className="n">{c.label}</span>
                    </label>
                  ))}
                </FloatingDropdown>
              </div>
            </div>

            {buscando ? (
              <p className="hint" style={{ padding: 17 }}>Carregando…</p>
            ) : ordenados.length === 0 ? (
              <p className="hint" style={{ padding: 17 }}>Nenhum contato encontrado.</p>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th></th>
                        {[
                          ["nome", "Nome"],
                          ["empresa", "Empresa"],
                          ["origem", "Origem"],
                          ["etapa", "Etapa"],
                          ["responsavel", "Responsável"],
                          ["ultima", "Última interação"],
                        ].map(([chave, label]) => (
                          <th key={chave} style={{ cursor: "pointer" }} onClick={() => ordenarPor(chave)}>
                            {label} {ordenacao.coluna === chave ? (ordenacao.asc ? "↑" : "↓") : ""}
                          </th>
                        ))}
                        {COLUNAS_OPCIONAIS.filter((c) => colunasVisiveis.has(c.chave)).map((c) => (
                          <th key={c.chave}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginados.map((c) => {
                        const resumoLinha = resumosPorContato.get(c.id);
                        return (
                          <tr key={c.id} className={selecionadoId === c.id ? "jornada-row-ativa" : undefined}>
                            <td>
                              <button
                                type="button"
                                className="jornada-fav-btn"
                                onClick={() => alternarFavorito(c.nome)}
                                aria-label={c.favorito ? "Remover dos favoritos" : "Favoritar"}
                                title={c.favorito ? "Remover dos favoritos" : "Favoritar"}
                              >
                                {c.favorito ? "★" : "☆"}
                              </button>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="name-cell"
                                style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
                                onClick={() => selecionarContato(c.id)}
                              >
                                <div className="avatar">{c.initials}</div>
                                <span className="n" style={{ color: selecionadoId === c.id ? "var(--blue)" : undefined }}>
                                  {c.nome}
                                </span>
                              </button>
                            </td>
                            <td>{c.empresa ?? "—"}</td>
                            <td>
                              <span className={`origin-tag ${classeOrigem(c.origem)}`}>{c.origem}</span>
                            </td>
                            <td>
                              <span className={`stage-tag${c.etapa === "Fechado" ? " won" : ""}`}>{c.etapa}</span>
                            </td>
                            <td>{c.responsavel}</td>
                            <td>{c.ultima}</td>
                            {colunasVisiveis.has("primeiraEntrada") ? <td>{resumoLinha?.primeiraEntrada ?? "Não disponível"}</td> : null}
                            {colunasVisiveis.has("ultimaCompra") ? <td>{resumoLinha?.ultimaCompra ?? "Ainda não ocorreu"}</td> : null}
                            {colunasVisiveis.has("valorAcumulado") ? <td>{resumoLinha?.receitaAcumulada ?? "Ainda não ocorreu"}</td> : null}
                            {colunasVisiveis.has("proximaAtividade") ? <td>{resumoLinha?.proximaAcao ?? "Nenhuma"}</td> : null}
                            {colunasVisiveis.has("situacao") ? (
                              <td>
                                <span className={CLASSE_ESTADO[inferirEstadoCicloDeVida(c, oportunidadesPerdidas)]}>
                                  {inferirEstadoCicloDeVida(c, oportunidadesPerdidas)}
                                </span>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="jornada-paginacao">
                  <div className="filters-row" style={{ margin: 0 }}>
                    <span className="hint">Por página:</span>
                    {[5, 10, 25].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`fchip${tamanhoPagina === n ? " active" : ""}`}
                        onClick={() => {
                          setTamanhoPagina(n);
                          setPagina(1);
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="filters-row" style={{ margin: 0 }}>
                    <button type="button" className="btn ghost" disabled={paginaAtual <= 1} onClick={() => setPagina((p) => p - 1)}>
                      ← Anterior
                    </button>
                    <span className="hint">
                      Página {paginaAtual} de {totalPaginas}
                    </span>
                    <button type="button" className="btn ghost" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                      Próxima →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {contato && resumo && estado ? (
            <div className="card jornada-painel">
              <div className="jornada-painel-head">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="avatar">{contato.initials}</div>
                  <div>
                    <h4 style={{ margin: 0 }}>{contato.nome}</h4>
                    <p className="hint" style={{ margin: 0 }}>
                      {contato.empresa ? `${contato.empresa} · ` : ""}
                      {contato.whatsapp ?? "Sem telefone"} · {contato.email ?? "Sem e-mail"}
                    </p>
                    <p className="hint" style={{ margin: 0 }}>
                      Responsável: {contato.responsavel} · {(contato.etiquetas ?? []).join(", ") || "Sem etiquetas"}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={CLASSE_ESTADO[estado]}>{estado}</span>
                  <button type="button" className="close" style={{ cursor: "pointer" }} onClick={fecharPainel}>
                    Fechar ✕
                  </button>
                </div>
              </div>

              <div className="jornada-painel-acoes">
                <Link className="btn ghost" href={`/conversas?contato=${encodeURIComponent(contato.nome)}`}>
                  Abrir conversa
                </Link>
                <Link className="btn ghost" href={`/contatos`}>
                  Abrir contato
                </Link>
                <Link className="btn ghost" href="/tarefas">
                  Criar tarefa
                </Link>
                <button type="button" className="btn ghost" onClick={() => setNotaAberta((v) => !v)}>
                  Adicionar anotação
                </button>
                <Link className="btn ghost" href="/equipe">
                  Alterar responsável
                </Link>
                <Link className="btn ghost" href="/funil">
                  Abrir negociação
                </Link>
                <button type="button" className="btn primary" onClick={() => setWizardAberto(true)}>
                  Gerar relatório
                </button>
              </div>

              {notaAberta ? (
                <div className="jornada-nota">
                  <textarea
                    className="input"
                    style={{ width: "100%", minHeight: 60 }}
                    placeholder="Escreva a anotação…"
                    value={notaTexto}
                    onChange={(e) => setNotaTexto(e.target.value)}
                  />
                  <button type="button" className="btn primary" disabled={!notaTexto.trim()} onClick={adicionarAnotacao}>
                    Salvar anotação
                  </button>
                </div>
              ) : null}

              <div className="jornada-resumo-grid">
                <ResumoItem label="Primeira entrada" value={resumo.primeiraEntrada} vazio="Não disponível" />
                <ResumoItem label="Origem" value={resumo.origem} />
                <ResumoItem label="Canal inicial" value={resumo.canalInicial} vazio="Não disponível" />
                <ResumoItem label="Tempo até 1ª resposta" value={resumo.tempoAtePrimeiraResposta} vazio="Não disponível" />
                <ResumoItem label="Negociações" value={String(resumo.quantidadeNegociacoes)} />
                <ResumoItem label="Compras" value={String(resumo.quantidadeCompras)} />
                <ResumoItem label="Receita acumulada" value={resumo.receitaAcumulada} vazio="Ainda não ocorreu" />
                <ResumoItem label="Ticket médio" value={resumo.ticketMedio} vazio="Ainda não ocorreu" />
                <ResumoItem label="Última compra" value={resumo.ultimaCompra} vazio="Ainda não ocorreu" />
                <ResumoItem label="Última interação" value={resumo.ultimaInteracao} />
                <ResumoItem label="Próxima ação" value={resumo.proximaAcao} vazio="Nenhuma pendente" />
              </div>

              <div className="panel-h divided">
                <h4>Linha do tempo</h4>
              </div>
              <div style={{ padding: 17 }}>
                <Timeline eventos={eventos} />
              </div>
            </div>
          ) : (
            <div className="card jornada-painel-vazio">
              <p className="hint">Selecione um contato na lista pra ver a jornada completa dele.</p>
            </div>
          )}
        </div>
      </div>

      {wizardAberto && contato ? (
        <ReportWizard
          tipoInicial="cliente"
          contatoInicialId={contato.id}
          onFechar={() => setWizardAberto(false)}
          onGerado={() => setWizardAberto(false)}
        />
      ) : null}
    </>
  );
}

function ResumoItem({ label, value, vazio = "—" }: { label: string; value: string | null | undefined; vazio?: string }) {
  return (
    <div className="jornada-resumo-item">
      <p className="l">{label}</p>
      <p className="v">{value || vazio}</p>
    </div>
  );
}

function SecaoContatosRecentes({
  recentes,
  contatos,
  verTodos,
  onVerTodos,
  onAbrir,
  onFavoritar,
  onRemover,
}: {
  recentes: ContatoRecente[];
  contatos: Contato[];
  verTodos: boolean;
  onVerTodos: () => void;
  onAbrir: (id: string) => void;
  onFavoritar: (nome: string) => void;
  onRemover: (id: string) => void;
}) {
  if (recentes.length === 0) {
    return (
      <div className="card mb14 jornada-recentes-vazio">
        <p className="hint">Contatos que você abrir vão aparecer aqui, pra acesso rápido.</p>
      </div>
    );
  }

  const visiveis = verTodos ? recentes : recentes.slice(0, 4);

  return (
    <div className="card mb14">
      <div className="panel-h">
        <h4>Contatos recentes</h4>
        {recentes.length > 4 ? (
          <button type="button" className="link" onClick={onVerTodos}>
            {verTodos ? "Ver menos" : "Ver todos"}
          </button>
        ) : null}
      </div>
      <div className="jornada-recentes-grid">
        {visiveis.map((r) => {
          const c = contatos.find((x) => x.id === r.contatoId);
          if (!c) return null;
          return (
            <div className="jornada-recente-card" key={r.contatoId}>
              <button type="button" className="jornada-recente-abrir" onClick={() => onAbrir(c.id)}>
                <div className="avatar">{c.initials}</div>
                <div>
                  <p className="n">{c.nome}</p>
                  <p className="hint" style={{ margin: 0 }}>
                    {c.empresa ? `${c.empresa} · ` : ""}
                    {c.etapa}
                  </p>
                  <p className="hint" style={{ margin: 0 }}>{c.ultima}</p>
                </div>
              </button>
              <div className="jornada-recente-acoes">
                <button type="button" onClick={() => onFavoritar(c.nome)} title="Favoritar" aria-label="Favoritar">
                  {c.favorito ? "★" : "☆"}
                </button>
                <button type="button" onClick={() => onRemover(c.id)} title="Remover dos recentes" aria-label="Remover dos recentes">
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecaoHistoricosRecentes({
  recentes,
  contatos,
  onContinuar,
}: {
  recentes: HistoricoRecente[];
  contatos: Contato[];
  onContinuar: (id: string) => void;
}) {
  if (recentes.length === 0) {
    return (
      <div className="card mb14 jornada-recentes-vazio">
        <p className="hint">Jornadas que você consultar ficam registradas aqui.</p>
      </div>
    );
  }

  return (
    <div className="card mb14">
      <div className="panel-h">
        <h4>Históricos visualizados recentemente</h4>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Contato</th>
              <th>Última visualização</th>
              <th>Última interação registrada</th>
              <th>Etapa</th>
              <th>Responsável</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recentes.slice(0, 6).map((r) => {
              const c = contatos.find((x) => x.id === r.contatoId);
              if (!c) return null;
              return (
                <tr key={r.contatoId}>
                  <td>{c.nome}</td>
                  <td>{new Date(r.data).toLocaleString("pt-BR")}</td>
                  <td>{r.ultimaInteracaoRegistrada}</td>
                  <td>{r.etapa}</td>
                  <td>{r.responsavel}</td>
                  <td>
                    <button type="button" className="link" onClick={() => onContinuar(c.id)}>
                      Continuar visualização
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
