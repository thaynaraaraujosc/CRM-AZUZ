import Link from "next/link";
import type { Metadata } from "next";

import { atividadeRecente, funilJulho, leadsPorDia, today } from "@/lib/data";
import { Topbar, KpiCard } from "@/components/ui";
import { calcularFunilResumo, calcularRoasMedio, calcularTaxaConversao, calcularValorVendido } from "@/lib/metrics";

export const metadata: Metadata = { title: "Início · CRM AZUZ" };

export default function InicioPage() {
  const leadsNoMes = calcularFunilResumo();
  const taxaConversao = calcularTaxaConversao();
  const vendasNoMes = calcularValorVendido();
  const roas = calcularRoasMedio();

  return (
    <>
      <Topbar title="Início" sub={today} />

      <div className="content">
        <div className="grid kpi4">
          <KpiCard
            label="Leads no mês"
            value={leadsNoMes.label}
            formula={leadsNoMes.formula}
            href="/funil"
          />
          <KpiCard
            label="Taxa de conversão"
            value={taxaConversao.label}
            formula={taxaConversao.formula}
            href="/performance-vendas"
          />
          <KpiCard
            label="Vendas no mês"
            value={vendasNoMes.label}
            formula={vendasNoMes.formula}
            href="/performance-vendas"
          />
          <KpiCard label="ROAS médio" value={roas.label} formula={roas.formula} href="/trafego" />
        </div>

        <div className="grid split2">
          <Link className="card card-link" href="/trafego">
            <div className="panel-h">
              <h4>Leads por dia · últimos 14 dias</h4>
              <span className="link">Ver tráfego</span>
            </div>
            <div className="bars">
              {leadsPorDia.map(({ dia, altura, hoje }) => (
                <div className="bar-col" key={dia}>
                  <div
                    className={`bar${hoje ? " hi" : ""}`}
                    style={{ height: `${altura}%` }}
                  />
                  <span className="lbl">{dia}</span>
                </div>
              ))}
            </div>
          </Link>

          <Link className="card card-link" href="/funil">
            <div className="panel-h">
              <h4>Funil · julho</h4>
              <span className="link">Ver funil</span>
            </div>
            <div className="funnel-mini">
              {funilJulho.map(({ etapa, total, largura }) => (
                <div className="funnel-row" key={etapa}>
                  <span className="fl">{etapa}</span>
                  <div className="funnel-track">
                    <div className="funnel-fill" style={{ width: `${largura}%` }} />
                  </div>
                  <span className="fn">{total}</span>
                </div>
              ))}
            </div>
          </Link>
        </div>

        <div className="card mt14">
          <div className="panel-h">
            <h4>Atividade recente</h4>
            <Link className="link" href="/contatos">
              Ver tudo
            </Link>
          </div>
          {atividadeRecente.map((item) => (
            <Link
              className="activity-row activity-row-link"
              href={`/conversas?contato=${encodeURIComponent(item.nome)}`}
              key={item.nome}
            >
              <div className="avatar">{item.initials}</div>
              <div className="body">
                <p className="name">{item.nome}</p>
                <p className="meta">{item.meta}</p>
              </div>
              <span className={`pill${item.destaque ? " on" : ""}`}>
                {item.pill}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
