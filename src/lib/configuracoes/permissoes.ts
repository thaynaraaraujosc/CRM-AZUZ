/**
 * O QUE CADA PESSOA DA EQUIPE PODE FAZER, módulo por módulo.
 *
 * A tela de convite listava sete módulos herdados do desenho antigo ("Relatórios", "Formulários")
 * e não tinha quatro que o CRM passou a ter (Instagram, Equipe, Social Seller, AZUZ IA). Esta
 * lista é a que a Thaynara pediu, com as palavras dela: "WhatsApp, Instagram, funil, formulário,
 * equipe, contato, inteligência comercial, automações, social seller, AZUZ IA e configurações. Só
 * esses módulos."
 *
 * OS IDS NÃO MUDARAM. `rel_visualizar` continua sendo o id do que hoje se chama Inteligência
 * comercial, e `form_*` o dos formulários: o proxy bloqueia rota por esses ids (ver
 * `ROTA_PERMISSAO` em `src/proxy.ts`) e eles já estão gravados na coluna `permissoes` de quem
 * existe. Renomear id é tirar acesso de quem tem, em silêncio; o que mudou foi o RÓTULO.
 *
 * O ESCOPO DENTRO DO MÓDULO é a parte nova, e é o pedido inteiro: "às vezes eu quero colocar um
 * número aqui dentro do meu CRM e quero que esse funcionário veja apenas o funil dele. Eu não
 * quero que ele veja os outros funis, porque ele pode cometer algum erro." Não é uma permissão a
 * mais: é a pergunta "de quais?", respondida por uma lista que só existe na conta dela (os números
 * conectados, os funis criados). Por isso ela não cabe numa constante — ver `ESCOPOS`.
 */

export type PermissaoModulo = {
  modulo: string;
  /** Uma frase que diz o que o módulo é, pra tela não depender do nome sozinho. */
  descricao: string;
  permissoes: { id: string; label: string }[];
  /**
   * Os recortes de "de quais?" deste módulo. Ver `ESCOPOS`.
   *
   * Lista porque o Funil passou a ter DOIS: quais quadros e, dentro deles, quais colunas. Eram um
   * campo só, e um campo só obrigaria a escolher entre as duas perguntas — que são as duas que ela
   * faz.
   */
  escopos?: EscopoDeModulo[];
};

/**
 * "DE QUAIS?" — a pergunta que transforma uma permissão num recorte.
 *
 * NADA MARCADO QUER DIZER TODOS, e isso é deliberado. É o comportamento de hoje (quem vê o módulo
 * vê tudo dele), então ninguém perde acesso no dia em que isto entra; e é o que a pessoa espera de
 * uma lista de caixas vazias. Marcar uma é que restringe — a leitura fica "só estes".
 */
export type EscopoDeModulo = {
  prefixo: string;
  titulo: string;
  /** O que dizer quando a conta ainda não tem nenhum item pra escolher. */
  vazio: string;
};

export const ESCOPOS = {
  /** Quais números de WhatsApp a pessoa enxerga. O valor é o `contaCanal` da conexão. */
  numerosDeWhatsApp: {
    prefixo: "wa_numero",
    titulo: "Quais números de WhatsApp ela enxerga",
    vazio: "Nenhum número de WhatsApp conectado ainda.",
  },
  /** Quais funis a pessoa enxerga. O valor é o id do funil. */
  funis: {
    prefixo: "funil_id",
    titulo: "Quais funis ela enxerga",
    vazio: "Nenhum funil criado ainda.",
  },
  /**
   * QUAIS ETAPAS DO FUNIL a pessoa enxerga. O valor é o id da etapa.
   *
   * "Eu coloquei o closer dentro do meu CRM, ele virou da equipe. Mas eu não quero que ele veja
   * todo o processo do funil — novo, qualificado, proposta, fechado. Eu quero que ele tenha a
   * visão apenas de proposta, porque ele vai ficar responsável por proposta."
   *
   * É um recorte mais fino do que o de funil, e os dois se somam: primeiro quais quadros, depois
   * quais colunas dentro deles. Nada marcado = vê todas, que é o comportamento de hoje e o que
   * mantém quem já existe funcionando sem ninguém abrir tela nenhuma.
   */
  etapasDoFunil: {
    prefixo: "funil_etapa",
    titulo: "Quais etapas do funil ela enxerga",
    vazio: "Nenhuma etapa criada ainda.",
  },
} as const satisfies Record<string, EscopoDeModulo>;

/** O id de uma permissão de escopo: `<prefixo>:<valor>`. */
export function idDeEscopo(escopo: EscopoDeModulo, valor: string): string {
  return `${escopo.prefixo}:${valor}`;
}

/**
 * Os valores marcados de um escopo. `null` = NENHUM marcado, que quer dizer TODOS.
 *
 * A diferença entre `null` e `[]` é o ponto desta função: lista vazia seria "não vê nada", e é
 * justamente o que não pode acontecer com quem nunca abriu esta tela.
 */
export function escopoPermitido(permissoes: string[], escopo: EscopoDeModulo): string[] | null {
  const marcados = permissoes
    .filter((p) => p.startsWith(`${escopo.prefixo}:`))
    .map((p) => p.slice(escopo.prefixo.length + 1))
    .filter(Boolean);
  return marcados.length ? marcados : null;
}

