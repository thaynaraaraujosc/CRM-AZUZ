import type { Metadata } from "next";

import {
  periodoRelatorio,
  relatorioAutomatico,
  relatorioManual,
  relatoriosAnteriores,
} from "@/lib/data";
import { Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Relatórios · CRM AZUZ" };

export default function RelatoriosPage() {
  return (
    <>
      <Topbar
        title="Relatórios"
        sub="Escolha o período pra montar na hora"
        actions={
          <button type="button" className="btn primary">
            Gerar PDF
          </button>
        }
      />

      <div className="content">
        <div className="grid rep-grid">
          <div>
            <div className="date-picker">
              {periodoRelatorio.de} <span className="arrow">→</span>{" "}
              {periodoRelatorio.ate}
            </div>

            <div className="card mb14">
              <div className="panel-h">
                <h4>Automático</h4>
                <span className="badge-auto">Sistema</span>
              </div>
              {relatorioAutomatico.map((stat) => (
                <div className="stat-row" key={stat.label}>
                  <span className="sl">{stat.label}</span>
                  <span className="sv">{stat.value}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="panel-h">
                <h4>Preenchido pela secretária</h4>
                <span className="badge-manual">Manual</span>
              </div>
              <div className="field">
                <label>Faturamento total da empresa</label>
                <div className="input">{relatorioManual.faturamento}</div>
              </div>
              <div className="field">
                <label>% vindo do tráfego pago</label>
                <div className="input">{relatorioManual.percentualPago}</div>
              </div>
              <div className="field">
                <label>Queixas mais frequentes</label>
                <div className="input ph">
                  {relatorioManual.queixasPlaceholder}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="panel-h">
              <h4>Relatórios anteriores</h4>
            </div>
            <div className="prev-list">
              {relatoriosAnteriores.map((rel) => (
                <div className="prev-row" key={rel.nome}>
                  <div>
                    <p className="n">{rel.nome}</p>
                    <p className="d">{rel.gerado}</p>
                  </div>
                  <button type="button" className="btn ghost">
                    Abrir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
