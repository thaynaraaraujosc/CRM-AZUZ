/**
 * Como reconhecer, num eco do Direct, a mensagem que o PRÓPRIO CRM acabou de mandar.
 *
 * Tudo que a conta conectada envia volta pelo webhook como eco, inclusive o que saiu daqui. O eco
 * traz o `mid` da Meta; a linha gravada no envio pode ter id próprio (é o caso do envio feito pela
 * tela de Conversas, que grava antes de a Meta responder). Ids diferentes, a conferência por id não
 * casa, e a mesma frase entra duas vezes.
 *
 * Ignorar o eco resolveria a duplicata e criaria um buraco maior: é por ele que chega o que foi
 * respondido pelo APLICATIVO do Instagram, fora do CRM. Esse histórico não existe de outra forma.
 *
 * Daí os critérios serem estreitos, e cada um deles importa:
 *   - só eco (`is_echo`), porque mensagem recebida nunca é nossa;
 *   - só com texto, porque é o que dá pra comparar com segurança (anexo não);
 *   - mesma conversa e mesmo texto;
 *   - `wamid: null`, ou seja, ainda não reconhecida por nenhum eco: é isto que faz dois envios
 *     iguais seguidos consumirem um eco cada, em vez de os dois casarem com a mesma linha;
 *   - minutos atrás, pra nunca alcançar uma mensagem antiga de texto repetido ("ok", "obrigada").
 *
 * Função pura e separada da rota pra estes critérios poderem ser conferidos num teste: afrouxar
 * qualquer um deles reintroduz a duplicata ou engole mensagem de verdade, e nos dois casos o
 * prejuízo só aparece em produção.
 */
export const JANELA_DO_ECO_MS = 5 * 60_000;

export type CriteriosDeEco = {
  workspaceId: string;
  contato: string;
  tipo: "out";
  texto: string;
  wamid: null;
  criadoEm: { gte: Date };
};

export function criteriosDeEcoDoCrm(params: {
  ehEco: boolean;
  texto: string | undefined;
  workspaceId: string;
  contato: string;
  agora?: Date;
}): CriteriosDeEco | null {
  if (!params.ehEco) return null;
  if (!params.texto) return null;

  const agora = params.agora ?? new Date();
  return {
    workspaceId: params.workspaceId,
    contato: params.contato,
    tipo: "out",
    texto: params.texto,
    wamid: null,
    criadoEm: { gte: new Date(agora.getTime() - JANELA_DO_ECO_MS) },
  };
}
