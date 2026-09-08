import Image from "next/image";
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
  title: "CRM AZUZ: WhatsApp, funil e automação num só lugar",
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
    descricao: "CPL, ROAS, atribuição e performance de vendas. Sem planilha manual.",
  },
];

const FUNIL_ETAPAS = [
  { nome: "Novo", cards: [{ nome: "Marcos Aurélio", valor: "R$ 890" }, { nome: "Fernando Lima", valor: "R$ 640" }] },
  { nome: "Qualificado", cards: [{ nome: "Beatriz Nogueira", valor: "R$ 1.240" }, { nome: "Camila Duarte", valor: "R$ 780" }] },
  { nome: "Proposta", cards: [{ nome: "Julia Prado", valor: "R$ 2.100" }] },
  { nome: "Fechado", cards: [{ nome: "Paulo Lacerda", valor: "R$ 1.560" }] },
];

/**
 * Landing page pública (item 6 do pedido). Antes o domínio raiz redirecionava direto pra
 * `/login`. Tema fixo, independente do claro/escuro do app: é página de marketing e não herda a
 * preferência salva do usuário.
 *
 * A identidade aqui é MARINHO com o azul oceano da marca. A versão anterior era preto, branco e
 * cinza: correta, silenciosa e igual a metade das landings de SaaS. O que se pede de uma página de
 * entrada não é discrição, é ser lembrada, e num produto que vende tecnologia a própria página
 * precisa parecer tecnologia.
 *
 * A profundidade vem de fundo escuro com superfícies translúcidas empilhadas, de um campo de luz
 * que se move devagar atrás do título, e de entrada escalonada dos elementos. Não de neon: o azul
 * aparece em poucos lugares e sempre com função (a marca, o botão principal, a metade destacada do
 * título, a barra de hoje no gráfico). Fundo escuro com um acento só é o que separa "tecnológico"
 * de "árvore de Natal".
 *
 * As telas de produto abaixo do hero são recriações fiéis das UIs internas (mesma estrutura de
 * Início, Funil e Conversas): não são screenshots reais porque esse ambiente não alcança o banco
 * de produção pra logar e capturar; troque por prints/gravação real quando possível.
 */
