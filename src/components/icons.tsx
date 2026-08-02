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
