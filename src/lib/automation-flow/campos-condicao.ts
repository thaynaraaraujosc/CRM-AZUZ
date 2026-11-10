/**
 * O CATÁLOGO DE CAMPOS DA CONDIÇÃO: o que cada um compara, de que tipo ele é, e com quais
 * operadores e qual controle de valor ele faz sentido.
 *
 * POR QUE ISTO VIROU UM MÓDULO SÓ. A lista de campos morava no formulário do painel, os rótulos
 * moravam no resumo e a avaliação morava no motor — três lugares com a mesma informação escrita de
 * três jeitos. O efeito aparecia na tela: "Cliente enviar" não existia na lista de campos do
 * painel, então o `<select>` com o valor `mensagem` caía na PRIMEIRA opção ("Canal") enquanto o
 * dado continuava `mensagem`, e a saída do bloco dizia "Resposta do contato contém" pra uma regra
 * que a tela mostrava como "Canal". Nada disso era um defeito de desenho: era duas listas.
 *
 * AQUI SÓ ENTRA CAMPO QUE O CRM TEM DE VERDADE. Campo que não sai de lugar nenhum vira caminho do
 * fluxo que nunca é seguido — a mesma regra do botão falso, do lado da decisão. O que a referência
 * oferece e o CRM ainda não guarda (empresa como registro próprio, catálogo de produtos, NPS,
 * criativo do Meta Ads) está de fora de propósito, e listado no relatório da entrega.
 *
 * Puro: sem React, sem Prisma. Quem precisa das OPÇÕES de uma lista (etiquetas, funis, equipes)
 * pede pelo `opcoes` e resolve no seu lado — o catálogo diz de onde vêm, não vai buscar.
 */

import type { CampoCondicao, OperadorCondicao, RamoDeCondicao, RegraCondicao } from "./types";

/**
 * O tipo do dado decide os operadores e o controle de valor.
 *
 * `multi` é o campo que guarda um CONJUNTO, não um valor: a etiqueta. Ele não "é igual a" nada —
 * ele TEM ou NÃO TEM. Enquanto era tratado como lista, a regra comparava a etiqueta escolhida com
 * todas as etiquetas do contato grudadas por vírgula, e só batia em quem tivesse exatamente uma.
 */
export type TipoDeCampoCondicao =
  | "texto"
  | "lista"
  | "multi"
  | "numero"
  | "moeda"
  | "data"
  | "hora"
  | "booleano";

/** De onde a tela tira as opções de um campo do tipo "lista". */
export type OrigemDeOpcoes =
  | "canais"
  | "etiquetas"
  | "funis"
  | "etapas"
  | "responsaveis"
  | "equipes"
  | "dias_semana"
  | "perfil_instagram"
  | "origens_do_lead";

export type GrupoDeCampo =
  | "Conversa"
  | "Instagram"
  | "Negócio"
  | "Contato"
  | "Rastreio"
  | "Atividade"
  | "Campos personalizados";

/* Instagram logo depois de Conversa: numa automação do Social Seller é o segundo grupo mais usado,
   e no fim da lista ninguém o encontra. */
export const GRUPOS_DE_CAMPO: GrupoDeCampo[] = [
  "Conversa",
  "Instagram",
  "Negócio",
  "Contato",
  "Rastreio",
  "Atividade",
  "Campos personalizados",
];

export type CampoCondicaoInfo = {
  valor: CampoCondicao;
  label: string;
  grupo: GrupoDeCampo;
  tipo: TipoDeCampoCondicao;
  /** Só em `tipo === "lista"`: de onde saem as opções. */
  opcoes?: OrigemDeOpcoes;
  /** Opções fixas, quando elas não dependem do workspace. */
  opcoesFixas?: { valor: string; label: string }[];
};

