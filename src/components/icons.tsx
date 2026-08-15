import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconInicio(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function IconConversas(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.6-3.8A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

export function IconTarefas(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export function IconAcoes(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11v2a2 2 0 0 0 2 2h1l3 4v-4h9a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H7L4 3v4H5a2 2 0 0 0-2 2Z" />
      <path d="M17 8a3 3 0 0 1 0 6" />
    </svg>
  );
}

export function IconEquipe(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M14.5 14.3c2.6.4 4.5 2.6 4.5 5.7" />
    </svg>
  );
}

export function IconContatos(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function IconPipeline(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="6" height="16" rx="1" />
      <rect x="10" y="4" width="6" height="10" rx="1" />
      <rect x="17" y="4" width="4" height="7" rx="1" />
    </svg>
  );
}

export function IconTrafego(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </svg>
  );
}

export function IconRelatorios(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function IconAutomacoes(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}

export function IconConfiguracoes(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export function IconBell(props: Props) {
  return (
    <svg {...base} width={16} height={16} {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function IconSearch(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function IconDoc(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

export function IconImage(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M21 15l-5-5-9 9" />
    </svg>
  );
}

export function IconMic(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v4" />
    </svg>
  );
}

export function IconEmoji(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10h.01" />
      <path d="M15.5 10h.01" />
      <path d="M8.5 14.5a4 4 0 0 0 7 0" />
    </svg>
  );
}

export function IconText(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
    </svg>
  );
}

export function IconSparkle(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
      <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4Z" />
    </svg>
  );
}

export function IconSwitch(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4v10a3 3 0 0 0 3 3h9" />
      <path d="m16 14 3 3-3 3" />
      <path d="M17 20V10a3 3 0 0 0-3-3H5" />
      <path d="m8 10-3-3 3-3" />
    </svg>
  );
}

export function IconCamera(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 8a2 2 0 0 1 2-2h1.5l1-1.5h9l1 1.5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function IconCalendar(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

/* --- Marcas de canal (usam as cores oficiais das plataformas) --- */

export function IconWhatsApp(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="#25D366" {...props}>
      <path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.4.8 3.1 1.3 4.8 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
    </svg>
  );
}

export function IconInstagram(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="#E1306C" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="6" />
    </svg>
  );
}

export function IconRefresh(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function IconVideoCam(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="6" width="14" height="12" rx="2.5" />
      <path d="M16 10.5l5.2-3.1a1 1 0 0 1 1.5.86v7.5a1 1 0 0 1-1.5.86L16 13.5" />
    </svg>
  );
}

export function IconLocalizacao(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 22s7-7.4 7-12.5A7 7 0 0 0 5 9.5C5 14.6 12 22 12 22Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function IconRespostaRapida(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.6-3.8A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M8 10.5h8M8 13.5h5" />
    </svg>
  );
}

export function IconRelogio(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </svg>
  );
}

export function IconCheck(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12.5l4.2 4.2L20 5.5" />
    </svg>
  );
}

export function IconCheckDuplo(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M1 12.5l4.2 4.2L13 8.7" />
      <path d="M8 12.5l4.2 4.2L23 5.5" />
    </svg>
  );
}

export function IconErro(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v6M12 16.5h.01" />
    </svg>
  );
}

export function IconEnviar(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12L20 4l-6 16-3-7-7-1Z" />
    </svg>
  );
}

/** Segurança (autenticação, sessões) — sem ícone de cadeado/escudo existente ainda, adicionado no
 * mesmo estilo (stroke, viewBox) dos demais, não é uma biblioteca nova. */
export function IconEscudo(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** Auditoria e atividades. */
export function IconHistorico(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

/** Importação e exportação. */
export function IconImportar(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

/** Plano e cobrança. */
export function IconCartao(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
      <path d="M6 15h4" />
    </svg>
  );
}

export function IconTikTok(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="#F5F5F5" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="6" />
    </svg>
  );
}

export function CanalBadge({ canal }: { canal: "WhatsApp" | "Instagram" | "TikTok" }) {
  return (
    <span className="ch-badge">
      {canal === "WhatsApp" ? (
        <IconWhatsApp />
      ) : canal === "Instagram" ? (
        <IconInstagram />
      ) : (
        <IconTikTok />
      )}
    </span>
  );
}

/* Redesign — ícones lineares (mesma família Lucide-like do resto do arquivo) pra substituir emoji
   usado como ícone de interface (⚠️✕✓⭐📌▶⏸📎📷🔒🎤🔔📍), que o pedido de redesign proíbe
   explicitamente ("NÃO UTILIZAR EMOJIS NA INTERFACE"). Emoji digitado pelo usuário dentro de uma
   mensagem de chat não entra aqui — é conteúdo, não ícone. */

export function IconClose(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function IconStar(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01Z" />
    </svg>
  );
}

export function IconAlerta(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconPin(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 17v5" />
      <path d="M9 10.5a3 3 0 1 0 6 0V5a1 1 0 0 0-1-1H10a1 1 0 0 0-1 1Z" />
      <path d="M6 10.5h12" />
    </svg>
  );
}

export function IconPlay(props: Props) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <path d="M8 5v14l11-7Z" />
    </svg>
  );
}

