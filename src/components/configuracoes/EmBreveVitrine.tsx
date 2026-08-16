"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";

import { CabecalhoCategoria } from "./CabecalhoCategoria";

/** Vitrine "Em breve" reutilizável — mesmo padrão visual de `/azuz-ia` (item desativado por decisão
 * de produto, não limitação técnica: mostra que a categoria existe, sem dar acesso a um formulário
 * que ainda não faz nada de verdade). */
export function EmBreveVitrine({
  titulo,
  descricao,
  Icon,
  texto,
}: {
  titulo: string;
  descricao: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  texto: ReactNode;
}) {
  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo={titulo} descricao={descricao} />
      <div className="config-bloco" style={{ display: "flex", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              background: "var(--brand-soft, rgba(37, 99, 235, 0.14))",
              color: "var(--brand, #2563eb)",
            }}
          >
            <Icon width={26} height={26} />
          </div>
          <span className="nav-badge-em-breve" style={{ marginLeft: 0, marginBottom: 10, display: "inline-block" }}>
            Em breve
          </span>
          <p className="hint" style={{ fontSize: 13, lineHeight: 1.6 }}>
            {texto}
          </p>
        </div>
      </div>
    </div>
  );
}