/**
 * O que o Instagram conta sobre quem escreveu.
 *
 * Vem do perfil que a Meta devolve pra quem MANDOU mensagem pra conta conectada (ver `Contato`,
 * campos `igSegueVoce`/`igVoceSegue`/`igVerificado`). Não é consulta livre a qualquer perfil: por
 * isso só estes três, e não "quantidade de seguidores maior que", que a API não garante.
 */
export const PERFIS_INSTAGRAM = [
  { valor: "seguidor", label: "um seguidor no Instagram" },
  { valor: "seguido", label: "alguém que você segue no Instagram" },
  { valor: "verificado", label: "uma conta verificada no Instagram" },
];

export const CAMPOS_CONDICAO: CampoCondicaoInfo[] = [
  /* ---------------------------------- Conversa --------------------------------- */
  // A regra que quase todo roteador de atendimento escreve primeiro, e por isso a padrão.
  { valor: "mensagem", label: "Cliente enviar (última mensagem)", grupo: "Conversa", tipo: "texto" },
  { valor: "comentario", label: "Comentário do cliente", grupo: "Conversa", tipo: "texto" },
  { valor: "cliente_perfil", label: "Cliente", grupo: "Conversa", tipo: "lista", opcoes: "perfil_instagram" },
  { valor: "canal", label: "Canal (mensageiro ativo)", grupo: "Conversa", tipo: "lista", opcoes: "canais" },
  { valor: "palavra_chave", label: "Palavra-chave", grupo: "Conversa", tipo: "texto" },
  { valor: "respondeu", label: "Respondeu", grupo: "Conversa", tipo: "booleano" },
  { valor: "numero_salvo", label: "Número salvo", grupo: "Conversa", tipo: "booleano" },
  { valor: "recebeu_automacao", label: "Recebeu automação", grupo: "Conversa", tipo: "booleano" },
  { valor: "em_outra_automacao", label: "Está em outra automação", grupo: "Conversa", tipo: "booleano" },
  { valor: "tentativas", label: "Tentativas", grupo: "Conversa", tipo: "numero" },
  { valor: "data_ultima_conversa", label: "Data da última conversa", grupo: "Conversa", tipo: "data" },
  { valor: "horario_ultima_mensagem", label: "Horário da última mensagem", grupo: "Conversa", tipo: "hora" },

  /* --------------------------------- Instagram --------------------------------- */
  /*
   * O QUE A CONTA CONECTADA SABE SOBRE QUEM ESTÁ DO OUTRO LADO.
   *
   * Relação de seguir, selo e número de seguidores vêm do perfil que a Meta devolve pra quem
   * MANDOU mensagem pra conta (ver `Contato.igSegueVoce` e companhia). Não é consulta livre a
   * qualquer perfil: a API não permite, e por isso o dado só existe depois que a pessoa escreve.
   *
   * Tipo de interação, publicação e @ saem do EVENTO que disparou o fluxo, e por isso valem
   * durante aquela execução — é com eles que se escreve "se veio de comentário, responde assim; se
   * veio de story, assim".
   *
   * TODOS TRATAM AUSÊNCIA COMO AUSÊNCIA. Instagram desconectado, permissão não concedida, evento
   * que não carrega o dado: a regra responde "não existe" em vez de "falso". A diferença decide
   * pra onde o lead vai, e chutar "falso" mandaria todo mundo pelo caminho de quem não segue.
   */
  { valor: "ig_seguidor", label: "É seguidor (segue seu perfil)", grupo: "Instagram", tipo: "booleano" },
  { valor: "ig_voce_segue", label: "Você segue o contato", grupo: "Instagram", tipo: "booleano" },
  { valor: "ig_janela_24h", label: "Dentro da janela de 24h", grupo: "Instagram", tipo: "booleano" },
  {
    valor: "ig_tipo_interacao",
    label: "Tipo de interação",
    grupo: "Instagram",
    tipo: "lista",
    opcoesFixas: [
      { valor: "comentario", label: "Comentário em post/Reels" },
      { valor: "story_respondido", label: "Resposta de story" },
      { valor: "mencao_story", label: "Menção em story" },
      { valor: "direct", label: "Mensagem direta (DM)" },
      { valor: "comentario_live", label: "Comentário em Live" },
    ],
  },
  { valor: "ig_post_id", label: "Post comentado (ID)", grupo: "Instagram", tipo: "texto" },
  { valor: "ig_post_link", label: "Link do post comentado", grupo: "Instagram", tipo: "texto" },
  { valor: "ig_arroba", label: "@ do contato", grupo: "Instagram", tipo: "texto" },
  { valor: "ig_verificado", label: "Conta verificada", grupo: "Instagram", tipo: "booleano" },
  { valor: "ig_seguidores", label: "Nº de seguidores do contato", grupo: "Instagram", tipo: "numero" },

  /* ---------------------------------- Negócio ---------------------------------- */
  { valor: "funil", label: "Funil", grupo: "Negócio", tipo: "lista", opcoes: "funis" },
  { valor: "etapa", label: "Etapa", grupo: "Negócio", tipo: "lista", opcoes: "etapas" },
  { valor: "valor_negocio", label: "Valor do negócio", grupo: "Negócio", tipo: "moeda" },

  /* ---------------------------------- Contato ---------------------------------- */
  { valor: "origem", label: "Origem (fonte do lead)", grupo: "Contato", tipo: "lista", opcoes: "origens_do_lead" },
  /* A etiqueta é um CONJUNTO: o contato tem várias. Ver `TipoDeCampoCondicao`. */
  { valor: "etiqueta", label: "Etiqueta", grupo: "Contato", tipo: "multi", opcoes: "etiquetas" },
  { valor: "responsavel", label: "Responsável", grupo: "Contato", tipo: "lista", opcoes: "responsaveis" },
  { valor: "equipe", label: "Equipe", grupo: "Contato", tipo: "lista", opcoes: "equipes" },
  { valor: "cargo", label: "Cargo", grupo: "Contato", tipo: "texto" },
  { valor: "email", label: "E-mail", grupo: "Contato", tipo: "texto" },
  { valor: "telefone_celular", label: "Telefone (Cel.)", grupo: "Contato", tipo: "texto" },
  { valor: "telefone_comercial", label: "Telefone (Comercial)", grupo: "Contato", tipo: "texto" },
  { valor: "empresa", label: "Empresa (nome)", grupo: "Contato", tipo: "texto" },
  { valor: "cidade", label: "Cidade", grupo: "Contato", tipo: "texto" },
  { valor: "estado", label: "Estado", grupo: "Contato", tipo: "texto" },
  { valor: "consentimento", label: "Termos do usuário (consentimento)", grupo: "Contato", tipo: "booleano" },

  /* ---------------------------------- Rastreio --------------------------------- */
  // Tudo isto sai de `OrigemDoLead`, a tabela que guarda de onde o lead veio com precisão de
  // clique. Já existia e ninguém conseguia decidir nada com ela dentro de uma automação.
  { valor: "campanha", label: "Campanha", grupo: "Rastreio", tipo: "texto" },
  { valor: "anuncio", label: "Anúncio", grupo: "Rastreio", tipo: "texto" },
  { valor: "utm_source", label: "utm_source", grupo: "Rastreio", tipo: "texto" },
  { valor: "utm_medium", label: "utm_medium", grupo: "Rastreio", tipo: "texto" },
  { valor: "utm_campaign", label: "utm_campaign", grupo: "Rastreio", tipo: "texto" },
  { valor: "utm_content", label: "utm_content", grupo: "Rastreio", tipo: "texto" },
  { valor: "utm_term", label: "utm_term", grupo: "Rastreio", tipo: "texto" },
  { valor: "pagina_entrada", label: "Página de entrada", grupo: "Rastreio", tipo: "texto" },
  { valor: "gclid", label: "gclid (clique do Google)", grupo: "Rastreio", tipo: "texto" },
  { valor: "fbclid", label: "fbclid (clique da Meta)", grupo: "Rastreio", tipo: "texto" },
  { valor: "utm_referrer", label: "utm_referrer", grupo: "Rastreio", tipo: "texto" },
  { valor: "referrer", label: "De onde a pessoa veio (referrer)", grupo: "Rastreio", tipo: "texto" },
  { valor: "ttclid", label: "ttclid (clique do TikTok)", grupo: "Rastreio", tipo: "texto" },
  { valor: "meta_ads_campanha", label: "Meta Ads: ID da campanha", grupo: "Rastreio", tipo: "texto" },
  { valor: "meta_ads_conjunto", label: "Meta Ads: ID do conjunto", grupo: "Rastreio", tipo: "texto" },
  { valor: "meta_ads_anuncio", label: "Meta Ads: ID do anúncio", grupo: "Rastreio", tipo: "texto" },
  { valor: "meta_ads_criativo", label: "Meta Ads: ID do criativo", grupo: "Rastreio", tipo: "texto" },
  { valor: "meta_source", label: "Meta: superfície do clique (ig/fb)", grupo: "Rastreio", tipo: "texto" },
  { valor: "meta_ref", label: "Meta: referência do anúncio", grupo: "Rastreio", tipo: "texto" },
  { valor: "origem_caminho", label: "Por onde o lead entrou", grupo: "Rastreio", tipo: "texto" },
  { valor: "primeiro_toque_em", label: "Data do primeiro toque", grupo: "Rastreio", tipo: "data" },
  /*
   * O ÚLTIMO TOQUE, com os campos que decidem alguma coisa.
   *
   * O primeiro toque explica como a pessoa conheceu a empresa; o último, por que ela voltou agora.
   * São poucos de propósito: repetir as vinte colunas com prefixo transformaria a lista de campos
   * num catálogo que ninguém lê até o fim. A ficha do lead mostra o último toque inteiro.
   */
  { valor: "ultimo_utm_source", label: "Último toque: utm_source", grupo: "Rastreio", tipo: "texto" },
  { valor: "ultimo_utm_campaign", label: "Último toque: utm_campaign", grupo: "Rastreio", tipo: "texto" },
  { valor: "ultimo_campanha", label: "Último toque: campanha", grupo: "Rastreio", tipo: "texto" },
  { valor: "ultimo_anuncio", label: "Último toque: anúncio", grupo: "Rastreio", tipo: "texto" },
  { valor: "ultimo_caminho", label: "Último toque: por onde entrou", grupo: "Rastreio", tipo: "texto" },
  { valor: "ultimo_toque_em", label: "Data do último toque", grupo: "Rastreio", tipo: "data" },

  /* --------------------------------- Atividade --------------------------------- */
  { valor: "possui_agendamento", label: "Possui agendamento", grupo: "Atividade", tipo: "booleano" },
  {
    valor: "situacao_agendamento",
    label: "Situação do agendamento",
    grupo: "Atividade",
    tipo: "lista",
    opcoesFixas: [
      { valor: "agendado", label: "Agendado" },
      { valor: "confirmado", label: "Confirmado" },
      { valor: "realizado", label: "Realizado" },
      { valor: "cancelado", label: "Cancelado" },
      { valor: "faltou", label: "Faltou" },
    ],
  },
  { valor: "dia_semana", label: "Dia da semana", grupo: "Atividade", tipo: "lista", opcoes: "dias_semana" },
  { valor: "horario", label: "Horário", grupo: "Atividade", tipo: "hora" },

  /* ---------------------- Compatibilidade com fluxos antigos -------------------- */
  // Fluxos publicados antes dos campos personalizados virarem itens próprios usam este, com o
  // nome digitado à mão. Continua funcionando; a tela nova não oferece mais.
  { valor: "campo_personalizado", label: "Campo personalizado (pelo nome)", grupo: "Campos personalizados", tipo: "texto" },
];

