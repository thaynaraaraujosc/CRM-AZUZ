import Link from "next/link";
import type { Metadata } from "next";

import {
  IconAcoes,
  IconAutomacoes,
  IconCheck,
  IconConversas,
  IconInicio,
  IconPipeline,
  IconRelatorios,
  IconSparkle,
} from "@/components/icons";
import { PLANOS } from "@/lib/assinatura/planos";

export const metadata: Metadata = {
  title: "CRM AZUZ — WhatsApp, funil e automação num só lugar",
  description:
    "O CRM que centraliza WhatsApp, Instagram, funil de vendas, automações e IA num painel só. Experimente o CRM AZUZ.",
};

const RECURSOS = [
  {
    icon: <IconConversas />,
    titulo: "WhatsApp e Instagram unificados",
    descricao: "Toda conversa do time num só lugar, sem trocar de app nem perder histórico.",
  },
  {
    icon: <IconPipeline />,
    titulo: "Funil visual",
    descricao: "Arraste negócios entre etapas, veja onde cada venda travou e por quê.",
  },
  {
    icon: <IconAutomacoes />,
    titulo: "Automações sem código",
    descricao: "Monte fluxos de follow-up, distribuição de leads e cobrança sem escrever nada.",
  },
  {
    icon: <IconSparkle />,
    titulo: "Azuz IA",
    descricao: "Um assistente que já conhece os dados do seu negócio e responde na hora.",
  },
  {
    icon: <IconAcoes />,
    titulo: "Listas de transmissão",
    descricao: "Segmente sua base e dispare campanhas por WhatsApp, Instagram e SMS.",
  },
  {
    icon: <IconRelatorios />,
    titulo: "Relatórios de verdade",
    descricao: "CPL, ROAS, atribuição e performance de vendas — sem planilha manual.",
  },
];

const FUNIL_ETAPAS = [
  { nome: "Novo", cards: [{ nome: "Marcos Aurélio", valor: "R$ 890" }, { nome: "Fernando Lima", valor: "R$ 640" }] },
  { nome: "Qualificado", cards: [{ nome: "Beatriz Nogueira", valor: "R$ 1.240" }, { nome: "Camila Duarte", valor: "R$ 780" }] },
  { nome: "Proposta", cards: [{ nome: "Julia Prado", valor: "R$ 2.100" }] },
  { nome: "Fechado", cards: [{ nome: "Paulo Lacerda", valor: "R$ 1.560" }] },
];

/**
 * Landing page pública (item 6 do pedido) — antes o domínio raiz redirecionava direto pra
 * `/login`. Fundo escuro fixo (independe do tema claro/escuro do app — página de marketing, não
 * herda a preferência salva do usuário) pra reforçar o tom "tecnológico". As telas de produto
 * abaixo do hero são recriações fiéis das UIs internas (mesmas cores/ícones/estrutura de
 * Início, Funil e Conversas) — não são screenshots reais porque esse ambiente não alcança o
 * banco de produção pra logar e capturar; troque por prints/gravação real quando possível.
 */
