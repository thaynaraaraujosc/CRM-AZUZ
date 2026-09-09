/**
 * Tipos e rótulos do público de um disparo. SEM banco, porque a tela importa daqui. A resolução
 * de verdade (quem recebe) mora em `audiencia.ts`, que puxa o Prisma e só roda no servidor.
 */
export type ModoAudiencia =
  | "todos"
  | "selecionados"
  | "etiqueta"
  | "origem"
  | "funil"
  | "etapa"
  | "periodo"
  /** Só do Instagram: quem escreveu no Direct nas últimas 24 horas. Ver `janela-direct.ts`. */
  | "janela_instagram";

export type Audiencia = {
  modo: ModoAudiencia;
  /** Etiqueta, origem, id do funil ou id da etapa, conforme o modo. */
  valor?: string;
  /** Nomes escolhidos à mão (`selecionados`). */
  nomes?: string[];
  /** Período de cadastro (`periodo`), em ISO. */
  de?: string;
  ate?: string;
};


/** Rótulo do público pra tela de acompanhamento ("Etiqueta: VIP"). */
export function descreverAudiencia(a: Audiencia | null | undefined, extras?: { funil?: string; etapa?: string }): string {
  if (!a) return "Contatos selecionados";
  switch (a.modo) {
    case "todos":
      return "Todos os contatos";
    case "selecionados":
      return `${a.nomes?.length ?? 0} contatos selecionados`;
    case "etiqueta":
      return `Etiqueta: ${a.valor ?? ""}`;
    case "origem":
      return `Origem: ${a.valor ?? ""}`;
    case "funil":
      return `Funil: ${extras?.funil ?? a.valor ?? ""}`;
    case "etapa":
      return `Etapa: ${extras?.etapa ?? a.valor ?? ""}`;
    case "periodo":
      return `Cadastrados de ${a.de?.slice(0, 10) ?? "…"} a ${a.ate?.slice(0, 10) ?? "…"}`;
    case "janela_instagram":
      return "Quem escreveu no Direct nas últimas 24 horas";
  }
}