export default function LandingPage() {
  return (
    <div className="lp-root">
      <style>{`
        .lp-root {
          /* Paleta da landing: preto, branco e cinzas. Ela tem tokens próprios porque é pré-login
             e não segue o tema claro/escuro escolhido pelo usuário. Antes isso servia pra fixar
             o fundo escuro, agora fixa o claro. O azul da marca sai do primeiro contato de
             propósito: a página vende com tipografia, espaço e proporção, não com cor. */
          /* O fundo é mais fundo que o marinho da marca de propósito: assim o próprio marinho
             (#0b1533) pode ser usado como superfície ELEVADA em cima dele, e a página ganha
             camadas em vez de ser um bloco de cor só. */
          --lp-bg: #060b1a;
          --lp-bg-2: #0b1533;
          --lp-ink: #ffffff;
          --lp-muted: rgba(255, 255, 255, 0.68);
          --lp-faint: rgba(255, 255, 255, 0.46);
          --lp-line: rgba(255, 255, 255, 0.1);
          --lp-line-forte: rgba(255, 255, 255, 0.24);
          --lp-superficie: rgba(255, 255, 255, 0.05);
          --lp-superficie-2: rgba(255, 255, 255, 0.08);
          /* O oceano da marca. É o único acento da página. */
          --lp-oceano: #2e6bff;
          --lp-oceano-claro: #7ea2ff;
          min-height: 100vh;
          background: var(--lp-bg);
          color: var(--lp-ink);
          font-family: var(--body);
          position: relative;
          overflow: hidden;
          /* A landing é sempre escura, independente do tema do sistema: sem isto o navegador de
             quem usa no claro pinta os controles nativos (barra de rolagem, autofill) como se a
             página fosse clara, e eles aparecem como manchas brancas. */
          color-scheme: dark;
        }
        /* Malha quase invisível atrás do topo. Dá o traço "tecnológico" sem virar mais um
           elemento na tela. Some antes do primeiro bloco de conteúdo. */
        .lp-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 72px 72px;
          mask-image: radial-gradient(ellipse 65% 42% at 50% 0%, #000 30%, transparent 100%);
          pointer-events: none;
        }

        /* Campo de luz atrás do título: duas manchas de azul muito diluídas que respiram devagar,
           em ciclos longos e diferentes entre si, pra nunca baterem no mesmo compasso (é a
           repetição que denuncia o efeito). Fica atrás de tudo e não recebe clique. É o que dá
           profundidade sem acender neon em cima do texto. */
        .lp-aurora {
          position: absolute;
          inset: -20% -10% auto;
          height: 900px;
          pointer-events: none;
          background:
            radial-gradient(ellipse 42% 38% at 28% 32%, rgba(46, 107, 255, 0.3), transparent 70%),
            radial-gradient(ellipse 38% 34% at 74% 20%, rgba(126, 162, 255, 0.18), transparent 72%);
          filter: blur(28px);
          animation: lp-respirar 18s ease-in-out infinite;
        }

        @keyframes lp-respirar {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.9; }
          50% { transform: translate3d(-2%, 2%, 0) scale(1.08); opacity: 1; }
        }

        /* Entrada dos elementos do topo, em cascata curta. A página se monta na ordem em que se
           lê, em vez de aparecer inteira e pronta. */
        @keyframes lp-entrar {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: none; }
        }
        .lp-badge, .lp-h1, .lp-sub, .lp-cta-row, .lp-microcopy, .lp-frame-wrap {
          animation: lp-entrar 0.62s cubic-bezier(0.22, 0.61, 0.36, 1) both;
        }
        .lp-h1 { animation-delay: 0.06s; }
        .lp-sub { animation-delay: 0.12s; }
        .lp-cta-row { animation-delay: 0.18s; }
        .lp-microcopy { animation-delay: 0.24s; }
        .lp-frame-wrap { animation-delay: 0.3s; }
        .lp-shell { position: relative; max-width: 1120px; margin: 0 auto; padding: 0 24px; }

        /* Header flutuante: uma faixa branca destacada do topo, com borda fina, em vez de colada
           na borda da janela. É o que dá a leitura de "aplicação", não de site. */
        .lp-header { position: sticky; top: 0; z-index: 20; padding: 18px 0 0; }
        .lp-header-inner {
          display: flex; align-items: center; justify-content: space-between;
          max-width: 940px; margin: 0 auto; padding: 10px 10px 10px 22px;
          border: 1px solid var(--lp-line); border-radius: 999px;
          /* Vidro escuro, não branco: sobre o marinho o branco translúcido vira uma faixa leitosa
             que apaga o que passa por baixo. */
          background: rgba(11, 21, 51, 0.72);
          backdrop-filter: blur(16px);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 34px -12px rgba(0, 0, 0, 0.6);
        }
        .lp-logo { display: flex; align-items: center; gap: 9px; }
        /* O arquivo da marca está em retrato, com sobra de azul em cima e embaixo. O object-fit
           cover mostra o miolo, que é onde o desenho está, em vez de encolher a folha inteira e
           deixar o "a" minúsculo dentro de um retângulo azul. */
        .lp-mark {
          width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
          object-fit: cover;
        }
        .lp-brand { font-family: var(--display); font-weight: 700; font-size: 15.5px; letter-spacing: -0.01em; white-space: nowrap; }
        .lp-nav-actions { display: flex; gap: 6px; align-items: center; }
        .lp-btn {
          font-family: var(--body); font-weight: 600; font-size: 13.5px; cursor: pointer;
          border-radius: 999px; padding: 10px 18px; text-decoration: none; display: inline-flex;
          align-items: center; gap: 7px; border: 1px solid transparent;
          transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
          white-space: nowrap;
        }
        .lp-btn-ghost { color: var(--lp-ink); border-color: transparent; background: transparent; }
        .lp-btn-ghost:hover { background: var(--lp-superficie); }
        .lp-btn-primary {
          color: #ffffff; background: var(--lp-oceano);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 10px 26px -12px rgba(46, 107, 255, 0.9);
        }
        .lp-btn-primary:hover { background: #1f57e0; }
        /* A seta é do botão, não do texto: entra por CSS pra nenhuma frase da página mudar. */
        .lp-btn-primary::after { content: "→"; font-size: 13px; line-height: 1; }
        .lp-btn-linha { color: var(--lp-ink); border-color: var(--lp-line-forte); background: var(--lp-superficie); }
        .lp-btn-linha:hover { background: var(--lp-superficie-2); }

        .lp-badge {
          display: inline-flex; align-items: center; gap: 8px; margin: 0 auto 30px;
          padding: 7px 15px 7px 11px; border-radius: 999px; border: 1px solid var(--lp-line);
          background: var(--lp-superficie); font-size: 11.5px; font-weight: 600; color: var(--lp-muted);
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .lp-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--lp-oceano-claro); animation: lp-pulse 2.4s ease-in-out infinite; }
        @keyframes lp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

        .lp-hero { text-align: center; padding: 104px 0 0; }
        .lp-h1 {
          font-family: var(--display); font-weight: 700;
          /* Título grande de verdade, com entrelinha fechada e tracking negativo. É daí que vem
             a presença da referência, não de cor nem de efeito. */
          font-size: clamp(38px, 6.6vw, 76px); line-height: 1.03; letter-spacing: -0.035em;
          max-width: 940px; margin: 0 auto 22px;
          text-wrap: balance;
        }
        .lp-h1 span {
          /* A metade destacada da frase volta a ter cor. Num título de 76px em fundo escuro, é o
             que faz o olho parar na parte que importa antes de ler a frase inteira. Gradiente e
             não chapado: dá a leitura de luz atravessando o texto, que é o traço tecnológico que
             a página pedia, sem acender nada. */
          background: linear-gradient(100deg, var(--lp-oceano-claro), var(--lp-oceano));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .lp-sub {
          font-size: 17px; color: var(--lp-muted); max-width: 580px; margin: 0 auto 34px;
          line-height: 1.55; text-wrap: pretty;
        }
        .lp-cta-row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-bottom: 18px; }
        .lp-cta-row .lp-btn { padding: 13px 26px; font-size: 14px; }
        .lp-microcopy { font-size: 12.5px; color: var(--lp-faint); }

        /* --- Telas de produto --- */
        .lp-frame-wrap { margin: 84px 0 0; }
        .lp-frame {
          max-width: 940px; margin: 0 auto; border-radius: 18px; overflow: hidden;
          background: var(--lp-bg-2);
          border: 1px solid var(--lp-line);
          /* Fio de luz na quina de cima e sombra funda embaixo: sobre fundo escuro é o contraste
             de aresta que descola o cartão, não a sombra sozinha. */
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 30px 70px -30px rgba(0, 0, 0, 0.9),
            0 0 0 1px rgba(46, 107, 255, 0.12);
        }
        .lp-frame-bar {
          display: flex; align-items: center; gap: 7px; padding: 12px 16px;
          background: rgba(255, 255, 255, 0.04); border-bottom: 1px solid var(--lp-line);
        }
        /* Os três pontos ficam em cinza: em vermelho/amarelo/verde eram as cores mais fortes da
           página inteira, e ficariam brigando com o conteúdo do próprio print. */
        .lp-frame-dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); }
        .lp-frame-url {
          margin-left: 10px; font-size: 11.5px; color: var(--lp-faint); font-family: var(--body);
          background: var(--lp-superficie); border: 1px solid var(--lp-line); border-radius: 999px; padding: 4px 14px;
        }

        .lp-crm { padding: 20px; display: grid; grid-template-columns: 186px 1fr; gap: 18px; }
        .lp-crm-side { display: flex; flex-direction: column; gap: 2px; }
        .lp-crm-side-item {
          font-size: 12px; color: var(--lp-faint); padding: 8px 11px; border-radius: 8px;
          display: flex; align-items: center; gap: 9px;
        }
        .lp-crm-side-item.active { color: var(--lp-ink); background: var(--lp-superficie-2); font-weight: 600; }
        .lp-crm-side-item svg { width: 14px; height: 14px; opacity: 0.75; }
        .lp-crm-main { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .lp-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .lp-kpi { border: 1px solid var(--lp-line); background: var(--lp-superficie); border-radius: 12px; padding: 12px 13px; }
        .lp-kpi .l { font-size: 10.5px; color: var(--lp-faint); margin-bottom: 5px; }
        .lp-kpi .n { font-family: var(--display); font-weight: 700; font-size: 18px; letter-spacing: -0.02em; }
        .lp-kpi .d { font-size: 10px; color: var(--lp-muted); margin-top: 3px; }
        .lp-chart {
          border: 1px solid var(--lp-line); background: var(--lp-superficie);
          border-radius: 12px; padding: 13px; display: flex; align-items: flex-end; gap: 5px; height: 92px;
        }
        .lp-bar { flex: 1; border-radius: 3px 3px 0 0; background: rgba(255, 255, 255, 0.14); }
        .lp-bar.now { background: linear-gradient(180deg, var(--lp-oceano-claro), var(--lp-oceano)); }

        .lp-funil { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .lp-funil-col { border: 1px solid var(--lp-line); border-radius: 12px; padding: 10px; background: rgba(255, 255, 255, 0.03); }
        .lp-funil-col-h { font-size: 10px; font-weight: 700; color: var(--lp-faint); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 9px; padding: 0 2px; }
        .lp-funil-card {
          border: 1px solid var(--lp-line); border-radius: 10px; padding: 9px 10px; margin-bottom: 7px;
          background: var(--lp-superficie-2); font-size: 11px;
        }
        .lp-funil-card:last-child { margin-bottom: 0; }
        .lp-funil-card .fn { font-weight: 600; margin-bottom: 3px; }
        .lp-funil-card .fv { color: var(--lp-faint); font-size: 10.5px; }

        .lp-conv { display: grid; grid-template-columns: 168px 1fr; gap: 10px; height: 148px; }
        .lp-conv-list { border: 1px solid var(--lp-line); border-radius: 12px; overflow: hidden; background: var(--lp-superficie); }
        .lp-conv-item { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-bottom: 1px solid var(--lp-line); }
        .lp-conv-item .av { width: 22px; height: 22px; border-radius: 50%; background: var(--lp-superficie-2); border: 1px solid var(--lp-line); flex-shrink: 0; }
        .lp-conv-item .tx { min-width: 0; }
        .lp-conv-item .nm { font-size: 10.5px; font-weight: 600; }
        .lp-conv-item .ms { font-size: 9.5px; color: var(--lp-faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-conv-chat { border: 1px solid var(--lp-line); border-radius: 12px; padding: 12px; background: rgba(255, 255, 255, 0.03); display: flex; flex-direction: column; gap: 7px; justify-content: flex-end; }
        .lp-bubble { max-width: 74%; font-size: 10.5px; padding: 8px 11px; border-radius: 12px; line-height: 1.45; }
        .lp-bubble.in { align-self: flex-start; background: var(--lp-superficie-2); border: 1px solid var(--lp-line); border-bottom-left-radius: 4px; }
        .lp-bubble.out { align-self: flex-end; background: var(--lp-oceano); color: #fff; border-bottom-right-radius: 4px; }

        .lp-tabs-caption { display: flex; justify-content: center; gap: 26px; padding: 0 0 16px; }
        .lp-tabs-caption span { font-size: 12px; color: var(--lp-faint); display: flex; align-items: center; gap: 7px; }
        .lp-tabs-caption b { color: var(--lp-ink); font-weight: 700; font-variant-numeric: tabular-nums; }

        /* --- Respiro entre blocos --- */
        .lp-section-head { text-align: center; margin: 132px auto 48px; max-width: 620px; }
        .lp-eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--lp-faint); margin-bottom: 14px; }
        .lp-h2 { font-family: var(--display); font-weight: 700; font-size: clamp(28px, 4vw, 44px); line-height: 1.08; letter-spacing: -0.03em; margin-bottom: 14px; text-wrap: balance; }
        .lp-section-head p { font-size: 16px; color: var(--lp-muted); line-height: 1.6; }

        .lp-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(266px, 1fr)); gap: 14px; }
        .lp-feature {
          border: 1px solid var(--lp-line); border-radius: 16px; padding: 26px 24px 28px;
          background: var(--lp-superficie);
          transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease,
            background 0.18s ease;
        }
        /* No hover o cartão sobe 2px e a borda pega o azul. Deslocamento pequeno e uma cor só: é o
           bastante pra dizer "isto responde", que é a leitura que se quer num produto de software. */
        .lp-feature:hover {
          border-color: rgba(46, 107, 255, 0.55);
          background: var(--lp-superficie-2);
          transform: translateY(-2px);
          box-shadow: 0 18px 40px -22px rgba(0, 0, 0, 0.9);
        }
        .lp-feature-icon {
          width: 38px; height: 38px; border-radius: 11px; margin-bottom: 18px;
          background: rgba(46, 107, 255, 0.16); border: 1px solid rgba(46, 107, 255, 0.34);
          color: var(--lp-oceano-claro); display: flex; align-items: center; justify-content: center;
        }
        .lp-feature-icon svg { width: 17px; height: 17px; }
        .lp-feature h3 { font-family: var(--display); font-size: 15.5px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.015em; }
        .lp-feature p { font-size: 13.5px; color: var(--lp-muted); line-height: 1.6; }

        .lp-pricing {
          max-width: 460px; margin: 132px auto 0; text-align: center; padding: 44px 36px 38px;
          border-radius: 20px; position: relative;
          border: 1px solid rgba(46, 107, 255, 0.34);
          background: var(--lp-bg-2);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 30px 70px -30px rgba(0, 0, 0, 0.9),
            0 0 60px -20px rgba(46, 107, 255, 0.4);
        }
        .lp-pricing-tag {
          font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;
          color: var(--lp-faint); margin-bottom: 16px;
        }
        .lp-price { font-family: var(--display); font-weight: 700; font-size: 54px; letter-spacing: -0.04em; line-height: 1; margin-bottom: 10px; }
        .lp-price span { font-size: 16px; color: var(--lp-faint); font-weight: 400; letter-spacing: 0; margin-left: 6px; }
        .lp-pricing-sub { font-size: 14px; color: var(--lp-muted); margin-bottom: 28px; line-height: 1.55; }
        .lp-checklist { display: flex; flex-direction: column; gap: 12px; text-align: left; margin-bottom: 30px; }
        .lp-checklist div { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--lp-ink); }
        .lp-checklist svg { width: 15px; height: 15px; color: var(--lp-oceano-claro); flex-shrink: 0; }

        .lp-footer { text-align: center; margin-top: 132px; padding: 28px 0 44px; font-size: 12px; color: var(--lp-faint); border-top: 1px solid var(--lp-line); }

        @media (max-width: 860px) {
          .lp-hero { padding-top: 72px; }
          .lp-frame-wrap { margin-top: 56px; }
          .lp-section-head { margin: 92px auto 36px; }
          .lp-pricing { margin-top: 92px; }
          .lp-footer { margin-top: 92px; }
        }
        @media (max-width: 520px) {
          /* Sem isto a marca quebra em duas linhas e a faixa do header cresce: em 390px de largura
             o nome, "Entrar" e "Criar conta" não cabem com o respiro do desktop. */
          .lp-header-inner { padding: 8px 8px 8px 14px; }
          .lp-mark { width: 22px; height: 22px; border-radius: 7px; }
          .lp-brand { font-size: 14px; }
          .lp-nav-actions .lp-btn { padding: 9px 13px; font-size: 12.5px; }
        }
        @media (max-width: 720px) {
          .lp-header-inner { padding-left: 18px; }
          .lp-crm { grid-template-columns: 1fr; }
          .lp-crm-side { display: none; }
          .lp-funil { grid-template-columns: repeat(2, 1fr); }
          .lp-kpis { grid-template-columns: repeat(2, 1fr); }
          .lp-tabs-caption { flex-wrap: wrap; gap: 12px; }
          .lp-conv { grid-template-columns: 1fr; height: auto; }
          .lp-conv-list { display: none; }
        }
        /* Quem pediu menos movimento no sistema não vê o pulso do ponto. */
        @media (prefers-reduced-motion: reduce) {
          .lp-dot,
          .lp-aurora,
          .lp-badge, .lp-h1, .lp-sub, .lp-cta-row, .lp-microcopy, .lp-frame-wrap {
            animation: none;
          }
          .lp-badge, .lp-h1, .lp-sub, .lp-cta-row, .lp-microcopy, .lp-frame-wrap {
            opacity: 1;
            transform: none;
          }
          .lp-feature:hover { transform: none; }
        }
      `}</style>

      <div className="lp-aurora" aria-hidden />
      <div className="lp-grid" aria-hidden />

      <div className="lp-shell">
        <header className="lp-header">
          <div className="lp-header-inner">
            <div className="lp-logo">
              {/* A marca de verdade, no lugar da letra desenhada por CSS. */}
              <Image
                src="/marca/logo-azuz.jpg"
                alt="AZUZ"
                width={26}
                height={26}
                className="lp-mark"
                priority
              />
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
              WhatsApp, Instagram, funil de vendas, automações e IA num painel só. Sem
              planilha, sem app espalhado.
            </p>
            <div className="lp-cta-row">
              <Link href="/cadastro" className="lp-btn lp-btn-primary">
                Criar conta agora
              </Link>
              <Link href="/login" className="lp-btn lp-btn-linha">
                Já tenho conta
              </Link>
            </div>
            <p className="lp-microcopy">Ativação imediata após a confirmação do pagamento.</p>
          </section>

          <section className="lp-frame-wrap">
            <div className="lp-frame">
              <div className="lp-frame-bar">
                <span className="lp-frame-dot" />
                <span className="lp-frame-dot" />
                <span className="lp-frame-dot" />
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

          <section className="lp-frame-wrap">
            <div className="lp-frame">
              <div className="lp-frame-bar">
                <span className="lp-frame-dot" />
                <span className="lp-frame-dot" />
                <span className="lp-frame-dot" />
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
                  <b>02</b> Funil visual: arraste negócios entre etapas
                </span>
              </div>
            </div>
          </section>

          <section className="lp-frame-wrap">
            <div className="lp-frame">
              <div className="lp-frame-bar">
                <span className="lp-frame-dot" />
                <span className="lp-frame-dot" />
                <span className="lp-frame-dot" />
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
