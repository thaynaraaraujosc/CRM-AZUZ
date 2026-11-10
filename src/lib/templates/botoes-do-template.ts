/**
 * OS BOTÕES DE UM MODELO APROVADO, lidos dos dois lugares onde eles moram.
 *
 * "Quando eu recebo uma mensagem de um perfil da Meta oficial, eu recebo bonitinho, quadradinho,
 * com botão. Quando eu mando para o cliente, não aparece pra mim o quadradinho com o botão. Eu
 * preciso que apareça pra eu identificar se foi com botão ou não."
 *
 * A bolha já sabia desenhar botão enviado (`msg.botoes`, ver `BolhaMensagem`), e quem manda MODELO
 * simplesmente não preenchia esse campo: o modelo saía com o botão, o cliente via o botão, e o
 * registro no CRM guardava só o texto. Quem abria a conversa depois não tinha como saber se aquela
 * mensagem tinha levado um "CONFIRMAR" ou não — e é justamente por isso que a resposta "CONFIRMAR"
 * aparecia do nada, logo abaixo.
 *
 * SÃO DOIS FORMATOS, e por isso duas funções. O modelo tem duas vidas no CRM:
 *
 * - `Template.botoes` é o nosso: `[{ texto: "CONFIRMAR" }]`, escrito por quem montou o modelo.
 * - `WhatsappTemplate.componentes` é o espelho da Meta, no formato dela: um componente
 *   `{ type: "BUTTONS", buttons: [...] }` em que cada botão é QUICK_REPLY, URL ou PHONE_NUMBER.
 *
 * Os dois chegam aqui e saem como a mesma lista de rótulos, que é o que a bolha desenha. O destino
 * do botão (link, telefone) não entra no rótulo: na bolha de SAÍDA ele é registro do que o cliente
 * viu, não um botão pra clicar — clicar não faria nada e só criaria a expectativa de que faria.
 */

export type BotaoDeTemplate = {
  rotulo: string;
  /** Botão de link: leva a algum lugar em vez de responder. */
  url?: string;
  /** Botão de ligar. */
  telefone?: string;
};

type ComponenteMeta = {
  type?: string;
  buttons?: { type?: string; text?: string; url?: string; phone_number?: string }[];
};

/** Os botões do espelho da Meta (`WhatsappTemplate.componentes`). */
export function botoesDoTemplateMeta(componentes: unknown): BotaoDeTemplate[] {
  if (!Array.isArray(componentes)) return [];
  const bloco = (componentes as ComponenteMeta[]).find((c) => c?.type?.toUpperCase() === "BUTTONS");
  if (!Array.isArray(bloco?.buttons)) return [];
  return bloco.buttons
    .map((b): BotaoDeTemplate | null => {
      const rotulo = typeof b?.text === "string" ? b.text.trim() : "";
      if (!rotulo) return null;
      const tipo = b?.type?.toUpperCase();
      if (tipo === "URL" && typeof b.url === "string") return { rotulo, url: b.url };
      if (tipo === "PHONE_NUMBER" && typeof b.phone_number === "string") {
        return { rotulo, telefone: b.phone_number };
      }
      return { rotulo };
    })
    .filter((b): b is BotaoDeTemplate => b !== null);
}

/** Os botões do modelo do próprio CRM (`Template.botoes`). */
export function botoesDoTemplateLocal(botoes: unknown): BotaoDeTemplate[] {
  if (!Array.isArray(botoes)) return [];
  return botoes
    .map((b): BotaoDeTemplate | null => {
      const texto = (b as { texto?: unknown } | null)?.texto;
      const rotulo = typeof texto === "string" ? texto.trim() : "";
      return rotulo ? { rotulo } : null;
    })
    .filter((b): b is BotaoDeTemplate => b !== null);
}

/**
 * Só os rótulos, que é o que a bolha de saída guarda e desenha.
 *
 * Lista vazia vira `undefined` de propósito: é a diferença entre "este modelo não tem botão" e
 * "este modelo tem botões e eu não sei quais". Guardar `[]` faria a bolha afirmar a primeira
 * quando o caso for a segunda.
 */
export function rotulosDosBotoes(botoes: BotaoDeTemplate[]): string[] | undefined {
  const rotulos = botoes.map((b) => b.rotulo).filter(Boolean);
  return rotulos.length ? rotulos : undefined;
}
