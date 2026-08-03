/** Matriz de permissões por módulo (item 21) — usada tanto ao adicionar um usuário quanto ao criar
 * uma função personalizada (item 22). Cada permissão é só um id — front-end apenas, nunca aplicado a
 * uma checagem de acesso real. */
export type PermissaoModulo = { modulo: string; permissoes: { id: string; label: string }[] };

export const PERMISSOES_POR_MODULO: PermissaoModulo[] = [
  {
    modulo: "Contatos",
    permissoes: [
      { id: "contatos_visualizar", label: "Visualizar" },
      { id: "contatos_criar", label: "Criar" },
      { id: "contatos_editar", label: "Editar" },
      { id: "contatos_excluir", label: "Excluir" },
      { id: "contatos_exportar", label: "Exportar" },
    ],
  },
  {
    modulo: "WhatsApp",
    permissoes: [
      { id: "wa_visualizar", label: "Visualizar conversas" },
      { id: "wa_responder", label: "Responder" },
      { id: "wa_transferir", label: "Transferir atendimento" },
      { id: "wa_excluir_mensagens", label: "Excluir mensagens" },
      { id: "wa_todas_conversas", label: "Acessar todas as conversas" },
      { id: "wa_so_proprias", label: "Acessar somente conversas próprias" },
    ],
  },
  {
    modulo: "Funil",
    permissoes: [
      { id: "funil_visualizar", label: "Visualizar" },
      { id: "funil_criar_negocios", label: "Criar negócios" },
      { id: "funil_mover_negocios", label: "Mover negócios" },
      { id: "funil_excluir_negocios", label: "Excluir negócios" },
      { id: "funil_alterar_responsavel", label: "Alterar responsável" },
      { id: "funil_ver_valores", label: "Visualizar valores" },
    ],
  },
  {
    modulo: "Automações",
    permissoes: [
      { id: "auto_visualizar", label: "Visualizar" },
      { id: "auto_criar", label: "Criar" },
      { id: "auto_editar", label: "Editar" },
      { id: "auto_ativar", label: "Ativar" },
      { id: "auto_desativar", label: "Desativar" },
      { id: "auto_excluir", label: "Excluir" },
    ],
  },
  {
    modulo: "Relatórios",
    permissoes: [
      { id: "rel_visualizar", label: "Visualizar" },
      { id: "rel_exportar", label: "Exportar" },
      { id: "rel_valores_financeiros", label: "Visualizar valores financeiros" },
      { id: "rel_desempenho_equipe", label: "Visualizar desempenho da equipe" },
    ],
  },
  {
    modulo: "Configurações",
    permissoes: [
      { id: "config_visualizar", label: "Visualizar" },
      { id: "config_editar", label: "Editar configurações" },
      { id: "config_integracoes", label: "Gerenciar integrações" },
      { id: "config_usuarios", label: "Gerenciar usuários" },
      { id: "config_cobranca", label: "Gerenciar cobrança" },
    ],
  },
];

export const TODAS_PERMISSOES_IDS = PERMISSOES_POR_MODULO.flatMap((m) => m.permissoes.map((p) => p.id));

export const FUNCOES_PADRAO: { id: string; nome: string; permissoesPadrao: string[] }[] = [
  { id: "administrador", nome: "Administrador", permissoesPadrao: TODAS_PERMISSOES_IDS },
  {
    id: "gestor",
    nome: "Gestor",
    permissoesPadrao: TODAS_PERMISSOES_IDS.filter((p) => !p.startsWith("config_") || p === "config_visualizar"),
  },
  {
    id: "vendedor",
    nome: "Vendedor",
    permissoesPadrao: ["contatos_visualizar", "contatos_criar", "contatos_editar", "wa_visualizar", "wa_responder", "wa_so_proprias", "funil_visualizar", "funil_criar_negocios", "funil_mover_negocios"],
  },
  {
    id: "atendente",
    nome: "Atendente",
    permissoesPadrao: ["contatos_visualizar", "wa_visualizar", "wa_responder", "wa_so_proprias", "funil_visualizar"],
  },
  {
    id: "gestor_trafego",
    nome: "Gestor de tráfego",
    permissoesPadrao: ["contatos_visualizar", "rel_visualizar", "rel_exportar", "funil_visualizar"],
  },
  { id: "visualizador", nome: "Visualizador", permissoesPadrao: ["contatos_visualizar", "funil_visualizar", "rel_visualizar"] },
];
