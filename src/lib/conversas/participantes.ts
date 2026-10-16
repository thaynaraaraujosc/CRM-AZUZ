import type { ParticipanteGrupo } from "@/lib/conversas/mencoes";
import { formatarTelefoneParaExibicao, normalizarTelefoneParaComparacao } from "@/lib/telefone";

/**
 * Quem são as pessoas de um grupo, com o melhor nome que existe pra cada uma — e dizendo quando
 * não existe nome nenhum, em vez de inventar.
 *
 * O PROBLEMA QUE ISTO RESOLVE: o WhatsApp migrou a identificação de participante de grupo pro LID
 * (`@lid`), um identificador de 14 ou 15 dígitos que NÃO é o telefone da pessoa. O painel de
 * participantes passou a listar sete linhas de dígitos, sem um nome sequer, e o botão de abrir
 * conversa individual tentaria abrir conversa com um número que não existe.
 *
 * As fontes de nome estão em ordem de confiança, e a ordem é a regra:
 *
 *   1. O nome que veio na lista do grupo (`pushName`). É o que o WhatsApp mostraria.
 *   2. O nome visto nas MENSAGENS do grupo. Toda mensagem recebida traz o `pushName` de quem
 *      escreveu; quem já falou ali está identificado, mesmo que a lista do grupo não traga nome.
 *      É a fonte que não depende de a API resolver o LID.
 *   3. O contato salvo no CRM, quando o identificador é mesmo um telefone.
 *   4. O telefone formatado.
 *   5. O identificador cru. Feio, e honesto.
 *
 * Puro de propósito: é regra de dado, e se prova sem navegador.
 */

export type ContatoParaParticipante = { nome: string; whatsapp?: string | null };

/** O que uma mensagem de grupo guarda sobre quem a escreveu. */
export type MensagemComRemetente = { remetenteId?: string; remetenteIdAlt?: string; remetenteNome?: string };

/** Nome de gente tem letra. É o teste que separa "Bianca" de "67113209352342" em qualquer formato,
 *  sem depender de o campo ter vindo preenchido com o próprio identificador. */
function pareceNome(valor: string | undefined | null): boolean {
  return typeof valor === "string" && /\p{L}/u.test(valor);
}

/**
 * O telefone do participante, formatado pra leitura — ou `null` quando o identificador não é um
 * telefone.
 *
 * É AQUI que o LID para. Enquanto o CRM não souber distinguir, ninguém pode escrever "+" na frente
 * de catorze dígitos e chamar de telefone: a tela ofereceria uma ligação pra um número que não
 * existe. `null` é a resposta certa, e quem desenha decide o que fazer com ela.
 */
export function telefoneDoParticipante(identificador: string): string | null {
  return formatarTelefoneParaExibicao(identificador);
}

/**
 * O que as mensagens do grupo já ensinaram: identificador de quem escreveu → nome que ele usa.
 *
 * Varre da mais antiga pra mais nova de propósito: quando a pessoa troca o nome do perfil, o mais
 * recente é o que vale, e sobrescrever conforme avança deixa o último por cima.
 */
export function nomesVistosNasMensagens(mensagens: readonly MensagemComRemetente[]): Map<string, string> {
  const nomes = new Map<string, string>();
  for (const m of mensagens) {
    if (!pareceNome(m.remetenteNome)) continue;
    // Os DOIS identificadores apontam pro mesmo nome. A lista do grupo pode ter guardado o LID
    // enquanto a mensagem guardou o telefone, ou o contrário: indexando pelos dois, o painel acha
    // o nome de qualquer lado que tenha sobrado.
    for (const id of [m.remetenteId, m.remetenteIdAlt]) {
      if (id) nomes.set(id, m.remetenteNome!);
    }
  }
  return nomes;
}

/** Um participante pronto pra desenhar. `telefone` é `null` quando não há telefone de verdade. */
export type ParticipanteIdentificado = {
  identificador: string;
  nome: string;
  telefone: string | null;
  /** O nome é de gente, ou é o identificador fazendo as vezes de nome? Decide se a tela mostra o
   *  que dá pra fazer com essa pessoa ou avisa que ela ainda não foi identificada. */
  temNomeReal: boolean;
};

export function identificarParticipante(
  participante: ParticipanteGrupo,
  fontes: {
    nomesVistos?: Map<string, string> | null;
    contatos?: readonly ContatoParaParticipante[] | null;
  },
): ParticipanteIdentificado {
  const identificador = participante.telefone;
  const telefone = telefoneDoParticipante(identificador);

  if (pareceNome(participante.nome)) {
    return { identificador, nome: participante.nome, telefone, temNomeReal: true };
  }

  const visto = fontes.nomesVistos?.get(identificador);
  if (pareceNome(visto)) return { identificador, nome: visto!, telefone, temNomeReal: true };

  if (telefone) {
    const chave = normalizarTelefoneParaComparacao(identificador);
    const salvo = fontes.contatos?.find(
      (c) => c.whatsapp && normalizarTelefoneParaComparacao(c.whatsapp) === chave,
    );
    if (salvo && pareceNome(salvo.nome)) {
      return { identificador, nome: salvo.nome, telefone, temNomeReal: true };
    }
  }

  return { identificador, nome: telefone ?? identificador, telefone, temNomeReal: false };
}
