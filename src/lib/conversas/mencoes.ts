import { formatarTelefoneParaExibicao, normalizarTelefoneParaComparacao } from "@/lib/telefone";

export type ParticipanteGrupo = { nome: string; telefone: string };

/** Um contato do CRM, pro índice de nomes. Só o que a menção precisa. */
export type ContatoParaMencao = { nome: string; whatsapp?: string | null };

/**
 * De quem é esta menção, escrito do jeito que quem lê reconhece.
 *
 * No WhatsApp, mencionar alguém num grupo grava no texto o telefone cru: `@5587600555651`. Quem lê
 * pelo aplicativo vê um nome, porque o WhatsApp troca na hora de exibir. O CRM mostrava o número
 * como veio — e o detector de telefone ainda pendurava "WhatsApp" e "Ligar" ao lado, de modo que
 * citar alguém da conversa virava um convite a ligar pra essa pessoa.
 *
 * A ORDEM DAS TRÊS FONTES É A REGRA, e ela é esta:
 *
 *   1. O nome que ESTA empresa salvou no contato. É o nome pelo qual quem atende conhece a pessoa,
 *      e ganha de todos os outros — do mesmo jeito que o celular mostra o nome da sua agenda em vez
 *      do nome que a pessoa escolheu pra si.
 *   2. O nome que a PRÓPRIA pessoa pôs no perfil (o `pushName` que vem na lista do grupo). Serve
 *      pra quem ainda não está cadastrado: é melhor que um número, e é o que o WhatsApp mostraria.
 *   3. O telefone formatado, `+55 (62) 99999-9999`. Último recurso, e honesto: dígito colado não se
 *      lê como telefone, e inventar nome seria pior que mostrar número.
 *
 * A troca acontece na EXIBIÇÃO, nunca na gravação: o nome de perfil muda quando a pessoa quiser, e
 * reescrever a mensagem guardada congelaria o nome de hoje no histórico de ontem.
 *
 * Devolve uma função, e não um texto, porque quem chama precisa resolver uma menção por vez,
 * enquanto varre o texto — e montar os dois índices a cada menção de cada mensagem de uma conversa
 * longa seria refazer o mesmo trabalho centenas de vezes.
 */
export function criarResolvedorDeMencao(
  contatos: readonly ContatoParaMencao[] | null | undefined,
  participantes: readonly ParticipanteGrupo[] | null | undefined,
): (digitos: string) => string {
  // Chave: telefone na forma canônica. A menção traz o número com DDI e sem máscara, o contato
  // pode ter sido salvo como "(62) 99999-9999". É a mesma comparação que decide, em todo o resto
  // do CRM, se dois números são a mesma pessoa.
  const porTelefone = new Map<string, string>();

  // Participantes primeiro, contatos depois: quem vem depois sobrescreve, e é assim que o nome
  // salvo pela empresa ganha do nome que o dono do número escolheu pra si.
  for (const p of participantes ?? []) {
    const chave = normalizarTelefoneParaComparacao(p.telefone);
    // Participante sem nome entra na lista com o próprio telefone no lugar do nome. Trocar número
    // por número não ajuda ninguém — e deixaria passar como "nome" algo que o passo 3 formataria
    // bem melhor. Exigir uma letra é o teste que separa nome de número em qualquer formato.
    if (chave && /\p{L}/u.test(p.nome)) porTelefone.set(chave, p.nome);
  }
  for (const c of contatos ?? []) {
    const chave = c.whatsapp ? normalizarTelefoneParaComparacao(c.whatsapp) : "";
    if (chave && c.nome.trim()) porTelefone.set(chave, c.nome.trim());
  }

  /*
   * Sem nome e sem forma de telefone, o identificador sai como veio.
   *
   * É o caso do LID: o WhatsApp passou a identificar participante de grupo por um número de 14 ou
   * 15 dígitos que NÃO é o telefone da pessoa. Formatá-lo com `+` na frente escreveria um telefone
   * que não existe — e quem lesse poderia tentar ligar. Mostrar o identificador cru é feio e é
   * honesto; a frase que vale aqui é a mesma de sempre: melhor um número honesto que um nome
   * inventado.
   */
  return (digitos) =>
    porTelefone.get(normalizarTelefoneParaComparacao(digitos)) ??
    formatarTelefoneParaExibicao(digitos) ??
    digitos;
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