const POR_VALOR = new Map(CAMPOS_CONDICAO.map((c) => [c.valor, c]));

/** O prefixo que marca um campo criado pela própria empresa: `cp:<id do campo>`. */
export const PREFIXO_CAMPO_PERSONALIZADO = "cp:";

export function ehCampoPersonalizado(campo: string): boolean {
  return campo.startsWith(PREFIXO_CAMPO_PERSONALIZADO);
}

export function idDoCampoPersonalizado(campo: string): string {
  return campo.slice(PREFIXO_CAMPO_PERSONALIZADO.length);
}

/**
 * O tipo de um campo. Campo que não existe mais (apagado da empresa, ou de uma versão anterior do
 * produto) responde "texto": a regra continua editável em vez de sumir da tela com o fluxo.
 */
export function tipoDoCampo(campo: CampoCondicao, personalizados: CampoCondicaoInfo[] = []): TipoDeCampoCondicao {
  return POR_VALOR.get(campo)?.tipo ?? personalizados.find((c) => c.valor === campo)?.tipo ?? "texto";
}

/** O nome do campo pra quem lê. Nunca o identificador técnico ("valor_negocio"). */
export function rotuloDoCampo(campo: CampoCondicao, personalizados: CampoCondicaoInfo[] = []): string {
  return POR_VALOR.get(campo)?.label ?? personalizados.find((c) => c.valor === campo)?.label ?? campo;
}

