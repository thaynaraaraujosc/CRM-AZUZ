import type { Metadata } from "next";

import { pipeline, workspace } from "@/lib/data";
import { Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Pipeline · CRM AZUZ" };

export default function PipelinePage() {
  const total = pipeline.reduce((soma, coluna) => soma + coluna.total, 0);

  return (
    <>
      <Topbar
        title="Pipeline"
        sub={`${workspace.segment} · ${total} negócios no funil`}
        actions={
          <>
            <button type="button" className="btn ghost">
              {workspace.segment} ▾
            </button>
            <button type="button" className="btn primary">
              + Negócio
            </button>
          </>
        }
      />

      <div className="content">
        <div className="kanban">
          {pipeline.map((coluna) => (
            <div key={coluna.titulo}>
              <div className="kcol-h">
                <span className="t">
                  <span className="dot" />
                  {coluna.titulo}
                </span>
                <span className="c">{coluna.total}</span>
              </div>
              {coluna.cards.map((card) => (
                <button type="button" className="lead-card" key={card.nome}>
                  <span className="lr1">
                    <span className="lname">{card.nome}</span>
                    <span className="lval">{card.valor}</span>
                  </span>
                  <span className="lr2">
                    <span className="tag">{card.origem}</span>
                    <span className="days">{card.dias}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
