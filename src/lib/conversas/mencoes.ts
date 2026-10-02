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