export function infoDoCampo(campo: CampoCondicao, personalizados: CampoCondicaoInfo[] = []): CampoCondicaoInfo | undefined {
  return POR_VALOR.get(campo) ?? personalizados.find((c) => c.valor === campo);
}

/**
 * OS OPERADORES QUE FAZEM SENTIDO PARA CADA TIPO.
 *
 * Antes eram os mesmos onze em todo campo. "Data da última conversa começa com" e "Respondeu entre"
 * são perguntas que não querem dizer nada, e quem escolhia uma delas montava um caminho que nunca
 * era seguido — sem nenhum aviso, porque a regra é sintaticamente válida.
 *
 * Os rótulos mudam com o tipo de propósito: em data, "menor que" é "antes de". É o mesmo operador
 * pro motor (nada muda no dado gravado), e a frase que a pessoa lê passa a ser a da vida real.
 */
export const OPERADORES_POR_TIPO: Record<TipoDeCampoCondicao, { valor: OperadorCondicao; label: string }[]> = {
  texto: [
    { valor: "igual", label: "é igual a" },
    { valor: "diferente", label: "é diferente de" },
    { valor: "contem", label: "contém" },
    { valor: "nao_contem", label: "não contém" },
    { valor: "comeca_com", label: "começa com" },
    { valor: "termina_com", label: "termina com" },
    { valor: "existe", label: "existe" },
    { valor: "nao_existe", label: "não existe" },
  ],
  lista: [
    { valor: "igual", label: "é" },
    { valor: "diferente", label: "não é" },
    { valor: "um_destes", label: "é um destes" },
    { valor: "nenhum_destes", label: "não é nenhum destes" },
    { valor: "existe", label: "existe" },
    { valor: "nao_existe", label: "não existe" },
  ],
  /*
   * O CAMPO QUE É UM CONJUNTO não "é igual a" nada: ele TEM ou NÃO TEM.
   *
   * "tem qualquer uma de" e "tem todas de" são perguntas diferentes e as duas aparecem em
   * automação de verdade: "é cliente OU é vip" não é o mesmo que "é cliente E é vip".
   */
  multi: [
    { valor: "tem", label: "tem" },
    { valor: "nao_tem", label: "não tem" },
    { valor: "tem_qualquer", label: "tem qualquer uma de" },
    { valor: "tem_todas", label: "tem todas de" },
    { valor: "nao_tem_nenhuma", label: "não tem nenhuma de" },
    { valor: "existe", label: "tem alguma" },
    { valor: "nao_existe", label: "não tem nenhuma" },
  ],
  numero: [
    { valor: "igual", label: "é igual a" },
    { valor: "diferente", label: "é diferente de" },
    { valor: "maior_que", label: "maior que" },
    { valor: "maior_igual", label: "maior ou igual a" },
    { valor: "menor_que", label: "menor que" },
    { valor: "menor_igual", label: "menor ou igual a" },
    { valor: "entre", label: "entre" },
    { valor: "existe", label: "existe" },
    { valor: "nao_existe", label: "não existe" },
  ],
  moeda: [
    { valor: "igual", label: "é igual a" },
    { valor: "diferente", label: "é diferente de" },
    { valor: "maior_que", label: "maior que" },
    { valor: "maior_igual", label: "maior ou igual a" },
    { valor: "menor_que", label: "menor que" },
    { valor: "menor_igual", label: "menor ou igual a" },
    { valor: "entre", label: "entre" },
    { valor: "existe", label: "existe" },
    { valor: "nao_existe", label: "não existe" },
  ],
  /*
   * DATA PERGUNTA EM DIAS, não em texto.
   *
   * "nos últimos X dias" e "há mais de X dias" são o que quase toda automação quer saber de uma
   * data ("falou com a gente esta semana?"), e sem elas a pessoa tinha que digitar uma data fixa
   * que envelhecia no dia seguinte — a regra continuava lá, parecendo certa, decidindo errado.
   */
  data: [
    { valor: "e_hoje", label: "é hoje" },
    { valor: "ultimos_dias", label: "nos últimos X dias" },
    { valor: "ha_mais_de_dias", label: "há mais de X dias" },
    { valor: "menor_que", label: "é antes de" },
    { valor: "maior_que", label: "é depois de" },
    { valor: "igual", label: "é igual a" },
    { valor: "entre", label: "entre" },
    { valor: "existe", label: "existe" },
    { valor: "nao_existe", label: "não existe" },
  ],
  hora: [
    { valor: "igual", label: "é igual a" },
    { valor: "menor_que", label: "antes de" },
    { valor: "maior_que", label: "depois de" },
    { valor: "entre", label: "entre" },
    { valor: "existe", label: "existe" },
    { valor: "nao_existe", label: "não existe" },
  ],
  /*
   * BOOLEANO NÃO TEM CAMPO DE VALOR: o operador já é a pergunta inteira.
   *
   * Era "é igual a: sim", e o "sim" dependia do texto gravado na coluna — um fluxo comparando com
   * "true", "1" ou "Sim" com maiúscula decidia errado sem aviso. `existe`/`não existe` continuam
   * porque "não se sabe" é uma terceira resposta de verdade: Instagram desconectado não é "não
   * segue".
   */
  booleano: [
    { valor: "verdadeiro", label: "é verdadeiro" },
    { valor: "falso", label: "é falso" },
    { valor: "existe", label: "existe" },
    { valor: "nao_existe", label: "não existe" },
  ],
};

