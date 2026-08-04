"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type jsPDF from "jspdf";

import { contatos, equipe, workspace } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import { PERIODO_PADRAO, PeriodoPicker, periodoLabel, type PeriodoValor } from "@/components/ui";
import {
  estimarPaginas,
  gerarPdfRelatorio,
  validarConteudoRelatorio,
  type AvisoValidacao,
  type ModoCapa,
  type SecaoRelatorio,
} from "@/lib/pdf-generator";
import {
  SECOES_POR_TIPO,
  TIPOS_RELATORIO,
  nomeArquivoRelatorio,
  type ContextoRelatorio,
  type NivelDetalhe,
  type TipoRelatorio,
} from "@/lib/relatorio-conteudo";

const ETAPAS = ["Tipo", "Período e filtros", "Conteúdo", "Organização", "Pré-visualização", "Exportação"];

const CORES_CAPA: { nome: string; valor: [number, number, number] }[] = [
  { nome: "Azul", valor: [46, 107, 255] },
  { nome: "Verde", valor: [15, 157, 99] },
  { nome: "Roxo", valor: [138, 63, 252] },
  { nome: "Grafite", valor: [11, 21, 51] },
];

/**
 * Configuração de um relatório — o mesmo formato que o back-end vai
 * persistir quando existir uma tabela real de relatórios (seção 28 do
 * escopo). Hoje só vive no estado do wizard e no histórico local.
 */
export type ConfiguracaoRelatorio = {
  tipo: TipoRelatorio;
  periodo: string;
  filtros: string;
  contatoId?: string;
  secoes: string[];
  ordemSecoes: string[];
  capa: ModoCapa;
  orientacao: "p" | "l";
  nivelDetalhe: NivelDetalhe;
  formato: "PDF" | "CSV";
};

export type RelatorioGerado = {
  id: string;
  nome: string;
  tipo: TipoRelatorio;
  contato?: string;
  periodo: string;
  filtros: string;
  autor: string;
  data: string;
  paginas: number;
  formato: "PDF" | "CSV";
  configuracao: ConfiguracaoRelatorio;
};

function tipoParaNomePadrao(tipo: TipoRelatorio): string {
  return TIPOS_RELATORIO.find((t) => t.tipo === tipo)?.nome ?? "Relatório";
}

/**
 * Assistente em etapas usado tanto pela Central de Relatórios quanto pelo
 * botão "Gerar relatório de tráfego"/"Gerar relatório" da Jornada — mesmo
 * componente, mesma fonte de dados. O fluxo é sequencial de verdade:
 * configurar → gerar prévia real (o mesmo PDF que será baixado) → conferir
 * → aprovar → só então exportar. Nada baixa sozinho.
 */
