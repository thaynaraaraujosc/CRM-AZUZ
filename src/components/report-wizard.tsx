"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { contatos, equipe, workspace } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import { PERIODO_PADRAO, PeriodoPicker, periodoLabel, type PeriodoValor } from "@/components/ui";
import { gerarPdfRelatorio, type SecaoRelatorio } from "@/lib/pdf-generator";
import {
  SECOES_POR_TIPO,
  TIPOS_RELATORIO,
  nomeArquivoRelatorio,
  type ContextoRelatorio,
  type TipoRelatorio,
} from "@/lib/relatorio-conteudo";

const ETAPAS = ["Tipo", "Período e filtros", "Conteúdo", "Organização", "Pré-visualização", "Exportação"];

export type RelatorioGerado = {
  id: string;
  nome: string;
  tipo: TipoRelatorio;
  periodo: string;
  filtros: string;
  autor: string;
  data: string;
  formato: "PDF" | "CSV";
};

function tipoParaNomePadrao(tipo: TipoRelatorio): string {
  return TIPOS_RELATORIO.find((t) => t.tipo === tipo)?.nome ?? "Relatório";
}

/**
 * Assistente em etapas usado tanto pela Central de Relatórios quanto pelo
 * botão "Gerar relatório de tráfego" — mesmo componente, mesma fonte de
 * dados, pra nunca existirem dois relatórios de tráfego diferentes (ver
 * seção 13 do escopo).
 */