/** Operadores que comparam com uma LISTA de valores, e não com um valor só. */
export const OPERADORES_MULTIVALOR: OperadorCondicao[] = [
  "um_destes",
  "nenhum_destes",
  "tem_qualquer",
  "tem_todas",
  "nao_tem_nenhuma",
];

export function pedeVariosValores(operador: OperadorCondicao): boolean {
  return OPERADORES_MULTIVALOR.includes(operador);
}

/** Operadores cujo valor é um NÚMERO DE DIAS, mesmo num campo de data. */
export const OPERADORES_EM_DIAS: OperadorCondicao[] = ["ultimos_dias", "ha_mais_de_dias"];

export function pedeNumeroDeDias(operador: OperadorCondicao): boolean {
  return OPERADORES_EM_DIAS.includes(operador);
}

export function operadoresDoCampo(
  campo: CampoCondicao,
  personalizados: CampoCondicaoInfo[] = [],
): { valor: OperadorCondicao; label: string }[] {
  return OPERADORES_POR_TIPO[tipoDoCampo(campo, personalizados)];
}

/** O rótulo do operador no contexto do campo: o mesmo `menor_que` é "antes de" numa data. */
export function rotuloDoOperador(
  operador: OperadorCondicao,
  campo: CampoCondicao,
  personalizados: CampoCondicaoInfo[] = [],
): string {
  const doTipo = operadoresDoCampo(campo, personalizados).find((o) => o.valor === operador);
  if (doTipo) return doTipo.label;
  // Operador gravado antes de o campo mudar de tipo: mostra o rótulo genérico em vez de sumir.
  return OPERADORES_POR_TIPO.texto.find((o) => o.valor === operador)?.label ?? operador;
}

