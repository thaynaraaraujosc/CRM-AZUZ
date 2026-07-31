"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import {
  relatorioAutomatico,
  relatorioManual,
  relatorioPorOrigem,
  workspace,
} from "@/lib/data";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formata(iso: string | null) {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia} ${MESES[Number(mes) - 1]} ${ano}`;
}

function marcaEmpresa(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function RelatorioPdfPage() {
  return (
    <Suspense fallback={null}>
      <RelatorioPdfInner />
    </Suspense>
  );
}

function RelatorioPdfInner() {
  const searchParams = useSearchParams();
  const de = formata(searchParams.get("de"));
  const ate = formata(searchParams.get("ate"));
  const origensParam = searchParams.get("origens");
  const origensEscolhidas = new Set(
    origensParam ? origensParam.split(",").filter(Boolean) : [],
  );
  const origensParaMostrar = relatorioPorOrigem.filter((o) =>
    origensEscolhidas.has(o.id),
  );

  return (
    <div className="pdf-screen">
      <div className="pdf-toolbar">
        <button type="button" className="btn primary" onClick={() => window.print()}>
          Baixar / Imprimir PDF
        </button>
        <button type="button" className="btn ghost" onClick={() => window.close()}>
          Fechar
        </button>
      </div>

      <div className="pdf-page">
        <header className="pdf-header">
          <div className="pdf-brand">
            <div className="pdf-mark">{marcaEmpresa(workspace.name)}</div>
            <div>
              <p className="pdf-empresa">{workspace.name}</p>
              <p className="pdf-segmento">{workspace.segment}</p>
              <p className="pdf-email">{workspace.email}</p>
            </div>
          </div>
          <div className="pdf-periodo">
            <p className="l">Período</p>
            <p className="v">
              {de} → {ate}
            </p>
          </div>
        </header>

        <h1 className="pdf-titulo">Relatório de resultados</h1>

        <section className="pdf-section">
          <h2>Automático</h2>
          <table className="pdf-table">
            <tbody>
              {relatorioAutomatico.map((stat) => (
                <tr key={stat.label}>
                  <td>{stat.label}</td>
                  <td className="v">{stat.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {origensParaMostrar.map((origem) => (
          <section className="pdf-section" key={origem.id}>
            <h2>{origem.label}</h2>
            <table className="pdf-table">
              <tbody>
                {origem.stats.map((stat) => (
                  <tr key={stat.label}>
                    <td>{stat.label}</td>
                    <td className="v">{stat.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <section className="pdf-section">
          <h2>Preenchido pela secretária</h2>
          <table className="pdf-table">
            <tbody>
              <tr>
                <td>Faturamento total da empresa</td>
                <td className="v">{relatorioManual.faturamento}</td>
              </tr>
              <tr>
                <td>% vindo do tráfego pago</td>
                <td className="v">{relatorioManual.percentualPago}</td>
              </tr>
              <tr>
                <td>Queixas mais frequentes</td>
                <td className="v">{relatorioManual.queixasPlaceholder}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="pdf-footer">AZUZ CRM</footer>
      </div>

      <style>{`
        .pdf-screen {
          min-height: 100vh;
          background: var(--navy-raised-2);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 16px 60px;
        }

        .pdf-toolbar {
          width: 100%;
          max-width: 210mm;
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-bottom: 16px;
        }

        .pdf-page {
          width: 210mm;
          min-height: 297mm;
          max-width: 100%;
          background: var(--white);
          border: 1px solid var(--line);
          box-shadow: 0 12px 32px rgba(11, 21, 51, 0.12);
          padding: 18mm 16mm;
          display: flex;
          flex-direction: column;
        }

        .pdf-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 14px;
          border-bottom: 2px solid var(--ink);
        }

        .pdf-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .pdf-mark {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: var(--blue-soft);
          color: var(--blue);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--display);
          font-weight: 700;
          font-size: 14px;
          flex: 0 0 auto;
        }

        .pdf-empresa {
          font-family: var(--display);
          font-weight: 700;
          font-size: 15px;
        }

        .pdf-segmento,
        .pdf-email {
          font-size: 11px;
          color: var(--text-muted);
        }

        .pdf-periodo {
          text-align: right;
        }

        .pdf-periodo .l {
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        .pdf-periodo .v {
          font-family: var(--display);
          font-weight: 700;
          font-size: 13px;
          margin-top: 2px;
        }

        .pdf-titulo {
          font-family: var(--display);
          font-weight: 700;
          font-size: 20px;
          margin: 20px 0 14px;
        }

        .pdf-section {
          margin-bottom: 18px;
        }

        .pdf-section h2 {
          font-family: var(--display);
          font-weight: 700;
          font-size: 13px;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
        }

        .pdf-table {
          width: 100%;
          border-collapse: collapse;
        }

        .pdf-table td {
          padding: 8px 4px;
          border-bottom: 1px solid var(--line-soft);
          font-size: 12.5px;
        }

        .pdf-table td.v {
          text-align: right;
          font-family: var(--display);
          font-weight: 700;
        }

        .pdf-footer {
          margin-top: auto;
          padding-top: 20px;
          text-align: center;
          font-size: 8px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-faint);
        }

        @media print {
          .pdf-toolbar {
            display: none;
          }
          .pdf-screen {
            background: var(--white);
            padding: 0;
          }
          .pdf-page {
            border: none;
            box-shadow: none;
            width: auto;
            min-height: auto;
            padding: 0;
          }
          @page {
            size: A4;
            margin: 18mm 16mm;
          }
        }
      `}</style>
    </div>
  );
}
