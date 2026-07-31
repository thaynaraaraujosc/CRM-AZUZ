"use client";

import Link from "next/link";
import { useState } from "react";

import {
  relatorioAutomatico,
  relatorioManual,
  relatoriosAnteriores,
} from "@/lib/data";
import { Topbar } from "@/components/ui";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formata(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia} ${MESES[Number(mes) - 1]} ${ano}`;
}

export default function RelatoriosPage() {
  const [dataDe, setDataDe] = useState("2026-07-01");
  const [dataAte, setDataAte] = useState("2026-07-31");
  const [editandoPeriodo, setEditandoPeriodo] = useState(false);

  return (
    <>
      <Topbar
        title="Relatórios"
        sub="Escolha o período pra montar na hora"
        actions={
          <Link
            className="btn primary"
            href={`/relatorio-pdf?de=${dataDe}&ate=${dataAte}`}
            target="_blank"
          >
            Gerar PDF
          </Link>
        }
      />

      <div className="content">
        <div className="grid rep-grid">
          <div>
            <button
              type="button"
              className="date-picker"
              style={{ cursor: "pointer", width: "100%", textAlign: "left" }}
              onClick={() => setEditandoPeriodo((v) => !v)}
            >
              {formata(dataDe)} <span className="arrow">→</span> {formata(dataAte)}
            </button>

            {editandoPeriodo ? (
              <div className="card mb14" style={{ marginTop: 8 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: 17,
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
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => setEditandoPeriodo(false)}
                  >
                    Aplicar período
                  </button>
                </div>
              </div>
            ) : null}

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