/**
 * O VALOR DE UMA REGRA COMO A PESSOA O ESCOLHEU NA TELA.
 *
 * Campo de lista guarda o IDENTIFICADOR e mostra o rótulo: a regra grava `story_respondido` e a
 * lista oferece "Resposta de story". Quem escreve a frase do bloco — a saída no desenho, o resumo
 * do cartão — estava imprimindo o identificador cru, e a tela passava a falar uma língua que
 * ninguém escolheu: `Tipo de interação é "story_respondido"`.
 *
 * Só resolve o que o catálogo conhece (opções fixas e os perfis do Instagram). Lista que vem do
 * workspace — funil, etapa, etiqueta, responsável — guarda o próprio nome como valor, então ali o
 * identificador JÁ é o que a pessoa leu.
 */
export function rotuloDoValorDaRegra(campo: CampoCondicao, valor: string | undefined): string {
  const bruto = (valor ?? "").trim();
  if (!bruto) return bruto;
  const info = POR_VALOR.get(campo);
  const fixa = info?.opcoesFixas?.find((o) => o.valor === bruto);
  if (fixa) return fixa.label;
  if (info?.opcoes === "perfil_instagram") {
    return PERFIS_INSTAGRAM.find((p) => p.valor === bruto)?.label ?? bruto;
  }
  return bruto;
}

