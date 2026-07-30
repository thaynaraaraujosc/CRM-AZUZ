import type { Metadata } from "next";

import { automacoes } from "@/lib/data";
import { IconAutomacoes } from "@/components/icons";
import { Toggle, Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Automações · CRM AZUZ" };

export default function AutomacoesPage() {
  const ativas = automacoes.filter((a) => a.ativa).length;

  return (
    <>
      <Topbar
        title="Automações"
        sub={`${automacoes.length} automações · ${ativas} ativas — follow-up e movimentação de funil`}
        actions={
          <button type="button" className="btn primary">
            + Nova automação
          </button>
        }
      />

      <div className="content">
        <div className="card">
          {automacoes.map((automacao) => (
            <div className="auto-row" key={automacao.titulo}>
              <div className="auto-icon">
                <IconAutomacoes />
              </div>
              <div className="auto-body">
                <p className="auto-title">{automacao.titulo}</p>
                <div className="auto-flow">
                  {automacao.fluxo.map((passo, i) => (
                    <span key={passo} style={{ display: "contents" }}>
                      {i > 0 ? <span className="flow-arrow">→</span> : null}
                      <span className="flow-chip">{passo}</span>
                    </span>
                  ))}
                </div>
              </div>
              <span className="auto-stat">{automacao.execucoes}</span>
              <Toggle defaultOn={automacao.ativa} label={automacao.titulo} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
