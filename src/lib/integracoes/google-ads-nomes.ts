/**
 * O NOME DA AÇÃO DE CONVERSÃO DA VENDA, em arquivo próprio.
 *
 * Mora separado de `google-ads.ts` porque `evento-na-plataforma.ts` precisa dele e `google-ads.ts`
 * é código de servidor com `node:crypto` e chamadas de rede. Importar o arquivo inteiro só pra ler
 * uma string arrastaria tudo isso para onde não precisa.
 *
 * O VALOR NÃO MUDA. Ele é o nome que já existe na conta de anúncios dos clientes: renomear criaria
 * uma ação nova e deixaria o histórico de conversões na antiga, partindo o relatório em dois.
 */
export const NOME_DA_CONVERSAO = "Venda · CRM AZUZ";