/** Operadores que não comparam valor nenhum: o controle de valor some com eles. */
export const OPERADORES_SEM_VALOR: OperadorCondicao[] = [
  "existe",
  "nao_existe",
  // O booleano cabe inteiro no operador: "é verdadeiro" não compara com nada.
  "verdadeiro",
  "falso",
  "e_hoje",
];

export function pedeValor(operador: OperadorCondicao): boolean {
  return !OPERADORES_SEM_VALOR.includes(operador);
}

/**
 * A FONTE DO VALOR COMPARADO.
 *
 * Quase sempre a pessoa digita o valor ("contém: orçamento"), e é por isso que "manual" é o
 * padrão. Mas há regra que compara um campo com OUTRO dado do próprio lead — "a última mensagem
 * contém o nome do responsável" — e, até aqui, isso não tinha como ser escrito.
 *
 * As fontes que não são "manual" nem "vazio" são os MESMOS tokens que as mensagens usam
 * (`{primeiro_nome}`, `{etapa_funil}`…), resolvidos pelo mesmo código. Uma segunda lista de
 * "origens de valor" divergiria da primeira no primeiro campo que alguém acrescentasse de um lado.
 */
export type FonteDeValor = "manual" | "vazio" | string;

export const FONTES_DE_VALOR: { valor: string; label: string; grupo: string }[] = [
  { valor: "manual", label: "Entrada manual", grupo: "Valor" },
  { valor: "vazio", label: "Não preenchido", grupo: "Valor" },
  { valor: "{mensagem}", label: "Mensagem do cliente", grupo: "Conversa" },
  { valor: "{canal}", label: "Canal da conversa", grupo: "Conversa" },
  { valor: "{primeiro_nome}", label: "Primeiro nome", grupo: "Contato" },
  { valor: "{nome_completo}", label: "Nome completo", grupo: "Contato" },
  { valor: "{sobrenome}", label: "Sobrenome", grupo: "Contato" },
  { valor: "{telefone}", label: "Telefone", grupo: "Contato" },
  { valor: "{email}", label: "E-mail", grupo: "Contato" },
  { valor: "{empresa}", label: "Empresa", grupo: "Contato" },
  { valor: "{cargo}", label: "Cargo", grupo: "Contato" },
  { valor: "{cidade}", label: "Cidade", grupo: "Contato" },
  { valor: "{estado}", label: "Estado", grupo: "Contato" },
  { valor: "{atendente}", label: "Nome do responsável", grupo: "Lead" },
  { valor: "{etapa_funil}", label: "Etapa do funil", grupo: "Lead" },
  { valor: "{valor_negocio}", label: "Valor do negócio", grupo: "Lead" },
  { valor: "{origem}", label: "Origem do lead", grupo: "Lead" },
  { valor: "{data}", label: "Data de hoje", grupo: "Tempo" },
  { valor: "{horario}", label: "Horário de agora", grupo: "Tempo" },
];

