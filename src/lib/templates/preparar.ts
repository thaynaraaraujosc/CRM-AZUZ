import { mapearVariaveis, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { LIMITES, validarTemplate, type BotaoTemplate, type CanalTemplate } from "./regras";

export type CorpoTemplate = {
  nome?: string;
  canal?: CanalTemplate;
  categoria?: string | null;
  idioma?: string | null;
  assunto?: string | null;
  corpo?: string;
  variaveis?: MapeamentoVariavel[];
  botoes?: BotaoTemplate[];
};

/** Normaliza o que veio da tela e valida com as MESMAS regras que a tela usou. */
export function prepararTemplate(corpo: CorpoTemplate) {
  const canal = corpo.canal ?? "whatsapp_oficial";
  const limites = LIMITES[canal];
  const texto = (corpo.corpo ?? "").trim();
  // O mapeamento vem da tela, mas é remontado a partir do texto: variável que a tela esqueceu
  // ganha índice e origem; variável que sobrou no mapeamento e sumiu do texto é descartada.
  const variaveis = mapearVariaveis(texto, corpo.variaveis ?? []);
  const botoes = (corpo.botoes ?? []).map((b) => ({ texto: (b.texto ?? "").trim() })).filter((b) => b.texto);
  const editavel = {
    nome: (corpo.nome ?? "").trim(),
    canal,
    categoria: limites?.exigeCategoria ? (corpo.categoria ?? null) : null,
    idioma: limites?.exigeIdioma ? (corpo.idioma ?? "pt_BR") : "pt_BR",
    assunto: limites?.exigeAssunto ? (corpo.assunto ?? "").trim() : null,
    corpo: texto,
    variaveis,
    botoes,
  };
  return { editavel, problemas: validarTemplate(editavel) };
}

