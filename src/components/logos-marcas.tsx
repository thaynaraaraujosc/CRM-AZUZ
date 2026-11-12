import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

/**
 * AS LOGOS DAS EMPRESAS DE FORA, desenhadas aqui dentro.
 *
 * "O Meta Ads não está com a logo, o Google Ads também não. A gente precisa colocar a logo pra
 * ficar mais bonita."
 *
 * Tinha algo pior que a falta: o Meta Ads usava `IconCalendar` — um calendário, cinza, do lado do
 * nome de uma plataforma de anúncios —, e o Google Ads era a letra "G" dentro de um quadradinho.
 * Nenhum dos dois dizia nada; o calendário dizia a coisa errada.
 *
 * SÃO DESENHOS NOSSOS, SIMPLIFICADOS, e não os arquivos oficiais de cada marca. A escolha é
 * deliberada: arquivo oficial é download, licença e peso, e o que esta tela precisa é que a pessoa
 * reconheça a plataforma de relance numa caixinha de 20px. Se um dia a marca oficial for
 * necessária, é só trocar o conteúdo destas funções — quem chama não muda.
 *
 * Ficam num arquivo separado de `icons.tsx` porque são de outra natureza: lá é traço monocromático
 * que herda `currentColor`; aqui é cor fechada, da marca de cada um, que não pode herdar nada.
 */

const base = { viewBox: "0 0 24 24", fill: "none" } as const;

/** Meta: a fita infinita. */
export function LogoMeta(props: Props) {
  return (
    <svg {...base} {...props}>
      <path
        d="M7.3 16.6c-2.9 0-4.4-2-4.4-4.6S4.4 7.4 7.3 7.4c3 0 4.4 4.6 4.7 4.6s1.7-4.6 4.7-4.6c2.9 0 4.4 2 4.4 4.6s-1.5 4.6-4.4 4.6c-3 0-4.4-4.6-4.7-4.6S10.3 16.6 7.3 16.6Z"
        stroke="#0081FB"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Google Ads: as duas barras inclinadas e o círculo. */
export function LogoGoogleAds(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="9.4" y="1.8" width="5.2" height="14.4" rx="2.6" fill="#FBBC04" transform="rotate(-28 12 9)" />
      <rect x="9.4" y="1.8" width="5.2" height="14.4" rx="2.6" fill="#4285F4" transform="rotate(28 12 9)" />
      <circle cx="6.6" cy="18.1" r="3.3" fill="#34A853" />
    </svg>
  );
}

/** Google Agenda: a folha branca com o dia. */
export function LogoGoogleAgenda(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.2" y="3.8" width="17.6" height="16.4" rx="2.6" fill="#ffffff" stroke="#4285F4" strokeWidth="1.8" />
      <path d="M3.2 8.4h17.6" stroke="#4285F4" strokeWidth="1.6" />
      <path d="M7.6 2.6v3.2M16.4 2.6v3.2" stroke="#4285F4" strokeWidth="1.8" strokeLinecap="round" />
      <text
        x="12"
        y="17.4"
        textAnchor="middle"
        fontSize="7.4"
        fontWeight="700"
        fill="#4285F4"
        fontFamily="system-ui, sans-serif"
      >
        31
      </text>
    </svg>
  );
}

/** Gmail: o envelope com o M. */
export function LogoGmail(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.2" y="5.2" width="19.6" height="13.6" rx="2.4" fill="#ffffff" stroke="#DADCE0" strokeWidth="1.2" />
      <path d="M3 6.6v11.2" stroke="#4285F4" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M21 6.6v11.2" stroke="#34A853" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M3.2 6.6 12 13.2l8.8-6.6" stroke="#EA4335" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

/** Outlook: o quadrado azul com o anel. */
export function LogoOutlook(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="2.4" y="4.4" width="12.4" height="15.2" rx="2.4" fill="#0F6CBD" />
      <ellipse cx="8.6" cy="12" rx="3" ry="3.9" fill="#ffffff" />
      <ellipse cx="8.6" cy="12" rx="1.3" ry="2" fill="#0F6CBD" />
      <path d="M15.6 7.4h5.2a1 1 0 0 1 1 1v7.2a1 1 0 0 1-1 1h-5.2z" fill="#28A8EA" />
      <path d="M15.6 8.2 21.8 12" stroke="#ffffff" strokeWidth="1.3" fill="none" />
    </svg>
  );
}

/** Google Sheets: a folha verde com a tabela. */
export function LogoGoogleSheets(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.4 2h7l5 5v13a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="#0F9D58" />
      <path d="M13.4 2l5 5h-5z" fill="#0B8043" />
      <rect x="7.6" y="11" width="8.8" height="7.4" rx="0.6" fill="#ffffff" />
      <path d="M7.6 13.6h8.8M7.6 16h8.8M12 11v7.4" stroke="#0F9D58" strokeWidth="1" />
    </svg>
  );
}