export default function LandingPage() {
  return (
    <div className="lp-root">
      <style>{`
        .lp-root {
          --lp-bg: #05070f;
          --lp-bg-2: #070a17;
          --lp-ink: #eef1fb;
          --lp-muted: rgba(238, 241, 251, 0.66);
          --lp-faint: rgba(238, 241, 251, 0.4);
          --lp-line: rgba(255, 255, 255, 0.09);
          --lp-blue: #4c86ff;
          --lp-blue-2: #8ab4ff;
          --lp-glow: rgba(76, 134, 255, 0.5);
          min-height: 100vh;
          background:
            radial-gradient(900px 480px at 12% -8%, rgba(76, 134, 255, 0.22), transparent 60%),
            radial-gradient(760px 460px at 92% 8%, rgba(138, 63, 252, 0.16), transparent 55%),
            radial-gradient(900px 560px at 50% 105%, rgba(76, 134, 255, 0.14), transparent 60%),
            var(--lp-bg);
          color: var(--lp-ink);
          font-family: var(--body);
          position: relative;
          overflow: hidden;
        }
        .lp-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(ellipse 70% 55% at 50% 0%, #000 45%, transparent 100%);
          pointer-events: none;
        }
        .lp-shell { position: relative; max-width: 1180px; margin: 0 auto; padding: 0 28px; }
        .lp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 0; position: sticky; top: 0; z-index: 20;
          backdrop-filter: blur(10px);
        }
        .lp-logo { display: flex; align-items: center; gap: 10px; }
        .lp-mark {
          width: 32px; height: 32px; border-radius: 9px;
          background: linear-gradient(135deg, var(--lp-blue), #8a3ffc);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-family: var(--display); font-weight: 700; font-size: 15px;
          box-shadow: 0 0 22px var(--lp-glow);
        }
        .lp-brand { font-family: var(--display); font-weight: 700; font-size: 16px; letter-spacing: 0.01em; }
        .lp-nav-actions { display: flex; gap: 10px; align-items: center; }
        .lp-btn {
          font-family: var(--body); font-weight: 600; font-size: 13px; cursor: pointer;
          border-radius: 10px; padding: 10px 18px; text-decoration: none; display: inline-flex;
          align-items: center; gap: 6px; border: 1px solid transparent; transition: all 0.15s ease;
        }
        .lp-btn-ghost { color: var(--lp-ink); border-color: var(--lp-line); background: rgba(255, 255, 255, 0.03); }
        .lp-btn-ghost:hover { background: rgba(255, 255, 255, 0.07); border-color: rgba(255, 255, 255, 0.18); }
        .lp-btn-primary {
          color: #fff; background: linear-gradient(135deg, var(--lp-blue), #3f5fe0);
          box-shadow: 0 0 0 1px rgba(76, 134, 255, 0.4), 0 8px 24px rgba(76, 134, 255, 0.35);
        }
        .lp-btn-primary:hover { box-shadow: 0 0 0 1px rgba(76, 134, 255, 0.6), 0 10px 30px rgba(76, 134, 255, 0.5); transform: translateY(-1px); }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 8px; margin: 0 auto 22px;
          padding: 7px 14px 7px 10px; border-radius: 999px; border: 1px solid rgba(76, 134, 255, 0.35);
          background: rgba(76, 134, 255, 0.08); font-size: 12px; font-weight: 600; color: var(--lp-blue-2);
          letter-spacing: 0.02em; text-transform: uppercase;
        }
        .lp-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--lp-blue-2); box-shadow: 0 0 8px var(--lp-blue-2); animation: lp-pulse 1.8s ease-in-out infinite; }
        @keyframes lp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .lp-hero { text-align: center; padding: 64px 0 8px; }
        .lp-h1 {
          font-family: var(--display); font-weight: 700; line-height: 1.1;
          font-size: clamp(32px, 5.4vw, 56px); max-width: 900px; margin: 0 auto 18px;
          letter-spacing: -0.01em;
        }
        .lp-h1 span {
          background: linear-gradient(120deg, #fff 20%, var(--lp-blue-2) 55%, #b98bff 85%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }
        .lp-sub { font-size: 16.5px; color: var(--lp-muted); max-width: 580px; margin: 0 auto 32px; line-height: 1.55; }
        .lp-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; }
        .lp-cta-row .lp-btn { padding: 13px 26px; font-size: 14px; }
        .lp-microcopy { font-size: 12px; color: var(--lp-faint); }

        .lp-frame-wrap { margin: 56px 0 64px; perspective: 1400px; }
        .lp-frame {
          max-width: 900px; margin: 0 auto; border-radius: 16px; overflow: hidden;
          background: linear-gradient(180deg, #0c1226, #070b18);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 0 1px rgba(76, 134, 255, 0.12), 0 30px 90px rgba(0, 0, 0, 0.55), 0 0 120px rgba(76, 134, 255, 0.15);
          transform: rotateX(3deg);
          animation: lp-float 6s ease-in-out infinite;
        }
        @keyframes lp-float { 0%, 100% { transform: rotateX(3deg) translateY(0); } 50% { transform: rotateX(3deg) translateY(-8px); } }
        .lp-frame-bar {
          display: flex; align-items: center; gap: 8px; padding: 11px 14px;
          background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .lp-frame-dot { width: 10px; height: 10px; border-radius: 50%; }
        .lp-frame-url {
          margin-left: 10px; font-size: 11.5px; color: var(--lp-faint); font-family: var(--body);
          background: rgba(255, 255, 255, 0.04); border-radius: 6px; padding: 4px 12px;
        }

        .lp-crm { padding: 18px; display: grid; grid-template-columns: 190px 1fr; gap: 16px; }
        .lp-crm-side { display: flex; flex-direction: column; gap: 4px; }
        .lp-crm-side-item {
          font-size: 12px; color: var(--lp-faint); padding: 8px 10px; border-radius: 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .lp-crm-side-item.active { color: #fff; background: rgba(76, 134, 255, 0.16); font-weight: 600; }
        .lp-crm-side-item svg { width: 14px; height: 14px; opacity: 0.8; }
        .lp-crm-main { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .lp-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .lp-kpi {
          border: 1px solid var(--lp-line); background: rgba(255, 255, 255, 0.025);
          border-radius: 10px; padding: 10px 12px;
        }
        .lp-kpi .l { font-size: 10.5px; color: var(--lp-faint); margin-bottom: 4px; }
        .lp-kpi .n { font-family: var(--display); font-weight: 700; font-size: 17px; }
        .lp-kpi .d { font-size: 10px; color: #35d488; margin-top: 2px; }
        .lp-chart {
          border: 1px solid var(--lp-line); background: rgba(255, 255, 255, 0.02);
          border-radius: 10px; padding: 12px; display: flex; align-items: flex-end; gap: 5px; height: 84px;
        }
        .lp-bar { flex: 1; border-radius: 3px 3px 0 0; background: linear-gradient(180deg, var(--lp-blue-2), rgba(76, 134, 255, 0.25)); }
        .lp-bar.now { background: linear-gradient(180deg, #b98bff, rgba(138, 63, 252, 0.3)); }

        .lp-funil { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .lp-funil-col { border: 1px solid var(--lp-line); border-radius: 10px; padding: 8px; background: rgba(255, 255, 255, 0.02); }
        .lp-funil-col-h { font-size: 10.5px; font-weight: 700; color: var(--lp-faint); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 8px; padding: 0 2px; }
        .lp-funil-card {
          border: 1px solid var(--lp-line); border-radius: 8px; padding: 7px 8px; margin-bottom: 6px;
          background: rgba(255, 255, 255, 0.035); font-size: 11px;
        }
        .lp-funil-card .fn { font-weight: 600; margin-bottom: 2px; }
        .lp-funil-card .fv { color: var(--lp-blue-2); font-size: 10.5px; }

        .lp-conv { display: grid; grid-template-columns: 150px 1fr; gap: 10px; height: 132px; }
        .lp-conv-list { border: 1px solid var(--lp-line); border-radius: 10px; overflow: hidden; background: rgba(255, 255, 255, 0.02); }
        .lp-conv-item { display: flex; align-items: center; gap: 6px; padding: 7px 8px; border-bottom: 1px solid var(--lp-line); }
        .lp-conv-item .av { width: 20px; height: 20px; border-radius: 50%; background: rgba(76, 134, 255, 0.22); flex-shrink: 0; }
        .lp-conv-item .tx { min-width: 0; }
        .lp-conv-item .nm { font-size: 10.5px; font-weight: 600; }
        .lp-conv-item .ms { font-size: 9.5px; color: var(--lp-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-conv-chat { border: 1px solid var(--lp-line); border-radius: 10px; padding: 10px; background: rgba(255, 255, 255, 0.015); display: flex; flex-direction: column; gap: 6px; justify-content: flex-end; }
        .lp-bubble { max-width: 72%; font-size: 10.5px; padding: 7px 10px; border-radius: 10px; line-height: 1.4; }
        .lp-bubble.in { align-self: flex-start; background: rgba(255, 255, 255, 0.06); border-bottom-left-radius: 3px; }
        .lp-bubble.out { align-self: flex-end; background: linear-gradient(135deg, var(--lp-blue), #3f5fe0); color: #fff; border-bottom-right-radius: 3px; }

        .lp-tabs-caption { display: flex; justify-content: center; gap: 26px; padding: 12px 0 0; }
        .lp-tabs-caption span { font-size: 11.5px; color: var(--lp-faint); display: flex; align-items: center; gap: 6px; }
        .lp-tabs-caption b { color: var(--lp-blue-2); font-weight: 700; }

        .lp-section-head { text-align: center; margin: 0 auto 36px; max-width: 560px; }
        .lp-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--lp-blue-2); margin-bottom: 10px; }
        .lp-h2 { font-family: var(--display); font-weight: 700; font-size: clamp(22px, 3.2vw, 30px); margin-bottom: 10px; }
        .lp-section-head p { font-size: 14px; color: var(--lp-muted); line-height: 1.6; }

        .lp-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 80px; }
        .lp-feature {
          border: 1px solid var(--lp-line); border-radius: 14px; padding: 22px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.01));
          transition: border-color 0.2s ease, transform 0.2s ease;
        }
        .lp-feature:hover { border-color: rgba(76, 134, 255, 0.4); transform: translateY(-2px); }
        .lp-feature-icon {
          width: 38px; height: 38px; border-radius: 10px; margin-bottom: 14px;
          background: rgba(76, 134, 255, 0.12); border: 1px solid rgba(76, 134, 255, 0.25);
          color: var(--lp-blue-2); display: flex; align-items: center; justify-content: center;
        }
        .lp-feature-icon svg { width: 18px; height: 18px; }
        .lp-feature h3 { font-family: var(--display); font-size: 15px; font-weight: 700; margin-bottom: 6px; }
        .lp-feature p { font-size: 13px; color: var(--lp-muted); line-height: 1.55; }

        .lp-pricing {
          max-width: 480px; margin: 0 auto 64px; text-align: center; padding: 36px 32px;
          border-radius: 18px; position: relative; overflow: hidden;
          border: 1px solid rgba(76, 134, 255, 0.35);
          background: linear-gradient(180deg, rgba(76, 134, 255, 0.09), rgba(255, 255, 255, 0.02));
          box-shadow: 0 0 90px rgba(76, 134, 255, 0.14);
        }
        .lp-pricing-tag {
          font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700;
          color: var(--lp-blue-2); margin-bottom: 10px;
        }
        .lp-price { font-family: var(--display); font-weight: 700; font-size: 40px; margin-bottom: 4px; }
        .lp-price span { font-size: 15px; color: var(--lp-muted); font-weight: 400; }
        .lp-pricing-sub { font-size: 13px; color: var(--lp-muted); margin-bottom: 20px; }
        .lp-checklist { display: flex; flex-direction: column; gap: 8px; text-align: left; margin-bottom: 24px; }
        .lp-checklist div { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--lp-ink); }
        .lp-checklist svg { width: 15px; height: 15px; color: #35d488; flex-shrink: 0; }

        .lp-footer { text-align: center; padding: 24px 0 40px; font-size: 11.5px; color: var(--lp-faint); border-top: 1px solid var(--lp-line); }

        @media (max-width: 720px) {
          .lp-crm { grid-template-columns: 1fr; }
          .lp-crm-side { display: none; }
          .lp-funil { grid-template-columns: repeat(2, 1fr); }
          .lp-kpis { grid-template-columns: repeat(2, 1fr); }
          .lp-tabs-caption { flex-wrap: wrap; gap: 12px; }
        }
      `}</style>

      <div className="lp-grid" aria-hidden />

      <div className="lp-shell">
        <header className="lp-header">
          <div className="lp-logo">
            <div className="lp-mark">a</div>
            <span className="lp-brand">azuz crm</span>
          </div>
          <div className="lp-nav-actions">
            <Link href="/login" className="lp-btn lp-btn-ghost">
              Entrar
            </Link>
            <Link href="/cadastro" className="lp-btn lp-btn-primary">
              Criar conta
            </Link>
          </div>
        </header>

        <main>
          <section className="lp-hero">
            <span className="lp-badge">
              <span className="lp-dot" aria-hidden />
              Plataforma completa de vendas
            </span>
            <h1 className="lp-h1">
              O CRM que roda <span>o comercial</span> da sua empresa do início ao fim
            </h1>
            <p className="lp-sub">
              WhatsApp, Instagram, funil de vendas, automações e IA num painel só — sem
              planilha, sem app espalhado.
            </p>
            <div className="lp-cta-row">
              <Link href="/cadastro" className="lp-btn lp-btn-primary">
                Criar conta agora
              </Link>
              <Link href="/login" className="lp-btn lp-btn-ghost">
                Já tenho conta
              </Link>
            </div>
            <p className="lp-microcopy">Ativação imediata após a confirmação do pagamento.</p>
          </section>

          <section className="lp-frame-wrap">
            <div className="lp-frame">
              <div className="lp-frame-bar">
                <span className="lp-frame-dot" style={{ background: "#ff5f57" }} />
                <span className="lp-frame-dot" style={{ background: "#febc2e" }} />
                <span className="lp-frame-dot" style={{ background: "#28c840" }} />
                <span className="lp-frame-url">azuzcrm.com.br/inicio</span>
              </div>
              <div className="lp-crm">
                <div className="lp-crm-side">
                  <div className="lp-crm-side-item active">
                    <IconInicio /> Início
                  </div>
                  <div className="lp-crm-side-item">
                    <IconConversas /> Conversas
                  </div>
                  <div className="lp-crm-side-item">
                    <IconPipeline /> Funil
                  </div>
                  <div className="lp-crm-side-item">
                    <IconAcoes /> Ações
                  </div>
                  <div className="lp-crm-side-item">
                    <IconAutomacoes /> Automações
                  </div>
                  <div className="lp-crm-side-item">
                    <IconRelatorios /> Relatórios
                  </div>
                </div>
                <div className="lp-crm-main">
                  <div className="lp-kpis">
                    <div className="lp-kpi">
                      <p className="l">Leads no mês</p>
                      <p className="n">247</p>
                      <p className="d">↑ 18%</p>
                    </div>
                    <div className="lp-kpi">
                      <p className="l">Conversão</p>
                      <p className="n">14,6%</p>
                      <p className="d">↑ 2,1 pts</p>
                    </div>
                    <div className="lp-kpi">
                      <p className="l">Vendas</p>
                      <p className="n">R$ 38,4k</p>
                      <p className="d">↑ 9%</p>
                    </div>
                    <div className="lp-kpi">
                      <p className="l">ROAS</p>
                      <p className="n">4,2x</p>
                      <p className="d">↑ 0,4x</p>
                    </div>
                  </div>
                  <div className="lp-chart" aria-hidden>
                    {[38, 52, 44, 66, 58, 30, 34, 70, 62, 48, 55, 40, 60, 84].map((altura, i) => (
                      <div
                        key={i}
                        className={`lp-bar${i === 13 ? " now" : ""}`}
                        style={{ height: `${altura}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="lp-tabs-caption">
                <span>
                  <b>01</b> Painel com números em tempo real
                </span>
              </div>
            </div>
          </section>

          <section className="lp-frame-wrap" style={{ margin: "0 0 20px" }}>
            <div className="lp-frame" style={{ animationDelay: "-3s" }}>
              <div className="lp-frame-bar">
                <span className="lp-frame-dot" style={{ background: "#ff5f57" }} />
                <span className="lp-frame-dot" style={{ background: "#febc2e" }} />
                <span className="lp-frame-dot" style={{ background: "#28c840" }} />
                <span className="lp-frame-url">azuzcrm.com.br/funil</span>
              </div>
              <div style={{ padding: 18 }}>
                <div className="lp-funil">
                  {FUNIL_ETAPAS.map((etapa) => (
                    <div key={etapa.nome} className="lp-funil-col">
                      <p className="lp-funil-col-h">{etapa.nome}</p>
                      {etapa.cards.map((c) => (
                        <div key={c.nome} className="lp-funil-card">
                          <p className="fn">{c.nome}</p>
                          <p className="fv">{c.valor}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="lp-tabs-caption">
                <span>
                  <b>02</b> Funil visual — arraste negócios entre etapas
                </span>
              </div>
            </div>
          </section>

          <section className="lp-frame-wrap" style={{ margin: "0 0 60px" }}>
            <div className="lp-frame" style={{ animationDelay: "-1.5s" }}>
              <div className="lp-frame-bar">
                <span className="lp-frame-dot" style={{ background: "#ff5f57" }} />
                <span className="lp-frame-dot" style={{ background: "#febc2e" }} />
                <span className="lp-frame-dot" style={{ background: "#28c840" }} />
                <span className="lp-frame-url">azuzcrm.com.br/conversas</span>
              </div>
              <div style={{ padding: 18 }}>
                <div className="lp-conv">
                  <div className="lp-conv-list">
                    <div className="lp-conv-item">
                      <span className="av" />
                      <div className="tx">
                        <p className="nm">Marcos Aurélio</p>
                        <p className="ms">Quero fazer a avaliação</p>
                      </div>
                    </div>
                    <div className="lp-conv-item">
                      <span className="av" />
                      <div className="tx">
                        <p className="nm">Beatriz Nogueira</p>
                        <p className="ms">Perfeito, obrigada!</p>
                      </div>
                    </div>
                    <div className="lp-conv-item" style={{ borderBottom: "none" }}>
                      <span className="av" />
                      <div className="tx">
                        <p className="nm">Camila Duarte</p>
                        <p className="ms">Vi o anúncio no Instagram</p>
                      </div>
                    </div>
                  </div>
                  <div className="lp-conv-chat">
                    <div className="lp-bubble in">Oi! Vi o anúncio de vocês, ainda tem vaga essa semana?</div>
                    <div className="lp-bubble out">Temos sim! Consigo te encaixar quinta às 14h 🙂</div>
                    <div className="lp-bubble in">Perfeito, pode confirmar!</div>
                  </div>
                </div>
              </div>
              <div className="lp-tabs-caption">
                <span>
                  <b>03</b> WhatsApp e Instagram na mesma caixa de entrada
                </span>
              </div>
            </div>
          </section>

          <section className="lp-section-head">
            <p className="lp-eyebrow">Tudo integrado</p>
            <h2 className="lp-h2">Um painel só pro seu time inteiro</h2>
            <p>Da primeira mensagem até o pós-venda, sem sair do CRM.</p>
          </section>

          <section className="lp-features">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="lp-feature">
                <div className="lp-feature-icon">{r.icon}</div>
                <h3>{r.titulo}</h3>
                <p>{r.descricao}</p>
              </div>
            ))}
          </section>

          <section className="lp-pricing">
            <p className="lp-pricing-tag">Plano único</p>
            <p className="lp-price">
              {PLANOS.completo.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              <span>/mês</span>
            </p>
            <p className="lp-pricing-sub">Todos os recursos, usuários ilimitados, sem taxa de setup.</p>
            <div className="lp-checklist">
              <div>
                <IconCheck /> WhatsApp, Instagram e Meta Ads conectados
              </div>
              <div>
                <IconCheck /> Funil, automações e Azuz IA inclusos
              </div>
              <div>
                <IconCheck /> Usuários e permissões ilimitados
              </div>
            </div>
            <Link href="/cadastro" className="lp-btn lp-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              Criar conta agora
            </Link>
          </section>
        </main>

        <footer className="lp-footer">© {new Date().getFullYear()} Azuz CRM</footer>
      </div>
    </div>
  );
}
