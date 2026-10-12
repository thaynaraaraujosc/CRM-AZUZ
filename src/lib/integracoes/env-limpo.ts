/**
 * Lê uma variável de ambiente SEM o espaço invisível que vem colado no copiar e colar.
 *
 * POR QUE ISTO EXISTE, com data e custo: em 12/10/2026 a conexão com a API oficial do WhatsApp
 * passou horas sendo investigada — versão do diálogo, modo do app, domínios autorizados,
 * configuração de login, permissões, cookies de terceiros. Tudo verificado, tudo correto. A causa
 * era uma TABULAÇÃO no começo de `NEXT_PUBLIC_META_CONFIG_ID`:
 *
 *     config_id: "\t1615645803299788"
 *
 * A Meta procurava uma configuração com esse identificador, não achava, e devolvia "Falha ao
 * iniciar sessão" — a mesma mensagem genérica que daria para um app inexistente. E a tela de
 * diagnóstico do CRM mostrava `1615645803299788`, certinho, porque tabulação em HTML é só um
 * espaço em branco. O caractere era invisível nos dois lados.
 *
 * Esse tipo de defeito já tinha mordido este projeto antes, nas credenciais do R2 (ver
 * `api/armazenamento/route.ts`), e lá virou um diagnóstico que conta os caracteres. Aqui vira
 * prevenção: nenhuma variável de ambiente é usada crua.
 *
 * `trim()` tira espaço, tabulação, quebra de linha e retorno de carro das duas pontas. Valor vazio
 * depois de limpar vira `undefined`, porque string vazia e variável ausente são a mesma coisa para
 * quem consome — e `""` passaria num `if (!valor)` de um jeito e num `??` de outro.
 */
export function envLimpo(valor: string | undefined): string | undefined {
  const limpo = valor?.trim();
  return limpo ? limpo : undefined;
}
