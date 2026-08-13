import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM AZUZ — WhatsApp, funil e automação num só lugar",
  description:
    "O CRM que centraliza WhatsApp, Instagram, funil de vendas, automações e IA num painel só. Experimente o CRM AZUZ.",
};

const RECURSOS = [
  {
    titulo: "WhatsApp e Instagram unificados",
    descricao: "Toda conversa do time num só lugar, sem trocar de app nem perder histórico.",
  },
  {
    titulo: "Funil visual",
    descricao: "Arraste negócios entre etapas, veja onde cada venda travou e por quê.",
  },
  {
    titulo: "Automações sem código",
    descricao: "Monte fluxos de follow-up, distribuição de leads e cobrança sem escrever nada.",
  },
  {
    titulo: "Azuz IA",
    descricao: "Um assistente que já conhece os dados do seu negócio e responde na hora.",
  },
  {
    titulo: "Agenda integrada",
    descricao: "Compromissos, tarefas e prazos do time num calendário só, sem choque de horário.",
  },
  {
    titulo: "Relatórios de verdade",
    descricao: "CPL, ROAS, atribuição e performance de vendas — sem planilha manual.",
  },
];

/**
 * Landing page pública (item 6 do pedido) — antes o domínio raiz redirecionava direto pra
 * `/login`, sem nenhuma apresentação do produto. Copy é um rascunho inicial pra sair do zero;
 * troque o texto e o vídeo quando tiver o material definitivo (área reservada abaixo do hero).
 */
export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--navy)", color: "var(--ink)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 28px",
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--blue)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--display)",
              fontWeight: 700,
            }}
          >
            a
          </div>
          <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 16 }}>azuz crm</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/login" className="btn ghost">
            Entrar
          </Link>
          <Link href="/cadastro" className="btn primary">
            Criar conta
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 28px 80px" }}>
        <section style={{ textAlign: "center", padding: "40px 0 24px" }}>
          <h1
            style={{
              fontFamily: "var(--display)",
              fontWeight: 700,
              fontSize: "clamp(28px, 5vw, 44px)",
              lineHeight: 1.15,
              maxWidth: 760,
              margin: "0 auto 16px",
            }}
          >
            O CRM que roda o comercial da sua empresa do início ao fim
          </h1>
          <p style={{ fontSize: 16, color: "var(--text-muted)", maxWidth: 560, margin: "0 auto 28px" }}>
            WhatsApp, Instagram, funil de vendas, automações e IA num painel só — sem planilha, sem app espalhado.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/cadastro" className="btn primary" style={{ padding: "12px 24px", fontSize: 14 }}>
              Criar conta
            </Link>
            <Link href="/login" className="btn ghost" style={{ padding: "12px 24px", fontSize: 14 }}>
              Já tenho conta
            </Link>
          </div>
        </section>

        <section style={{ margin: "32px 0 56px" }}>
          <div
            style={{
              aspectRatio: "16 / 9",
              maxWidth: 860,
              margin: "0 auto",
              background: "var(--navy-raised)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--blue-soft)",
                color: "var(--blue)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              ▶
            </div>
            <p style={{ color: "var(--text-faint)", fontSize: 12.5 }}>Vídeo de apresentação em breve</p>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
            marginBottom: 56,
          }}
        >
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="card" style={{ padding: 20 }}>
              <h3 style={{ fontFamily: "var(--display)", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{r.titulo}</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{r.descricao}</p>
            </div>
          ))}
        </section>

        <section className="card" style={{ padding: 32, textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
          <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-faint)", fontWeight: 700 }}>
            Plano único
          </p>
          <p style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 36, margin: "8px 0" }}>
            R$ 249,90<span style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 400 }}>/mês</span>
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            Todos os recursos, usuários ilimitados, sem taxa de setup.
          </p>
          <Link href="/cadastro" className="btn primary block">
            Criar conta
          </Link>
        </section>
      </main>

      <footer style={{ textAlign: "center", padding: "24px 0 32px", fontSize: 11.5, color: "var(--text-faint)" }}>
        © {new Date().getFullYear()} Azuz CRM
      </footer>
    </div>
  );
}
