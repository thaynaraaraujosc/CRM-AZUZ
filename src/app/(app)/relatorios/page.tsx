"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { currentUser, relatoriosAnteriores } from "@/lib/data";
import { Topbar } from "@/components/ui";
import { ReportWizard, type RelatorioGerado } from "@/components/report-wizard";
import { TIPOS_RELATORIO, type TipoRelatorio } from "@/lib/relatorio-conteudo";

const CHAVE_HISTORICO = "azuz-relatorios-historico-v1";

const HISTORICO_INICIAL: RelatorioGerado[] = relatoriosAnteriores.map((r, i) => ({
  id: `legado-${i}`,
  nome: r.nome,
  tipo: "executivo" as TipoRelatorio,
  periodo: r.nome,
  filtros: "Sem filtros adicionais",
  autor: currentUser.name,
  data: r.gerado.replace("Gerado em ", ""),
  formato: "PDF" as const,
}));

/**
 * Central de relatórios — entra numa seleção clara de tipos (nunca direto
 * numa tela com dezenas de gráficos). Cada tipo abre o mesmo assistente
 * (ReportWizard), que é também o componente usado pelo botão "Gerar
 * relatório de tráfego" em /trafego — mesma fonte, mesmos filtros.
 */
export default function RelatoriosPage() {
  return (
    <Suspense fallback={null}>
      <RelatoriosPageInner />
    </Suspense>
  );
}

function RelatoriosPageInner() {
  const searchParams = useSearchParams();
  const tipoQuery = searchParams.get("tipo") as TipoRelatorio | null;

  const [wizardAberto, setWizardAberto] = useState(!!tipoQuery);
  const [tipoWizard, setTipoWizard] = useState<TipoRelatorio>(tipoQuery ?? "executivo");
  const [historico, setHistorico] = useState<RelatorioGerado[]>(() => {
    if (typeof window === "undefined") return HISTORICO_INICIAL;
    try {
      const salvo = localStorage.getItem(CHAVE_HISTORICO);
      return salvo ? (JSON.parse(salvo) as RelatorioGerado[]) : HISTORICO_INICIAL;
    } catch {
      return HISTORICO_INICIAL;
    }
  });

  function salvarHistorico(next: RelatorioGerado[]) {
    setHistorico(next);
    if (typeof window !== "undefined") localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(next));
  }

  function abrirWizard(tipo: TipoRelatorio) {
    setTipoWizard(tipo);
    setWizardAberto(true);
  }

  function aoGerar(registro: RelatorioGerado) {
    salvarHistorico([registro, ...historico]);
  }

  function excluir(id: string) {
    salvarHistorico(historico.filter((r) => r.id !== id));
  }

  function duplicar(registro: RelatorioGerado) {
    abrirWizard(registro.tipo);
  }

  return (
    <>
      <Topbar title="Relatórios" sub="Escolha o tipo de relatório — o conteúdo e os filtros você ajusta no assistente" />

      <div className="content">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
          {TIPOS_RELATORIO.map((t) => {
            const recentes = historico.filter((r) => r.tipo === t.tipo).slice(0, 2);
            return (
              <div className="card" key={t.tipo} style={{ padding: 16 }}>
                <span className="report-type-icon">{t.icone}</span>
                <p className="n" style={{ fontFamily: "var(--display)", fontWeight: 700, marginTop: 6 }}>
                  {t.nome}
                </p>
                <p className="hint" style={{ marginBottom: 10 }}>{t.descricao}</p>
                <div className="report-type-actions">
                  <button type="button" className="btn ghost" onClick={() => abrirWizard(t.tipo)}>
                    Configurar
                  </button>
                  <button type="button" className="btn primary" onClick={() => abrirWizard(t.tipo)}>
                    Gerar
                  </button>
                </div>
                {recentes.length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <p className="hint" style={{ marginBottom: 4 }}>Modelos recentes</p>
                    {recentes.map((r) => (
                      <p key={r.id} className="hint" style={{ margin: "2px 0" }}>
                        {r.nome} · {r.data}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="card mt14">
          <div className="panel-h">
            <h4>Relatórios gerados</h4>
          </div>
          {historico.length === 0 ? (
            <p className="hint" style={{ padding: 17 }}>Nenhum relatório gerado ainda.</p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Período</th>
                  <th>Filtros</th>
                  <th>Autor</th>
                  <th>Data</th>
                  <th>Formato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {historico.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nome}</td>
                    <td>{TIPOS_RELATORIO.find((t) => t.tipo === r.tipo)?.nome ?? r.tipo}</td>
                    <td>{r.periodo}</td>
                    <td>{r.filtros}</td>
                    <td>{r.autor}</td>
                    <td>{r.data}</td>
                    <td>{r.formato}</td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="link" onClick={() => abrirWizard(r.tipo)}>
                        Gerar novamente
                      </button>
                      <button type="button" className="link" onClick={() => duplicar(r)}>
                        Duplicar
                      </button>
                      <button type="button" className="link" onClick={() => excluir(r.id)} style={{ color: "#d64545" }}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {wizardAberto ? (
        <ReportWizard tipoInicial={tipoWizard} onFechar={() => setWizardAberto(false)} onGerado={aoGerar} />
      ) : null}
    </>
  );
}