/** Esta pessoa enxerga este item do escopo? Sem nada marcado, enxerga tudo. */
export function escopoDeixaVer(permissoes: string[], escopo: EscopoDeModulo, valor: string | null | undefined): boolean {
  const permitidos = escopoPermitido(permissoes, escopo);
  if (!permitidos) return true;
  // Item sem identificação (conversa antiga sem número gravado, card sem funil) fica visível: ele
  // não pertence a recorte nenhum, e escondê-lo seria sumir com dado vivo por causa de uma coluna
  // que ainda não existia quando ele nasceu.
  if (!valor) return true;
  return permitidos.includes(valor);
}

export const PERMISSOES_POR_MODULO: PermissaoModulo[] = [
  {
    modulo: "WhatsApp",
    descricao: "A caixa de entrada e o atendimento.",
    escopos: [ESCOPOS.numerosDeWhatsApp],
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
    modulo: "Instagram",
    descricao: "Direct, stories e comentários.",
    permissoes: [
      { id: "insta_visualizar", label: "Visualizar conversas" },
      { id: "insta_responder", label: "Responder no Direct" },
      { id: "insta_comentarios", label: "Responder comentários" },
    ],
  },
  {
    modulo: "Funil",
    descricao: "Os quadros de negócios.",
    escopos: [ESCOPOS.funis, ESCOPOS.etapasDoFunil],
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
    modulo: "Formulário",
    descricao: "Os formulários de captação e o que chega por eles.",
    permissoes: [
      { id: "form_visualizar", label: "Visualizar" },
      { id: "form_criar", label: "Criar" },
      { id: "form_editar", label: "Editar" },
      { id: "form_excluir", label: "Excluir" },
    ],
  },
  {
    modulo: "Equipe",
    descricao: "Quem trabalha no CRM e o que cada um pode.",
    permissoes: [
      { id: "equipe_visualizar", label: "Visualizar a equipe" },
      { id: "equipe_convidar", label: "Convidar membro" },
      { id: "equipe_editar", label: "Editar permissões" },
      { id: "equipe_remover", label: "Remover membro" },
    ],
  },
  {
    modulo: "Contatos",
    descricao: "A agenda da empresa.",
    permissoes: [
      { id: "contatos_visualizar", label: "Visualizar" },
      { id: "contatos_criar", label: "Criar" },
      { id: "contatos_editar", label: "Editar" },
      { id: "contatos_excluir", label: "Excluir" },
      { id: "contatos_exportar", label: "Exportar" },
    ],
  },
  {
    modulo: "Inteligência comercial",
    descricao: "Relatórios, tráfego e desempenho.",
    permissoes: [
      { id: "rel_visualizar", label: "Visualizar" },
      { id: "rel_exportar", label: "Exportar" },
      { id: "rel_valores_financeiros", label: "Visualizar valores financeiros" },
      { id: "rel_desempenho_equipe", label: "Visualizar desempenho da equipe" },
    ],
  },
  {
    modulo: "Automações",
    descricao: "Os robôs do funil e das conversas.",
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
    modulo: "Social Seller",
    descricao: "As automações do Instagram e os disparos.",
    permissoes: [
      { id: "social_visualizar", label: "Visualizar" },
      { id: "social_criar", label: "Criar automação" },
      { id: "social_editar", label: "Editar" },
      { id: "social_publicar", label: "Publicar e despublicar" },
    ],
  },
  {
    modulo: "AZUZ IA",
    descricao: "O assistente que lê o CRM.",
    permissoes: [
      { id: "ia_visualizar", label: "Visualizar" },
      { id: "ia_usar", label: "Conversar com a IA" },
    ],
  },
  {
    modulo: "Configurações",
    descricao: "Integrações, cobrança e a conta.",
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

/**
 * A MARCA DE QUE ESTAS PERMISSÕES FORAM ESCOLHIDAS COM OS MÓDULOS NOVOS NA TELA.
 *
 * Instagram, Equipe, Social Seller e AZUZ IA ganharam permissão própria depois que já havia gente
 * usando o CRM. Quem foi convidado antes tem a coluna `permissoes` sem nenhum id desses módulos —
 * e passar a bloquear por eles tiraria, de um dia pro outro, acesso que ninguém nunca negou. Não é
 * uma regra nova sendo aplicada: é uma pergunta que nunca foi feita sendo respondida com "não".
 *
 * Esta marca separa os dois casos sem adivinhação. Ela é gravada junto das permissões sempre que
 * alguém salva pela tela; sem ela, os módulos novos ficam abertos. Com ela, vale exatamente o que
 * está marcado — inclusive nenhum.
 */
export const MARCA_DE_VERSAO = "permissoes_v2";

/** Os módulos que nasceram depois da primeira versão da tela. Ver `MARCA_DE_VERSAO`. */
const MODULOS_NOVOS = ["Instagram", "Equipe", "Social Seller", "AZUZ IA"];

const IDS_DOS_MODULOS_NOVOS = PERMISSOES_POR_MODULO.filter((m) => MODULOS_NOVOS.includes(m.modulo)).flatMap((m) =>
  m.permissoes.map((p) => p.id),
);

/**
 * As permissões que valem de verdade pra esta pessoa.
 *
 * Idêntica à lista gravada, menos num caso: sem a marca de versão, os módulos novos entram. Ver
 * `MARCA_DE_VERSAO`.
 */
export function permissoesEfetivas(permissoes: string[] | null | undefined): string[] {
  const lista = permissoes ?? [];
  if (lista.includes(MARCA_DE_VERSAO)) return lista;
  return [...new Set([...lista, ...IDS_DOS_MODULOS_NOVOS])];
}