export function rotuloDaFonte(fonte: FonteDeValor | undefined): string {
  if (!fonte || fonte === "manual") return "Entrada manual";
  return FONTES_DE_VALOR.find((f) => f.valor === fonte)?.label ?? fonte;
}

/** A fonte escolhida ainda pede um texto digitado? Só "manual" pede. */
export function fontePedeTexto(fonte: FonteDeValor | undefined): boolean {
  return !fonte || fonte === "manual";
}

/**
 * A REGRA COM QUE TODO CAMINHO NASCE.
 *
 * Caminho sem regra é verdadeiro — um grupo "E" vazio passa sempre — e um caminho verdadeiro apaga
 * em silêncio todos os de baixo e o "Nenhuma das condições". O bloco parecia configurado e mandava
 * todo mundo pelo primeiro desvio. Nascer com uma regra de verdade resolve isso antes de acontecer.
 */
export function regraPadrao(id: string): RegraCondicao {
  return { id, campo: "mensagem", operador: "igual", valor: "", fonteValor: "manual" };
}

let contador = 0;
/** Id único e estável: é ele que amarra a aresta que sai desta condição. */
export function novoIdDeCondicao(prefixo: string): string {
  contador += 1;
  return `${prefixo}-${Date.now()}-${contador}`;
}

/** Uma condição nova, já com a regra padrão: condição sem regra pega todo mundo. */
export function novoRamoDeCondicao(): RamoDeCondicao {
  return {
    id: novoIdDeCondicao("ramo"),
    grupo: {
      id: novoIdDeCondicao("grupo"),
      tipo: "E",
      regras: [regraPadrao(novoIdDeCondicao("regra"))],
      subgrupos: [],
    },
  };
}

/** Os campos do grupo Instagram. Usado pela validação: eles só decidem com a conta conectada. */
export const CAMPOS_DE_INSTAGRAM: CampoCondicao[] = CAMPOS_CONDICAO.filter((c) => c.grupo === "Instagram").map(
  (c) => c.valor,
);

export function ehCampoDeInstagram(campo: string): boolean {
  return (CAMPOS_DE_INSTAGRAM as string[]).includes(campo);
}

/**
 * O campo ainda existe no produto?
 *
 * Campo criado pela empresa (`cp:<id>`) responde "sim" aqui: se ele ainda existe NAQUELE workspace
 * é coisa que só a tela sabe, e este módulo é puro. O antigo `campo_personalizado` também passa —
 * ele é um campo de verdade, só que pelo nome.
 */
export function campoDeCondicaoExiste(campo: string): boolean {
  return POR_VALOR.has(campo as CampoCondicao) || ehCampoPersonalizado(campo);
}
