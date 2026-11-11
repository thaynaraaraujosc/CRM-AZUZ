import type { FlowNode } from "@/lib/automation-flow/types";

/**
 * VÁRIOS GATILHOS NUM FLUXO SÓ.
 *
 * O CRM guardava um bloco de gatilho por fluxo, e sete lugares diferentes do motor liam esse bloco
 * com `nodes.find(n => n.category === "gatilho")` — o PRIMEIRO que aparecesse. Uma automação que
 * respondesse tanto a comentário quanto a resposta de story precisava ser montada duas vezes, com
 * os mesmos passos copiados.
 *
 * Agora o fluxo pode ter quantos blocos de gatilho quiser, todos ligados ao mesmo primeiro passo.
 * O que muda no motor é só a pergunta: não é mais "qual é o gatilho deste fluxo", é "QUAL DESTES
 * gatilhos casa com o evento que chegou". Este arquivo é essa pergunta, escrita uma vez.
 *
 * Por que blocos separados e não um bloco com uma lista de tipos: cada gatilho tem configuração
 * PRÓPRIA — o de comentário escolhe a publicação, o de story escolhe o story, os dois escolhem
 * palavras. Numa lista dentro de um bloco só, essas configurações ou virariam um emaranhado de
 * campos condicionais ou seriam perdidas. Em blocos separados, cada um guarda o seu, e o painel
 * de configuração que já existe continua valendo sem mudança nenhuma.
 */

/** Os blocos de gatilho do fluxo, na ordem em que estão nos `nodes`. */
export function nosDeGatilho(nodes: readonly FlowNode[]): FlowNode[] {
  return nodes.filter((n) => n.category === "gatilho");
}

/**
 * Que tipo de gatilho este evento consegue acionar neste bloco.
 *
 * Devolve o tipo a usar na avaliação, ou `null` quando o bloco não tem nada a ver com o evento.
 * Existe porque "chegou uma mensagem" é o mesmo acontecimento para três blocos diferentes, e
 * antes só um deles era considerado.
 */
export function tipoDoGatilhoQueCasa(tipoDoEvento: string, tipoDoBloco: string | undefined): string | null {
  if (!tipoDoBloco) return null;
  if (tipoDoBloco === tipoDoEvento) return tipoDoEvento;

  const equivalentes: Record<string, string[]> = {
    // "Lead respondeu" só vale quando a conversa já existia, mas o CRM não distingue isso hoje.
    // E deixar de fora seria pior: o bloco existe na biblioteca e nunca dispararia.
    //
    // `instagram_direct_recebido` é o mesmo acontecimento visto pela área social: chegou mensagem.
    // Ele existe como bloco separado porque na biblioteca do Instagram os gatilhos genéricos do
    // funil não aparecem, e sem ele não haveria como montar um robô que responde um Direct comum.
    // A filtragem por palavra é do próprio bloco, igual à de "Palavra-chave recebida".
    mensagem_recebida: ["palavra_chave", "lead_respondeu", "instagram_direct_recebido"],
  };
  return equivalentes[tipoDoEvento]?.includes(tipoDoBloco) ? tipoDoBloco : null;
}

/**
 * Os blocos de gatilho deste fluxo que este evento consegue acionar, com o tipo a usar na
 * avaliação de cada um.
 *
 * Devolve TODOS os candidatos, e não o primeiro: quem chama ainda precisa checar as condições de
 * cada bloco (a publicação escolhida, o story escolhido, as palavras) antes de decidir. Um fluxo
 * com dois blocos de comentário, um filtrando "GUIA" e outro filtrando "PREÇO", tem dois
 * candidatos para o mesmo evento e só um deles passa.
 */
export function gatilhosQueCasam(
  nodes: readonly FlowNode[],
  tipoDoEvento: string,
): { no: FlowNode; tipoAceito: string }[] {
  const saida: { no: FlowNode; tipoAceito: string }[] = [];
  for (const no of nosDeGatilho(nodes)) {
    const tipoAceito = tipoDoGatilhoQueCasa(tipoDoEvento, no.type);
    if (tipoAceito) saida.push({ no, tipoAceito });
  }
  return saida;
}

/**
 * O bloco de gatilho por onde uma execução entrou, dado o tipo gravado nela.
 *
 * A execução guarda o TIPO do gatilho, não o id do bloco — é assim desde antes de existirem
 * vários, e mudar isso obrigaria a migrar as execuções em andamento. Quando dois blocos do mesmo
 * tipo existem (dois comentários com palavras diferentes), qualquer um serve: o que a execução
 * precisa dali é a aresta de saída, e as duas levam ao mesmo primeiro passo.
 */
export function gatilhoDaExecucao(nodes: readonly FlowNode[], tipoGravado: string | undefined): FlowNode | null {
  const gatilhos = nosDeGatilho(nodes);
  if (!gatilhos.length) return null;
  if (!tipoGravado) return gatilhos[0];
  const casando = gatilhos.find((n) => tipoDoGatilhoQueCasa(tipoGravado, n.type));
  return casando ?? gatilhos[0];
}

/**
 * GATILHOS QUE NÃO CARREGAM TEXTO NENHUM.
 *
 * "Se começou a seguir, não precisa ter palavra-chave, certo? Porque a única coisa que a pessoa fez
 * foi me seguir. Ela não comentou nada."
 *
 * Exato — e sem esta lista o defeito seria pior que um campo sobrando na tela: a filtragem por
 * palavra roda sobre o texto do evento, e um evento SEM texto não casa com palavra nenhuma. Numa
 * automação que tivesse palavras-chave configuradas (pro comentário, digamos) e também o gatilho de
 * novo seguidor, o de seguidor simplesmente nunca dispararia — sem erro, sem aviso, sem nada que
 * explicasse.
 *
 * Então a regra mora aqui, perto de quem pergunta "este gatilho casa com este evento", e é
 * consultada nos dois lugares: na avaliação, pra não filtrar o que não tem o que filtrar, e na
 * gaveta, pra não perguntar palavra-chave a quem não tem texto.
 */
export const GATILHOS_SEM_TEXTO: readonly string[] = ["instagram_novo_seguidor"];

/** Este gatilho traz texto que dê pra casar com palavra-chave? */
export function gatilhoTemTexto(tipo: string | undefined): boolean {
  return !!tipo && !GATILHOS_SEM_TEXTO.includes(tipo);
}