export function ReportWizard({
  tipoInicial = "executivo",
  contatoInicialId,
  onFechar,
  onGerado,
}: {
  tipoInicial?: TipoRelatorio;
  contatoInicialId?: string;
  onFechar: () => void;
  onGerado: (registro: RelatorioGerado) => void;
}) {
  const { funis } = useFunis();
  const [etapa, setEtapa] = useState(0);
  const [tipo, setTipo] = useState<TipoRelatorio>(tipoInicial);
  const [periodo, setPeriodo] = useState<PeriodoValor>(PERIODO_PADRAO);
  const [funilFiltro, setFuncilFiltro] = useState("Todos");
  const [responsavelFiltro, setResponsavelFiltro] = useState("Todos");
  const [contatoId, setContatoId] = useState(contatoInicialId ?? contatos[0]?.id ?? "");
  const [nomeRelatorio, setNomeRelatorio] = useState(tipoParaNomePadrao(tipoInicial));

  const secoesDisponiveis = SECOES_POR_TIPO[tipo];
  const [secoesSelecionadas, setSecoesSelecionadas] = useState<Set<string>>(
    () => new Set(secoesDisponiveis.map((s) => s.id)),
  );
  const [ordemSecoes, setOrdemSecoes] = useState<string[]>(() => secoesDisponiveis.map((s) => s.id));

  const [incluirCapa, setIncluirCapa] = useState(true);
  const [incluirLogotipo, setIncluirLogotipo] = useState(true);
  const [orientacao, setOrientacao] = useState<"p" | "l">("p");

  const [status, setStatus] = useState<"idle" | "gerando" | "sucesso" | "erro">("idle");
  const [mensagemErro, setMensagemErro] = useState("");

  function trocarTipo(novoTipo: TipoRelatorio) {
    setTipo(novoTipo);
    setNomeRelatorio(tipoParaNomePadrao(novoTipo));
    const secoes = SECOES_POR_TIPO[novoTipo].map((s) => s.id);
    setSecoesSelecionadas(new Set(secoes));
    setOrdemSecoes(secoes);
  }

  function alternarSecao(id: string) {
    setSecoesSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  }

  const ctx: ContextoRelatorio = { periodoLabel: periodoLabel(periodo), contatoId };

  const secoesFinais: SecaoRelatorio[] = useMemo(() => {
    return ordemSecoes
      .filter((id) => secoesSelecionadas.has(id))
      .map((id) => secoesDisponiveis.find((s) => s.id === id))
      .filter((s): s is (typeof secoesDisponiveis)[number] => !!s)
      .map((s) => s.gerar(ctx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordemSecoes, secoesSelecionadas, tipo, contatoId]);

  const filtrosLabel = [
    funilFiltro !== "Todos" ? `Funil: ${funilFiltro}` : null,
    responsavelFiltro !== "Todos" ? `Responsável: ${responsavelFiltro}` : null,
    tipo === "cliente" ? `Contato: ${contatos.find((c) => c.id === contatoId)?.nome ?? "—"}` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "Sem filtros adicionais";

  function construirPdf() {
    return gerarPdfRelatorio({
      nomeArquivo: nomeArquivoRelatorio(nomeRelatorio, periodoLabel(periodo)),
      titulo: nomeRelatorio,
      subtitulo: filtrosLabel,
      empresa: { nome: workspace.name, segmento: workspace.segment },
      periodoLabel: periodoLabel(periodo),
      secoes: secoesFinais,
      incluirCapa,
      incluirLogotipo,
      orientacao,
    });
  }

  function registrar(formato: "PDF" | "CSV"): RelatorioGerado {
    return {
      id: `rel-${Date.now()}`,
      nome: nomeRelatorio,
      tipo,
      periodo: periodoLabel(periodo),
      filtros: filtrosLabel,
      autor: "Você",
      data: new Date().toLocaleDateString("pt-BR"),
      formato,
    };
  }

  function baixarPdf() {
    setStatus("gerando");
    setTimeout(() => {
      try {
        const doc = construirPdf();
        doc.save(nomeArquivoRelatorio(nomeRelatorio, periodoLabel(periodo)));
        setStatus("sucesso");
        onGerado(registrar("PDF"));
      } catch (e) {
        setStatus("erro");
        setMensagemErro(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
      }
    }, 500);
  }

  function baixarCsv() {
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
    }, 400);
  }

  function salvarSemBaixar() {
    onGerado(registrar("PDF"));
    setStatus("sucesso");
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
                  style={{
                    padding: 14,
                    border: tipo === t.tipo ? "2px solid var(--blue)" : undefined,
                  }}
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
                  onChange={(e) => setNomeRelatorio(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {etapa === 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PeriodoPicker label="Período" value={periodo} onChange={setPeriodo} />
              {tipo === "cliente" ? (
                <div className="field">
                  <label>Contato</label>
                  <select className="input" value={contatoId} onChange={(e) => setContatoId(e.target.value)}>
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
                    <select className="input" value={funilFiltro} onChange={(e) => setFuncilFiltro(e.target.value)}>
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
                      onChange={(e) => setResponsavelFiltro(e.target.value)}
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
              <p className="hint" style={{ marginBottom: 10 }}>Marque as seções que entram no documento</p>
              {secoesDisponiveis.map((s) => (
                <label className="wizard-secao-item" key={s.id}>
                  <span className="n">{s.titulo}</span>
                  <input
                    type="checkbox"
                    checked={secoesSelecionadas.has(s.id)}
                    onChange={() => alternarSecao(s.id)}
                  />
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
                <label>Orientação</label>
                <div className="filters-row">
                  <button
                    type="button"
                    className={`fchip${orientacao === "p" ? " active" : ""}`}
                    onClick={() => setOrientacao("p")}
                  >
                    Retrato
                  </button>
                  <button
                    type="button"
                    className={`fchip${orientacao === "l" ? " active" : ""}`}
                    onClick={() => setOrientacao("l")}
                  >
                    Paisagem
                  </button>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <input type="checkbox" checked={incluirCapa} onChange={(e) => setIncluirCapa(e.target.checked)} />
                Incluir capa
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={incluirLogotipo}
                  onChange={(e) => setIncluirLogotipo(e.target.checked)}
                />
                Incluir logotipo/marca
              </label>
            </div>
          ) : null}

          {etapa === 4 ? (
            <div>
              <p className="hint" style={{ marginBottom: 10 }}>
                Pré-visualização do conteúdo — {incluirCapa ? "com capa · " : ""}
                {orientacao === "p" ? "retrato" : "paisagem"}
              </p>
              <div className="wizard-preview-secao">
                <h5>{nomeRelatorio}</h5>
                <p className="hint" style={{ margin: 0 }}>{filtrosLabel} · {periodoLabel(periodo)}</p>
              </div>
              {secoesFinais.length === 0 ? (
                <p className="hint">Nenhuma seção selecionada — volte em &quot;Conteúdo&quot; e marque ao menos uma.</p>
              ) : null}
              {secoesFinais.map((s) => (
                <div className="wizard-preview-secao" key={s.titulo}>
                  <h5>{s.titulo}</h5>
                  {s.linhas?.map((l) => (
                    <p key={l.label} className="hint" style={{ margin: "2px 0" }}>
                      {l.label}: <b>{l.value}</b>
                    </p>
                  ))}
                  {s.barras?.map((b) => (
                    <p key={b.label} className="hint" style={{ margin: "2px 0" }}>
                      {b.label} — {b.meta}
                    </p>
                  ))}
                  {s.tabela ? (
                    <p className="hint" style={{ margin: "2px 0" }}>
                      Tabela com {s.tabela.linhas.length} linha(s) · colunas: {s.tabela.colunas.join(", ")}
                    </p>
                  ) : null}
                  {s.observacao ? <p className="hint" style={{ margin: "2px 0" }}>{s.observacao}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {etapa === 5 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {status === "gerando" ? <p className="hint">⏳ Gerando documento…</p> : null}
              {status === "sucesso" ? <p className="hint">✓ Pronto — o download deve ter começado.</p> : null}
              {status === "erro" ? (
                <p className="hint" style={{ color: "#d64545" }}>
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
              <button type="button" className="btn ghost block" disabled title="Em breve">
                Programar envio (em breve)
              </button>
            </div>
          ) : null}
        </div>

        <div className="wizard-foot">
          <button type="button" className="btn ghost" onClick={onFechar}>
            Cancelar
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {etapa > 0 ? (
              <button type="button" className="btn ghost" onClick={() => setEtapa((e) => e - 1)}>
                Voltar
              </button>
            ) : null}
            {etapa < ETAPAS.length - 1 ? (
              <button type="button" className="btn primary" onClick={() => setEtapa((e) => e + 1)}>
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
