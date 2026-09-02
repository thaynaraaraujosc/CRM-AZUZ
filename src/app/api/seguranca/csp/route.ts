import { NextResponse } from "next/server";

/**
 * Recebe os relatos da Content-Security-Policy.
 *
 * Sem isto, o modo "Report-Only" só escreve no console do navegador de quem estiver com o DevTools
 * aberto na hora — ou seja, ninguém vê. E é justamente esse relato que decide se a política pode
 * ser ligada de verdade: um recurso bloqueado por CSP **não gera erro visível**, ele simplesmente
 * some. Ligar sem esses dados é apostar que nenhuma integração vai parar.
 *
 * Pública por necessidade: quem envia é o navegador do visitante, sem sessão. O risco é alguém
 * despejar relatos falsos no log — por isso não gravamos nada em banco, só registramos, e o corpo
 * é truncado. Nenhum dado do relato influencia decisão nenhuma do sistema.
 */
export const dynamic = "force-dynamic";

/** Só o essencial pra decidir: qual regra barrou o quê. O resto do relatório é ruído. */
type RelatoCSP = {
  "csp-report"?: {
    "violated-directive"?: string;
    "blocked-uri"?: string;
    "document-uri"?: string;
  };
};

export async function POST(request: Request) {
  try {
    const corpo = (await request.json()) as RelatoCSP;
    const relato = corpo["csp-report"];
    console.warn("[csp] recurso bloqueado (modo relato):", {
      regra: relato?.["violated-directive"]?.slice(0, 100) ?? "?",
      recurso: relato?.["blocked-uri"]?.slice(0, 200) ?? "?",
      pagina: relato?.["document-uri"]?.slice(0, 200) ?? "?",
    });
  } catch {
    // Relato malformado não é problema nosso — descarta em silêncio.
  }
  // 204: o navegador não espera conteúdo e não deve tentar de novo.
  return new NextResponse(null, { status: 204 });
}
