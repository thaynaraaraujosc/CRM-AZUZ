"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Topbar } from "@/components/ui";
import { ReportWizard, type ConfiguracaoRelatorio, type RelatorioGerado } from "@/components/report-wizard";
import { TIPOS_RELATORIO, type TipoRelatorio } from "@/lib/relatorio-conteudo";

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
  const [configWizard, setConfigWizard] = useState<ConfiguracaoRelatorio | undefined>(undefined);
  // Histórico real do workspace (`RelatorioGerado` no banco) — começa vazio de verdade (sem
  // relatório de exemplo nenhum) até o primeiro relatório real ser gerado.
  const [historico, setHistorico] = useState<RelatorioGerado[]>([]);

  useEffect(() => {
    fetch("/api/relatorios")
      .then((r) => r.json())
      .then((dados) => setHistorico(Array.isArray(dados) ? dados : []))
      .catch((erro) => console.error("Falha ao carregar histórico de relatórios:", erro));
  }, []);

  function abrirWizard(tipo: TipoRelatorio) {
    setTipoWizard(tipo);
    setConfigWizard(undefined);
    setWizardAberto(true);
  }

  function aoGerar(registro: RelatorioGerado) {
    setHistorico((prev) => [registro, ...prev]);
    fetch("/api/relatorios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(registro),
    }).catch((erro) => console.error("Falha ao salvar relatório gerado:", erro));
  }

  function excluir(id: string) {
    setHistorico((prev) => prev.filter((r) => r.id !== id));
    fetch(`/api/relatorios/${id}`, { method: "DELETE" }).catch((erro) =>
      console.error("Falha ao excluir relatório:", erro),
    );
  }

  // Reabre o assistente já preenchido com a mesma configuração usada
  // anteriormente — o usuário só revisa e aprova de novo (nunca reaproveita
  // o PDF antigo, sempre gera uma prévia nova a partir dos dados atuais).
  function duplicarConfiguracao(registro: RelatorioGerado) {
    setTipoWizard(registro.tipo);
    setConfigWizard(registro.configuracao);
    setWizardAberto(true);
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
            <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Contato</th>
                  <th>Período</th>
                  <th>Autor</th>
                  <th>Data</th>
                  <th>Páginas</th>
                  <th>Formato</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {historico.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nome}</td>
                    <td>{TIPOS_RELATORIO.find((t) => t.tipo === r.tipo)?.nome ?? r.tipo}</td>
                    <td>{r.contato ?? "—"}</td>
                    <td>{r.periodo}</td>
                    <td>{r.autor}</td>
                    <td>{r.data}</td>
                    <td>{r.paginas}</td>
                    <td>{r.formato}</td>
                    <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" className="link" onClick={() => duplicarConfiguracao(r)}>
                        Gerar com dados atualizados
                      </button>
                      <button type="button" className="link" onClick={() => duplicarConfiguracao(r)}>
                        Duplicar configuração
                      </button>
                      <button type="button" className="link" onClick={() => excluir(r.id)} style={{ color: "var(--danger)" }}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {wizardAberto ? (
        <ReportWizard
          tipoInicial={tipoWizard}
          configuracaoInicial={configWizard}
          onFechar={() => setWizardAberto(false)}
          onGerado={aoGerar}
        />
      ) : null}
    </>
  );
}
