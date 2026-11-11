/**
 * O NOME DE PERFIL ESCONDIDO NO HISTÓRICO.
 *
 * O batismo pelo nome de perfil (ver `resolverPessoaDoTelefone`) acontece quando a mensagem chega —
 * então ele conserta o futuro e não o passado. "Eu queria entender se só vai aparecer agora o nome
 * em números que chegar na mensagem nova, porque os que estão lá não mudou." Não mudou mesmo: a
 * conversa que já existe só é batizada quando aquela pessoa escrever de novo.
 *
 * Pra conta por QR Code existe um jeito de resolver o passado: as mensagens antigas continuam no
 * aparelho, e cada mensagem RECEBIDA carrega o `pushName` de quem escreveu. Então dá pra perguntar
 * o histórico de uma conversa e ler ali o nome que ela nunca chegou a gravar.
 *
 * NÃO VALE PRA API OFICIAL. Lá o nome de perfil só existe dentro do webhook da mensagem; a Meta não
 * tem endereço que devolva "qual é o nome de exibição deste telefone". Nessas, só a próxima
 * mensagem batiza — ou alguém renomeia à mão.
 *
 * Este arquivo é só a LEITURA, e é pura: recebe o histórico cru do Baileys e devolve o nome. Quem
 * busca e quem grava ficam de fora, pra isto ter teste sem Evolution nem banco.
 */

/**
 * O nome de perfil mais recente dentro de um histórico cru do Baileys.
 *
 * SÓ DE MENSAGEM RECEBIDA. No evento `fromMe` o `pushName` é o nome do DONO da conta — batizar a
 * conversa com ele daria o nome da própria empresa a todos os leads de uma vez.
 *
 * O MAIS RECENTE, e não o primeiro: quem trocou o nome do perfil no meio do caminho deve aparecer
 * como se chama hoje. As listas da Evolution vêm da mais nova pra mais velha, mas nem sempre — por
 * isso a escolha é pelo carimbo de tempo, e não pela posição.
 */
export function nomeDePerfilNoHistorico(mensagens: unknown[]): string | null {
  let melhor: { nome: string; quando: number } | null = null;

  for (const bruta of mensagens) {
    if (typeof bruta !== "object" || bruta === null) continue;
    const m = bruta as {
      key?: { fromMe?: boolean };
      pushName?: unknown;
      messageTimestamp?: unknown;
    };
    if (m.key?.fromMe) continue;

    const nome = typeof m.pushName === "string" ? m.pushName.trim().replace(/\s+/g, " ") : "";
    if (!nome || nome.length < 2 || nome.length > 80) continue;
    // Nome que é só dígitos não batiza nada: trocaria um número por outro.
    if (/^\d+$/.test(nome)) continue;

    const bruto = m.messageTimestamp;
    const quando = typeof bruto === "number" ? bruto : typeof bruto === "string" ? Number(bruto) : 0;
    const carimbo = Number.isFinite(quando) ? quando : 0;
    if (!melhor || carimbo > melhor.quando) melhor = { nome, quando: carimbo };
  }

  return melhor?.nome ?? null;
}