export function ReportWizard({
  tipoInicial = "executivo",
  contatoInicialId,
  configuracaoInicial,
  onFechar,
  onGerado,
}: {
  tipoInicial?: TipoRelatorio;
  contatoInicialId?: string;
  configuracaoInicial?: ConfiguracaoRelatorio;
  onFechar: () => void;
  onGerado: (registro: RelatorioGerado) => void;
}) {
  const { funis } = useFunis();
  const [etapa, setEtapa] = useState(0);
  const [tipo, setTipo] = useState<TipoRelatorio>(configuracaoInicial?.tipo ?? tipoInicial);
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [funilFiltro, setFuncilFiltro] = useState("Todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("Todos");
  const [contatoId, setContatoId] = useState(
    configuracaoInicial?.contatoId ?? contatoInicialId ?? contatos[0]?.id ?? "",
  );
  const [nomeRelatorio, setNomeRelatorio] = useState(tipoParaNomePadrao(configuracaoInicial?.tipo ?? tipoInicial));
  const [nivelDetalhe, setNivelDetalhe] = useState<NivelDetalhe>(configuracaoInicial?.nivelDetalhe ?? "resumido");

  const secoesDisponiveis = SECOES_POR_TIPO[tipo];
  const [secoesSelecionadas, setSecoesSelecionadas] = useState<Set<string>>(
    () => new Set(configuracaoInicial?.secoes ?? secoesDisponiveis.map((s) => s.id)),
  );
  const [ordemSecoes, setOrdemSecoes] = useState<string[]>(
    () => configuracaoInicial?.ordemSecoes ?? secoesDisponiveis.map((s) => s.id),
  );

  const [capa, setCapa] = useState<ModoCapa>(configuracaoInicial?.capa ?? "compacta");
  const [corCapaIndex, setCorCapaIndex] = useState(0);
  const [incluirLogotipo, setIncluirLogotipo] = useState(true);
  const [incluirCabecalho, setIncluirCabecalho] = useState(true);
  const [incluirRodape, setIncluirRodape] = useState(true);
  const [orientacao, setOrientacao] = useState<"p" | "l">(configuracaoInicial?.orientacao ?? "p");
  const [tamanhoPapel, setTamanhoPapel] = useState<"a4" | "letter">("a4");
  const [observacoesExtra, setObservacoesExtra] = useState("");

  const [previaDoc, setPreviaDoc] = useState<jsPDF | null>(null);
  const [previaUrl, setPreviaUrl] = useState<string | null>(null);
  const [paginaAtualPrevia, setPaginaAtualPrevia] = useState(1);
  const [avisos, setAvisos] = useState<AvisoValidacao[]>([]);
  const [aprovado, setAprovado] = useState(false);
  const [gerandoPrevia, setGerandoPrevia] = useState(false);

  const [status, setStatus] = useState<"idle" | "gerando" | "sucesso" | "erro">("idle");
  const [mensagemErro, setMensagemErro] = useState("");

  useEffect(() => {
    return () => {
      if (previaUrl) URL.revokeObjectURL(previaUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarTipo(novoTipo: TipoRelatorio) {
    setTipo(novoTipo);
    setNomeRelatorio(tipoParaNomePadrao(novoTipo));
    const secoes = SECOES_POR_TIPO[novoTipo].map((s) => s.id);
    setSecoesSelecionadas(new Set(secoes));
    setOrdemSecoes(secoes);
    invalidarPrevia();
  }

  /** Qualquer mudança de configuração depois de aprovado invalida a prévia — precisa gerar de novo antes de exportar. */
  function invalidarPrevia() {
    setAprovado(false);
    if (previaUrl) URL.revokeObjectURL(previaUrl);
    setPreviaUrl(null);
    setPreviaDoc(null);
    setAvisos([]);
  }

  function alternarSecao(id: string) {
    setSecoesSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    invalidarPrevia();
  }

  function moverSecao(id: string, direcao: -1 | 1) {
    setOrdemSecoes((prev) => {
      const arr = [...prev];
      const i = arr.indexOf(id);
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
    invalidarPrevia();
  }

  const ctx: ContextoRelatorio = { periodoLabel: periodoLabel(periodo), contatoId, nivelDetalhe };

  const secoesFinais: SecaoRelatorio[] = useMemo(() => {
    const base = ordemSecoes
      .filter((id) => secoesSelecionadas.has(id))
      .map((id) => secoesDisponiveis.find((s) => s.id === id))
      .filter((s): s is (typeof secoesDisponiveis)[number] => !!s)
      .map((s) => s.gerar(ctx));
    if (observacoesExtra.trim()) base.push({ titulo: "Observações", observacao: observacoesExtra.trim() });
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordemSecoes, secoesSelecionadas, tipo, contatoId, nivelDetalhe, observacoesExtra]);

  const filtrosLabel = [
    funilFiltro !== "Todos" ? `Funil: ${funilFiltro}` : null,
    responsavelFiltro !== "Todos" ? `Responsável: ${responsavelFiltro}` : null,
    tipo === "cliente" ? `Contato: ${contatos.find((c) => c.id === contatoId)?.nome ?? "—"}` : null,
    `Nível: ${nivelDetalhe === "detalhado" ? "Detalhado" : "Resumido"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  function configAtual(): Parameters<typeof gerarPdfRelatorio>[0] {
    return {
      nomeArquivo: nomeArquivoRelatorio(nomeRelatorio, periodoLabel(periodo)),
      titulo: nomeRelatorio,
      subtitulo: filtrosLabel,
      empresa: { nome: workspace.name, segmento: workspace.segment },
      periodoLabel: periodoLabel(periodo),
      secoes: secoesFinais,
      capa,
      corCapa: capa === "personalizada" ? CORES_CAPA[corCapaIndex].valor : undefined,
      incluirLogotipo,
      incluirCabecalho,
      incluirRodape,
      orientacao,
      tamanhoPapel,
    };
  }

  const paginasEstimadas = useMemo(() => estimarPaginas(configAtual()), [secoesFinais, capa, orientacao, tamanhoPapel]); // eslint-disable-line react-hooks/exhaustive-deps

  function gerarPrevia() {
    setGerandoPrevia(true);
    setMensagemErro("");
    setTimeout(() => {
      try {
        const validacao = validarConteudoRelatorio(secoesFinais, orientacao);
        const doc = gerarPdfRelatorio(configAtual());
        if (previaUrl) URL.revokeObjectURL(previaUrl);
        const url = doc.output("bloburl") as unknown as string;
        setPreviaDoc(doc);
        setPreviaUrl(url);
        setPaginaAtualPrevia(1);
        setAvisos(validacao);
        setGerandoPrevia(false);
      } catch (e) {
        setGerandoPrevia(false);
        setAvisos([{ nivel: "erro", mensagem: e instanceof Error ? e.message : "Não foi possível gerar a prévia." }]);
      }
    }, 350);
  }

  const temErroBloqueante = avisos.some((a) => a.nivel === "erro");
  const totalPaginasPrevia = previaDoc?.getNumberOfPages() ?? 0;

  function aprovarRelatorio() {
    if (!previaDoc || temErroBloqueante) return;
    setAprovado(true);
    setEtapa(5);
  }

  function construirConfiguracao(): ConfiguracaoRelatorio {
    return {
      tipo,
      periodo: periodoLabel(periodo),
      filtros: filtrosLabel,
      contatoId: tipo === "cliente" ? contatoId : undefined,
      secoes: Array.from(secoesSelecionadas),
      ordemSecoes,
      capa,
      orientacao,
      nivelDetalhe,
      formato: "PDF",
    };
  }

  function registrar(formato: "PDF" | "CSV"): RelatorioGerado {
    return {
      id: `rel-${Date.now()}`,
      nome: nomeRelatorio,
      tipo,
      contato: tipo === "cliente" ? contatos.find((c) => c.id === contatoId)?.nome : undefined,
      periodo: periodoLabel(periodo),
      filtros: filtrosLabel,
      autor: "Você",
      data: new Date().toLocaleDateString("pt-BR"),
      paginas: totalPaginasPrevia || paginasEstimadas,
      formato,
      configuracao: { ...construirConfiguracao(), formato },
    };
  }

  function baixarPdf() {
    if (!aprovado || !previaDoc) return;
    setStatus("gerando");
    setTimeout(() => {
      try {
        previaDoc.save(nomeArquivoRelatorio(nomeRelatorio, periodoLabel(periodo)));
        setStatus("sucesso");
        onGerado(registrar("PDF"));
      } catch (e) {
        setStatus("erro");
        setMensagemErro(e instanceof Error ? e.message : "Não foi possível baixar o PDF.");
      }
    }, 400);
  }

  function baixarCsv() {
    if (!aprovado) return;
    setStatus("gerando");
    setTimeout(() => {
      try {
        const linhas: string[] = [];
        for (const secao of secoesFinais) {
          linhas.push(`"${secao.titulo}"`);
          secao.linhas?.forEach((l) => linhas.push(`"${l.label}","${l.value}"`));
          secao.barras?.forEach((b) => linhas.push(`"${b.label}","${b.meta}","${b.percentual}%"`));
          secao.tabela?.linhas.forEach((l) => linhas.push(l.map((v) => `"${v}"`).join(",")));
          linhas.push("");
        }
        const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nomeRelatorio} — ${periodoLabel(periodo)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus("sucesso");
        onGerado(registrar("CSV"));
      } catch (e) {
        setStatus("erro");
        setMensagemErro(e instanceof Error ? e.message : "Não foi possível gerar o CSV.");
      }
    }, 300);
  }

  function salvarSemBaixar() {
    if (!aprovado) return;
    onGerado(registrar("PDF"));
    setStatus("sucesso");
  }

  function irParaEtapa(i: number) {
    if (i >= 4) invalidarPrevia(); // reabrir conteúdo/organização exige nova prévia
    setEtapa(i);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="wizard-overlay" onClick={onFechar}>
      <div className="wizard-panel" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-head">
          <div>
            <p className="n" style={{ fontFamily: "var(--display)", fontWeight: 700 }}>
              Assistente de relatório
            </p>
            <p className="hint">{nomeRelatorio}</p>
          </div>
          <button type="button" className="close" style={{ cursor: "pointer" }} onClick={onFechar}>
            Fechar ✕
          </button>
        </div>

        <div className="wizard-steps">
          {ETAPAS.map((nome, i) => (
            <button
              type="button"
              key={nome}
              className={`wizard-step-pill${i === etapa ? " active" : i < etapa ? " done" : ""}`}
              onClick={() => setEtapa(i)}
            >
              {i + 1}. {nome}
            </button>
          ))}
        </div>

        <div className="wizard-body">
          {etapa === 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              {TIPOS_RELATORIO.map((t) => (
                <button
                  type="button"
                  key={t.tipo}
                  className={`card report-type-card${tipo === t.tipo ? " active" : ""}`}
                  style={{ padding: 14, border: tipo === t.tipo ? "2px solid var(--blue)" : undefined }}
                  onClick={() => trocarTipo(t.tipo)}
                >
                  <span className="report-type-icon">{t.icone}</span>
                  <strong style={{ fontSize: 13 }}>{t.nome}</strong>
                  <span className="hint">{t.descricao}</span>
                </button>
              ))}
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Nome do relatório</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  value={nomeRelatorio}
                  onChange={(e) => {
                    setNomeRelatorio(e.target.value);
                    invalidarPrevia();
                  }}
                />
              </div>
            </div>
          ) : null}

          {etapa === 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PeriodoPicker
                label="Período"
                value={periodo}
                onChange={(v) => {
                  setPeriodo(v);
                  invalidarPrevia();
                }}
              />
              {tipo === "cliente" ? (
                <div className="field">
                  <label>Contato</label>
                  <select
                    className="input"
                    value={contatoId}
                    onChange={(e) => {
                      setContatoId(e.target.value);
                      invalidarPrevia();
                    }}
                  >
                    {contatos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="field">
                    <label>Funil</label>
                    <select
                      className="input"
                      value={funilFiltro}
                      onChange={(e) => {
                        setFuncilFiltro(e.target.value);
                        invalidarPrevia();
                      }}
                    >
                      <option value="Todos">Todos</option>
                      {funis.map((f) => (
                        <option key={f.id} value={f.nome}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Responsável</label>
                    <select
                      className="input"
                      value={responsavelFiltro}
                      onChange={(e) => {
                        setResponsavelFiltro(e.target.value);
                        invalidarPrevia();
                      }}
                    >
                      <option value="Todos">Todos</option>
                      {equipe.map((m) => (
                        <option key={m.nome} value={m.nome}>
                          {m.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <p className="hint">{filtrosLabel}</p>
            </div>
          ) : null}

          {etapa === 2 ? (
            <div>
              <div className="field" style={{ marginBottom: 14 }}>
                <label>Nível de detalhe</label>
                <div className="filters-row">
                  <button
                    type="button"
                    className={`fchip${nivelDetalhe === "resumido" ? " active" : ""}`}
                    onClick={() => {
                      setNivelDetalhe("resumido");
                      invalidarPrevia();
                    }}
                  >
                    Resumido — indicadores principais, menos páginas
                  </button>
                  <button
                    type="button"
                    className={`fchip${nivelDetalhe === "detalhado" ? " active" : ""}`}
                    onClick={() => {
                      setNivelDetalhe("detalhado");
                      invalidarPrevia();
                    }}
                  >
                    Detalhado — todos os eventos/registros selecionados
                  </button>
                </div>
              </div>
              <p className="hint" style={{ marginBottom: 10 }}>
                Marque as seções que entram no documento · estimativa: {paginasEstimadas}{" "}
                {paginasEstimadas === 1 ? "página" : "páginas"}
              </p>
              {secoesDisponiveis.map((s) => (
                <label className="wizard-secao-item" key={s.id}>
                  <span className="n">{s.titulo}</span>
                  <input type="checkbox" checked={secoesSelecionadas.has(s.id)} onChange={() => alternarSecao(s.id)} />
                </label>
              ))}
            </div>
          ) : null}

          {etapa === 3 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p className="hint" style={{ marginBottom: 8 }}>Reordenar seções</p>
                {ordemSecoes
                  .filter((id) => secoesSelecionadas.has(id))
                  .map((id, i, arr) => {
                    const secao = secoesDisponiveis.find((s) => s.id === id);
                    if (!secao) return null;
                    return (
                      <div className="kpi-personalizar-item" key={id}>
                        <span className="n">{secao.titulo}</span>
                        <div className="kpi-personalizar-ordem">
                          <button type="button" disabled={i === 0} onClick={() => moverSecao(id, -1)}>↑</button>
                          <button type="button" disabled={i === arr.length - 1} onClick={() => moverSecao(id, 1)}>↓</button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="field">
                <label>Capa</label>
                <div className="filters-row">
                  {(["nenhuma", "compacta", "completa", "personalizada"] as ModoCapa[]).map((m) => (
                    <button
                      type="button"
                      key={m}
                      className={`fchip${capa === m ? " active" : ""}`}
                      onClick={() => {
                        setCapa(m);
                        invalidarPrevia();
                      }}
                    >
                      {m === "nenhuma" ? "Sem capa" : m === "compacta" ? "Compacta" : m === "completa" ? "Completa" : "Personalizada"}
                    </button>
                  ))}
                </div>
              </div>

              {capa === "personalizada" ? (
                <div className="field">
                  <label>Cor da capa</label>
                  <div className="filters-row">
                    {CORES_CAPA.map((c, i) => (
                      <button
                        type="button"
                        key={c.nome}
                        className={`fchip${corCapaIndex === i ? " active" : ""}`}
                        onClick={() => {
                          setCorCapaIndex(i);
                          invalidarPrevia();
                        }}
                        style={{ borderColor: `rgb(${c.valor.join(",")})` }}
                      >
                        {c.nome}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="field">
                <label>Orientação</label>
                <div className="filters-row">
                  <button
                    type="button"
                    className={`fchip${orientacao === "p" ? " active" : ""}`}
                    onClick={() => {
                      setOrientacao("p");
                      invalidarPrevia();
                    }}
                  >
                    Retrato
                  </button>
                  <button
                    type="button"
                    className={`fchip${orientacao === "l" ? " active" : ""}`}
                    onClick={() => {
                      setOrientacao("l");
                      invalidarPrevia();
                    }}
                  >
                    Paisagem
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Tamanho do papel</label>
                <div className="filters-row">
                  <button
                    type="button"
                    className={`fchip${tamanhoPapel === "a4" ? " active" : ""}`}
                    onClick={() => {
                      setTamanhoPapel("a4");
                      invalidarPrevia();
                    }}
                  >
                    A4
                  </button>
                  <button
                    type="button"
                    className={`fchip${tamanhoPapel === "letter" ? " active" : ""}`}
                    onClick={() => {
                      setTamanhoPapel("letter");
                      invalidarPrevia();
                    }}
                  >
                    Carta
                  </button>
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={incluirLogotipo}
                  onChange={(e) => {
                    setIncluirLogotipo(e.target.checked);
                    invalidarPrevia();
                  }}
                />
                Incluir logotipo/marca
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={incluirCabecalho}
                  onChange={(e) => {
                    setIncluirCabecalho(e.target.checked);
                    invalidarPrevia();
                  }}
                />
                Incluir cabeçalho em todas as páginas
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={incluirRodape}
                  onChange={(e) => {
                    setIncluirRodape(e.target.checked);
                    invalidarPrevia();
                  }}
                />
                Incluir rodapé com paginação
              </label>

              <div className="field">
                <label>Observações (opcional)</label>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 60 }}
                  value={observacoesExtra}
                  onChange={(e) => setObservacoesExtra(e.target.value)}
                  placeholder="Entra como uma seção extra no fim do documento…"
                />
              </div>
            </div>
          ) : null}

          {etapa === 4 ? (
            <div>
              {!previaUrl ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
                  <p className="hint">
                    Estimativa: {paginasEstimadas} {paginasEstimadas === 1 ? "página" : "páginas"} · {secoesFinais.length}{" "}
                    {secoesFinais.length === 1 ? "seção" : "seções"} · {orientacao === "p" ? "retrato" : "paisagem"}
                  </p>
                  <button type="button" className="btn primary" onClick={gerarPrevia} disabled={gerandoPrevia}>
                    {gerandoPrevia ? "Gerando prévia…" : "Gerar prévia"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {avisos.length > 0 ? (
                    <div className="card" style={{ padding: 12 }}>
                      {avisos.map((a, i) => (
                        <p
                          key={i}
                          className="hint"
                          style={{ margin: "3px 0", color: a.nivel === "erro" ? "var(--danger)" : undefined }}
                        >
                          {a.nivel === "erro" ? "✕ " : "⚠ "}
                          {a.mensagem}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="hint">✓ Nenhum problema encontrado — {totalPaginasPrevia} página(s).</p>
                  )}

                  <div className="filters-row" style={{ margin: 0 }}>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={paginaAtualPrevia <= 1}
                      onClick={() => setPaginaAtualPrevia((p) => p - 1)}
                    >
                      ← Página anterior
                    </button>
                    <span className="hint">
                      Página {paginaAtualPrevia} de {totalPaginasPrevia}
                    </span>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={paginaAtualPrevia >= totalPaginasPrevia}
                      onClick={() => setPaginaAtualPrevia((p) => p + 1)}
                    >
                      Próxima página →
                    </button>
                    <button type="button" className="btn ghost" onClick={gerarPrevia}>
                      Gerar nova prévia
                    </button>
                  </div>

                  <iframe
                    key={previaUrl}
                    src={`${previaUrl}#page=${paginaAtualPrevia}&toolbar=1&view=FitH`}
                    title="Pré-visualização do relatório"
                    style={{ width: "100%", height: 420, border: "1px solid var(--line)", borderRadius: 10 }}
                  />
                  <p className="hint">
                    Essa é a prévia real — o mesmo arquivo que será baixado, com zoom e navegação de página do
                    próprio visualizador de PDF do navegador.
                  </p>

                  <div className="filters-row" style={{ margin: 0 }}>
                    <button type="button" className="btn ghost" onClick={() => irParaEtapa(2)}>
                      Voltar e editar
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={aprovarRelatorio}
                      disabled={temErroBloqueante}
                      title={temErroBloqueante ? "Corrija os erros antes de aprovar" : undefined}
                    >
                      Aprovar relatório
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {etapa === 5 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {!aprovado ? (
                <p className="hint">
                  O relatório ainda não foi aprovado — volte em &quot;Pré-visualização&quot; e gere/aprove a prévia
                  primeiro.
                </p>
              ) : (
                <>
                  <div className="card" style={{ padding: 14 }}>
                    <p className="hint" style={{ marginBottom: 4 }}>Relatório aprovado</p>
                    <p className="n" style={{ fontFamily: "var(--display)", fontWeight: 700, marginBottom: 6 }}>
                      {nomeRelatorio}
                    </p>
                    <p className="hint" style={{ margin: "2px 0" }}>Tipo: {tipoParaNomePadrao(tipo)}</p>
                    <p className="hint" style={{ margin: "2px 0" }}>Período: {periodoLabel(periodo)}</p>
                    <p className="hint" style={{ margin: "2px 0" }}>Páginas: {totalPaginasPrevia}</p>
                    <p className="hint" style={{ margin: "2px 0" }}>
                      Arquivo: {nomeArquivoRelatorio(nomeRelatorio, periodoLabel(periodo))}
                    </p>
                    <button type="button" className="link" onClick={() => setEtapa(4)} style={{ marginTop: 6 }}>
                      Visualizar novamente
                    </button>
                  </div>

                  {status === "gerando" ? <p className="hint">⏳ Preparando arquivo…</p> : null}
                  {status === "sucesso" ? <p className="hint">✓ Concluído.</p> : null}
                  {status === "erro" ? (
                    <p className="hint" style={{ color: "var(--danger)" }}>
                      ✕ {mensagemErro || "Algo deu errado."}{" "}
                      <button type="button" className="link" onClick={baixarPdf}>Tentar novamente</button>
                    </p>
                  ) : null}

                  <button type="button" className="btn primary block" onClick={baixarPdf} disabled={status === "gerando"}>
                    Baixar PDF
                  </button>
                  <button type="button" className="btn ghost block" onClick={baixarCsv} disabled={status === "gerando"}>
                    Baixar Excel (CSV)
                  </button>
                  <button type="button" className="btn ghost block" onClick={salvarSemBaixar} disabled={status === "gerando"}>
                    Salvar relatório (sem baixar)
                  </button>
                  <button type="button" className="btn ghost block" onClick={() => irParaEtapa(2)}>
                    Voltar e editar
                  </button>
                  <button type="button" className="btn ghost block" disabled title="Ainda não disponível nesta versão">
                    Programar envio (indisponível — recurso em desenvolvimento)
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="wizard-foot">
          <button type="button" className="btn ghost" onClick={onFechar}>
            Cancelar
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {etapa > 0 ? (
              <button type="button" className="btn ghost" onClick={() => irParaEtapa(etapa - 1)}>
                Voltar
              </button>
            ) : null}
            {etapa < ETAPAS.length - 1 && etapa !== 4 ? (
              <button type="button" className="btn primary" onClick={() => irParaEtapa(etapa + 1)}>
                Continuar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
