/**
 * Lista central de todas as chaves de localStorage usadas pelo CRM mockado — cada contexto grava a
 * própria (ver os arquivos `src/lib/*-context.tsx`), não existe um único "banco" local. Mantida aqui
 * só pra dar suporte a `resetarDadosMockados`, que precisa saber tudo que existe pra limpar de vez.
 * Se um novo contexto persistido for criado, adicione a chave dele aqui.
 */
export const CHAVES_LOCALSTORAGE_CRM: string[] = [
  "azuz-crm-documentos",
  "azuz-crm-documentos-modelos-usuario",
  "azuz-crm-documentos-modelos-favoritos",
  "azuz-crm-documentos-modelos-recentes",
  "azuz-crm-documentos-prefs-ver",
  "azuz-crm-formularios",
  "azuz-crm-formularios-respostas",
  "azuz-crm-funis",
  "azuz-crm-automacoes-fluxos",
  "azuz-crm-notificacoes-ativas",
  "azuz-crm-notificacoes-nova-tarefa",
  "azuz-crm-notificacoes-comentario",
  "azuz-crm-central-dia",
  "azuz-crm-configuracoes",
  "azuz-crm-conversas-config",
  "azuz-crm-conversas-mensagens",
  "azuz-jornada-contatos-recentes-v1",
  "azuz-jornada-historicos-recentes-v1",
  "azuz-relatorios-historico-v1",
  "automacoes:filtros-abertos",
];

/**
 * Limpa todos os dados mockados persistidos localmente e recarrega a página — cada contexto volta a
 * inicializar a partir dos mocks originais de `@/lib/data`. Não afeta preferências de tema (mantidas
 * de propósito: resetar dados não deveria mudar a aparência do app). Front-end apenas: não existe
 * backend pra limpar junto.
 */
export function resetarDadosMockados() {
  for (const chave of CHAVES_LOCALSTORAGE_CRM) {
    try {
      window.localStorage.removeItem(chave);
    } catch {
      // localStorage indisponível — nada a limpar.
    }
  }
  window.location.reload();
}