export function IconPause(props: Props) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function IconAnexo(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48" />
    </svg>
  );
}

export function IconCadeado(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function IconCadeadoAberto(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.5-2.5" />
    </svg>
  );
}

export function IconLixeira(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function IconFolder(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

export function IconEdit(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function IconDuplicar(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconPrint(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9V2h12v7" />
      <rect x="4" y="9" width="16" height="8" rx="2" />
      <path d="M6 17h12v5H6z" />
    </svg>
  );
}

export function IconPaint(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2a7 7 0 0 0-7 7c0 3.5 2 4.5 2 7a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2c0-2.5 2-3.5 2-7a7 7 0 0 0-7-7Z" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="13" cy="7" r="1" />
      <circle cx="15" cy="11" r="1" />
    </svg>
  );
}

export function IconChecklist(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="6" height="6" rx="1" />
      <path d="M4.5 7l1 1 2-2" />
      <path d="M11 7h10" />
      <rect x="3" y="14" width="6" height="6" rx="1" />
      <path d="M11 17h10" />
    </svg>
  );
}

export function IconQuote(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 7a3 3 0 0 0-3 3v3a1 1 0 0 0 1 1h3v-4H6a2 2 0 0 1 2-2V7Z" />
      <path d="M17 7a3 3 0 0 0-3 3v3a1 1 0 0 0 1 1h3v-4h-2a2 2 0 0 1 2-2V7Z" />
    </svg>
  );
}

export function IconSignature(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 17c2-4 4-6 6-4s0 4 2 4 3-6 5-6 2 3 4 3" />
      <path d="M3 21h18" />
    </svg>
  );
}

export function IconSpellCheck(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 15 8 5l4 10" />
      <path d="M5.5 11.5h5" />
      <path d="M13 15l3-10 3 10" />
      <path d="M20 21l-8-8" />
      <path d="M12 21l8-8" />
    </svg>
  );
}

export function IconCut(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.5 15.5" />
      <path d="M14.5 9.5 20 15" />
      <path d="M8.5 8.5 6 6" />
    </svg>
  );
}

export function IconCopy(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconPaste(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </svg>
  );
}

export function IconLink(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 17H7a5 5 0 0 1 0-10h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function IconCrop(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  );
}

export function IconRepeat(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function IconGlobo(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  );
}

export function IconOlho(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconOlhoFechado(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.4" />
      <path d="M6.4 6.4C3.6 8.2 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.3 3.6-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

export function IconAperto(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M11 13 4 6a2 2 0 0 1 3-3l5 5" />
      <path d="M13 11l7 7a2 2 0 0 1-3 3l-5-5" />
      <path d="M9 15l-3 3" />
      <path d="M13 9l3-3" />
    </svg>
  );
}

export function IconMoeda(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 3.2 6 1.6 6 4.7 0 1.4-1.3 2.5-3 2.5s-3-1.1-3-2.5" />
    </svg>
  );
}

export function IconDownload(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </svg>
  );
}

export function IconRestaurar(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

export function IconAlignJustify(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

export function IconTelefone(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

export function IconEmail(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

export function IconVolume(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M11 5 6 9H2v6h4l5 4Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

export function IconMudo(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M11 5 6 9H2v6h4l5 4Z" />
      <path d="M23 9l-6 6" />
      <path d="M17 9l6 6" />
    </svg>
  );
}

export function IconEtiqueta(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12.6 2.6a2 2 0 0 0-1.4-.6H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

export function IconAlvo(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

export function IconProibido(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5 5 14 14" />
    </svg>
  );
}

export function IconSalvar(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

export function IconEncaminhar(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
