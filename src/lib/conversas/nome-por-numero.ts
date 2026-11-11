import { formatarTelefoneParaExibicao } from "@/lib/telefone";

/**
 * CADA NÚMERO, UMA JANELA. Como se chama a conversa quando o nome já é de outro número.
 *
 * "Eu peguei esse número no contato, selecionei pra mandar pelo número da API oficial, e na hora
 * que enviou mandou pra um número antigo. (…) Cada WhatsApp é independente. Independente. Se eu
 * quiser mandar para o número novo, ele tem que abrir uma janela nova."
 *
 * A conversa é identificada pelo NOME (`Conversa` tem chave única `[workspaceId, nome]`, e
 * `MensagemExtra.contato` guarda o nome), então duas pessoas — ou dois números da mesma pessoa —
 * com o mesmo nome não ficam "parecidas" na tela: elas viram LITERALMENTE a mesma thread. Quando
 * alguém troca de telefone, ou tem dois, abrir "a conversa da Cássia" abria a do número velho, e a
 * mensagem saía pra ele. Quando o número velho ainda existe, ela CHEGA — na pessoa errada.
 *
 * A saída é dar à janela nova um nome que não colide e que diz do que ela é: o nome da pessoa com o
 * telefone entre parênteses. Não é enfeite — é a linha que quem atende lê pra saber por qual dos
 * dois números está falando, no mesmo lugar onde antes havia uma thread só com as duas misturadas.
 *
 * NÃO RENOMEIA A THREAD QUE JÁ EXISTE. A antiga continua com o nome limpo, com o histórico dela e
 * com o telefone dela. Renomear mexeria em mensagens, card do funil e contato (tudo casado por
 * nome) pra resolver um problema que é só da janela nova.
 */

/** O rótulo do número, como uma pessoa lê. Dígitos crus quando não tem forma de telefone (um LID). */
function rotuloDoNumero(telefone: string): string {
  // `?? (… || …)` com parênteses: sem eles o parser recusa misturar `??` com `||`. A ordem é
  // máscara honesta → dígitos → o que chegou, pra nunca devolver string vazia.
  return formatarTelefoneParaExibicao(telefone) ?? (telefone.replace(/\D/g, "") || telefone);
}

/**
 * O nome livre pra uma conversa com `telefone`, dado o que já está em uso.
 *
 * A ordem é a do menor estranhamento:
 *
 * 1. O nome limpo, quando ninguém o ocupa. É o caso comum, e nada muda pra ele.
 * 2. `Nome (+55 (62) 99999-9999)`, quando o nome limpo é de outro número.
 * 3. O mesmo com um contador, pro caso extremo de o nome com telefone também estar ocupado — o
 *    mesmo número salvo com duas grafias, por exemplo. Nunca devolve nome ocupado, porque devolver
 *    um faria a gravação estourar na chave única e a conversa não nascer.
 *
 * `jaUsados` é comparado em minúsculas: o banco guarda o nome como foi escrito, e "Cássia" e
 * "cássia" ocupariam a mesma chave única em MySQL (collation sem distinção de caixa).
 */
export function nomeLivreParaConversa(
  nomeBase: string,
  telefone: string,
  jaUsados: Iterable<string>,
): string {
  const usados = new Set(Array.from(jaUsados, (n) => n.trim().toLocaleLowerCase("pt-BR")));
  const livre = (candidato: string) => !usados.has(candidato.trim().toLocaleLowerCase("pt-BR"));

  const base = nomeBase.trim() || rotuloDoNumero(telefone);
  if (livre(base)) return base;

  const comNumero = `${base} (${rotuloDoNumero(telefone)})`;
  if (livre(comNumero)) return comNumero;

  for (let n = 2; n <= 50; n += 1) {
    const candidato = `${comNumero} ${n}`;
    if (livre(candidato)) return candidato;
  }

  // Cinquenta homônimos no mesmo número é cenário que não existe; mesmo assim não devolve nome
  // ocupado: o sufixo de tempo garante uma chave livre em vez de uma gravação que falha.
  return `${comNumero} ${Date.now()}`;
}
