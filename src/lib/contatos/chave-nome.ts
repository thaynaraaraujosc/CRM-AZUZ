/**
 * A chave usada pra dizer que dois registros falam da MESMA pessoa.
 *
 * O CRM liga o negócio do funil à conversa pelo nome, comparando texto com texto. E o mesmo
 * contato chega com o nome escrito de jeitos diferentes conforme o caminho: a Cloud API manda o
 * nome do perfil, o QR Code manda outro, alguém cadastra à mão com um espaço sobrando no fim. No
 * diagnóstico da conta real apareceram os dois casos no mesmo dia: um card chamado "Thais " com
 * espaço no fim, e um card "Lucas Arantes" cuja conversa está gravada como "LUCAS ARANTES".
 *
 * O efeito é o que se viu na tela: o negócio no funil sem telefone, sem data e sem conversa, e a
 * pessoa concluindo que a mensagem não chegou. Ela chegou; o CRM é que não reconheceu que os dois
 * registros são a mesma pessoa.
 *
 * Serve só pra COMPARAR. O nome que aparece na tela continua sendo o original, com a acentuação e
 * as maiúsculas que a pessoa escreveu.
 */
export function chaveDeContato(nome: string | null | undefined): string {
  return (nome ?? "")
    .normalize("NFKC")
    .trim()
    // Espaço duplo no meio vira um só: "Ana  Maria" e "Ana Maria" são a mesma pessoa.
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

/** Os dois nomes são da mesma pessoa? */
export function mesmoContato(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = chaveDeContato(a);
  return x.length > 0 && x === chaveDeContato(b);
}
