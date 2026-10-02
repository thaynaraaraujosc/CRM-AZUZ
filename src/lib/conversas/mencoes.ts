import { normalizarTelefoneParaComparacao } from "@/lib/telefone";

export type ParticipanteGrupo = { nome: string; telefone: string };

/**
 * Troca a menção pelo NOME de quem foi mencionado.
 *
 * No WhatsApp, mencionar alguém num grupo grava no texto o telefone cru: `@87600555651`. Quem lê
 * pelo WhatsApp vê o nome, porque o aplicativo troca na hora de exibir usando a lista do grupo. O
 * CRM mostrava o texto como veio — e, pior, o detector de telefone reconhecia aquilo como um número
 * compartilhado e pendurava os atalhos "WhatsApp" e "Ligar" ao lado. Uma menção a uma pessoa da
 * conversa virava um convite a ligar pra ela.
 *
 * A troca acontece na EXIBIÇÃO, não na gravação: o nome de perfil muda quando a pessoa quiser, e
 * reescrever a mensagem guardada congelaria o nome de hoje no histórico de ontem.
 *
 * Quem não está na lista continua como veio. Melhor um número honesto do que um nome inventado —
 * e, como o nome substituto não parece telefone, só a menção reconhecida deixa de virar atalho.
 *
 * Pura de propósito: é regra de texto, e regra de texto se testa sem navegador.
 */
export function aplicarMencoes(texto: string, participantes: ParticipanteGrupo[] | null | undefined): string {
  if (!texto.includes("@") || !participantes?.length) return texto;

  // Índice por telefone normalizado: a menção traz o número com DDI e sem máscara, a lista do grupo
  // pode ter vindo em outro formato. É a mesma comparação que decide se dois números são a mesma
  // pessoa em todo o resto do CRM.
  const porTelefone = new Map<string, string>();
  for (const p of participantes) {
    const chave = normalizarTelefoneParaComparacao(p.telefone);
    // Participante sem nome entra na lista com o próprio telefone como nome: trocar número por
    // número não ajuda ninguém, e ainda tiraria o atalho de quem talvez quisesse usá-lo.
    if (chave && p.nome && p.nome !== p.telefone) porTelefone.set(chave, p.nome);
  }
  if (!porTelefone.size) return texto;

  // 8 a 15 dígitos cobre do número sem DDI ao internacional mais longo (E.164 vai até 15).
  return texto.replace(/@(\d{8,15})\b/g, (original, digitos: string) => {
    const nome = porTelefone.get(normalizarTelefoneParaComparacao(digitos));
    return nome ? `@${nome}` : original;
  });
}

/**
 * O que o `@` que está sendo digitado procura, e quem ele acha.
 *
 * Marcar alguém num grupo é o gesto mais comum do WhatsApp e não existia aqui: só dava pra digitar
 * o número na mão, que é justamente o que faz a menção aparecer como número do outro lado.
 *
 * `null` quando não há menção em curso. Isso é o normal: o `@` só abre a lista quando está
 * começando uma palavra (depois de espaço ou no início), para que um e-mail digitado no meio da
 * frase não vire um seletor de pessoas na cara de quem escreve.
 */
export function mencaoEmDigitacao(texto: string, posicaoDoCursor: number): { busca: string; inicio: number } | null {
  const ate = texto.slice(0, posicaoDoCursor);
  // `[^\s@]*` depois do @: a busca não atravessa espaço (acabou a menção) nem outro @.
  const casou = ate.match(/(?:^|\s)@([^\s@]*)$/);
  if (!casou) return null;
  return { busca: casou[1].toLowerCase(), inicio: posicaoDoCursor - casou[1].length - 1 };
}

/** Os participantes que casam com o que está sendo digitado depois do `@`. Busca por nome E por
 *  telefone, porque quem não tem nome salvo aparece pelo número e precisa ser encontrável assim. */
export function filtrarParticipantes(
  participantes: ParticipanteGrupo[] | null | undefined,
  busca: string,
): ParticipanteGrupo[] {
  if (!participantes?.length) return [];
  if (!busca) return participantes.slice(0, 8);
  const alvo = busca.toLowerCase();
  return participantes
    .filter((p) => p.nome.toLowerCase().includes(alvo) || p.telefone.includes(alvo))
    .slice(0, 8);
}

/**
 * Troca a menção em digitação pelo TELEFONE de quem foi escolhido, que é o formato que o WhatsApp
 * entende. Quem lê vê o nome: é `aplicarMencoes` que faz essa volta na exibição.
 */
export function inserirMencao(
  texto: string,
  inicio: number,
  posicaoDoCursor: number,
  participante: ParticipanteGrupo,
): { texto: string; cursor: number } {
  // Normaliza pro formato canônico (DDI + DDD + 9). Um participante cujo telefone tenha vindo sem
  // DDI geraria uma menção que o WhatsApp não resolve pra pessoa nenhuma — e que `aplicarMencoes`
  // também não conseguiria casar de volta na exibição.
  const numero = normalizarTelefoneParaComparacao(participante.telefone) || participante.telefone.replace(/\D/g, "");
  const marca = `@${numero} `;
  return {
    texto: texto.slice(0, inicio) + marca + texto.slice(posicaoDoCursor),
    cursor: inicio + marca.length,
  };
}
