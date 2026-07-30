import type { Metadata } from "next";

import { campanhas, kpisTrafego, workspace } from "@/lib/data";
import { Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Tráfego · CRM AZUZ" };

export default function TrafegoPage() {
  return (
    <>
      <Topbar
        title="Tráfego"
        sub="Julho 2026 · todas as contas de anúncio"
        actions={
          <button type="button" className="btn ghost">
            Exportar
          </button>
        }
      />

      <div className="content">
        <div className="filter-strip">
          <span className="fsel">Cliente: {workspace.name} ▾</span>
          <span className="fsel">Plataforma: Todas ▾</span>
          <span className="fsel">Campanha: Todas ▾</span>
          <span className="fsel">01 jul → 30 jul ▾</span>
        </div>

        <div className="grid kpi6">
          {kpisTrafego.map((kpi) => (
            <div className="card kpi" key={kpi.label}>
              <p className="l">{kpi.label}</p>
              <p className="n">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="panel-h">
            <h4>Por campanha</h4>
            <span className="link">ROAS</span>
          </div>
          {campanhas.map((campanha) => (
            <div className="camp-row" key={campanha.nome}>
              <div className="camp-icon">{campanha.plataforma}</div>
              <div className="camp-body">
                <p className="camp-name">{campanha.nome}</p>
                <p className="camp-sub">{campanha.sub}</p>
                <div className="camp-track">
                  <div
                    className="camp-fill"
                    style={{ width: `${campanha.barra}%` }}
                  />
                </div>
              </div>
              <span className="camp-num">{campanha.roas}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
