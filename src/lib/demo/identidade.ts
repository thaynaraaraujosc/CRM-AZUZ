/**
 * Quem é a conta de demonstração. Separado de `dados-demo.ts` porque a TELA precisa saber se está
 * dentro dela (pra mostrar o botão de limpar o cenário), e importar `dados-demo` no navegador
 * levaria junto os 18 contatos, as conversas e as tarefas inteiras pro pacote do cliente — dado
 * que só o servidor usa.
 */
export const WORKSPACE_DEMO = "demonstracao";
export const EMAIL_DEMO = "demo@azuzcrm.com.br";
export const EMPRESA_DEMO = "Clínica Aurora";
