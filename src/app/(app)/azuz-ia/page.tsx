"use client";

import { IconSparkle } from "@/components/icons";
import { Topbar } from "@/components/ui";

/**
 * Azuz IA desativada temporariamente (decisão de produto, não limitação técnica — o backend real
 * já existe e funciona, ver `src/app/api/azuz-ia/perguntar/route.ts` e `src/lib/azuz-ia/claude.ts`).
 * Esta tela NÃO chama a API real de propósito — é só uma vitrine informativa, pra não dar acesso a
 * uma experiência parcial nem mostrar dado fictício de conversa. Reativar é trocar este componente
 * de volta pelo chat (a rota de API não precisa de nenhuma mudança).
 */
export default function AzuzIaPage() {
  return (
    <>
      <Topbar
        title="Azuz IA"
        sub="Sua assistente dentro do CRM — pergunta qualquer coisa sobre leads, tarefas ou funil"
      />

      <div className="content" style={{ justifyContent: "center", alignItems: "center", display: "flex" }}>
        <div className="card" style={{ maxWidth: 480, padding: "40px 36px", textAlign: "center" }}>
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
            <IconSparkle width={26} height={26} />
          </div>
          <span className="nav-badge-em-breve" style={{ marginLeft: 0, marginBottom: 10, display: "inline-block" }}>
            Em breve
          </span>
          <h2 style={{ fontFamily: "var(--display)", fontSize: 20, margin: "6px 0 10px" }}>
            Azuz IA está em desenvolvimento
          </h2>
          <p className="hint" style={{ fontSize: 13, lineHeight: 1.6 }}>
            Estamos trabalhando pra trazer uma assistente que entende os dados reais do seu
            workspace — leads, conversas, tarefas e funil — e responde suas perguntas na hora. Em
            breve ela estará disponível por aqui.
          </p>
        </div>
      </div>
    </>
  );
}
