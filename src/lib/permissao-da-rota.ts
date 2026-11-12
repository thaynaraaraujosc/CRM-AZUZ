/**
 * QUAL PERMISSÃO CADA ENDEREÇO EXIGE — telas e API na mesma régua.
 *
 * Separado do `proxy.ts` porque virou regra de verdade, com dois lados que precisam concordar, e
 * regra de segurança tem que ter teste.
 *
 * O QUE ESTAVA ERRADO, e é o que ela viu:
 *
 *   "Eu fiz um acesso pra um funcionário, coloquei que ele não poderia ficar com os dois WhatsApp,
 *    só um. E ele me mandou o print: tá com acesso do WhatsApp, do Insta, de coisas que eu tinha
 *    tirado."
 *
 * O bloqueio por permissão pulava `/api` de propósito — está escrito no código: `&&
 * !pathname.startsWith("/api")`. Então a TELA era barrada e os DADOS não. Qualquer página que
 * chamasse a API de outro módulo recebia tudo, e qualquer pessoa com a sessão aberta podia pedir
 * `/api/instagram` direto. A trava era uma cortina.
 *
 * Agora a mesma permissão vale nos dois lados. O mapa é o mesmo: a tela `/instagram` e a API
 * `/api/instagram` exigem `insta_visualizar`, e assim por diante.
 */

/** Módulo do CRM que cada tela pertence. Rota fora desta lista não é restringível. */
export const ROTA_PERMISSAO: Record<string, string> = {
  "/contatos": "contatos_visualizar",
  "/conversas": "wa_visualizar",
  "/funil": "funil_visualizar",
  "/pipeline": "funil_visualizar",
  "/formularios": "form_visualizar",
  "/automacoes": "auto_visualizar",
  "/configuracoes": "config_visualizar",
  "/relatorios": "rel_visualizar",
  "/trafego": "rel_visualizar",
  "/performance-vendas": "rel_visualizar",
  "/atividades-vendas": "rel_visualizar",
  "/jornada-cliente": "rel_visualizar",
  "/motivos-perda": "rel_visualizar",
  "/crm-live": "rel_visualizar",
  "/inteligencia-comercial": "rel_visualizar",
  "/instagram": "insta_visualizar",
  "/equipe": "equipe_visualizar",
  "/social-seller": "social_visualizar",
  "/azuz-ia": "ia_visualizar",
};

/**
 * A MESMA RÉGUA PARA A API.
 *
 * Mapeada à mão, e não derivada de `ROTA_PERMISSAO`, porque os nomes não batem um a um: a tela é
 * `/conversas` e a API é `/api/mensagens`, `/api/mensagens-extra`, `/api/conversas`. Derivar
 * deixaria de fora exatamente as que importam.
 */
export const API_PERMISSAO: Record<string, string> = {
  // WhatsApp
  "/api/conversas": "wa_visualizar",
  "/api/mensagens-extra": "wa_visualizar",
  "/api/whatsapp": "wa_visualizar",
  "/api/canais": "wa_visualizar",
  "/api/templates": "wa_visualizar",
  "/api/anexos": "wa_visualizar",
  // Instagram
  "/api/instagram": "insta_visualizar",
  // Funil
  "/api/funis": "funil_visualizar",
  // Contatos
  "/api/contatos": "contatos_visualizar",
  // Formulários
  "/api/formularios": "form_visualizar",
  // Automações
  "/api/automacoes": "auto_visualizar",
  "/api/automacoes-fluxos": "auto_visualizar",
  "/api/automacoes-pastas": "auto_visualizar",
  // Social Seller
  "/api/social": "social_visualizar",
  // Equipe
  "/api/equipe": "equipe_visualizar",
  "/api/convite": "equipe_visualizar",
  // AZUZ IA
  "/api/azuz-ia": "ia_visualizar",
  // Inteligência comercial
  "/api/relatorios": "rel_visualizar",
  "/api/trafego": "rel_visualizar",
  "/api/campanhas": "rel_visualizar",
  "/api/motivos-perda": "rel_visualizar",
  "/api/rastreio": "rel_visualizar",
  // Configurações
  "/api/integracoes": "config_visualizar",
  "/api/workspace": "config_visualizar",
  "/api/expediente": "config_visualizar",
  "/api/seguranca": "config_visualizar",
  "/api/armazenamento": "config_visualizar",
  // Documentos (biblioteca da empresa): segue Formulários, que é o módulo que os produz.
  "/api/documentos": "form_visualizar",
  "/api/documentos-modelos": "form_visualizar",
  "/api/biblioteca-documentos": "form_visualizar",
};

/**
 * ENDEREÇOS DE API QUE NUNCA SÃO BLOQUEADOS POR MÓDULO.
 *
 * São os que todo mundo logado precisa só pra o CRM funcionar — a sessão, o idioma, as
 * preferências da própria pessoa, o aviso de assinatura — e os que o CRM chama de fora da sessão
 * (webhook de canal, retorno de pagamento). Barrá-los por módulo quebraria a conta de quem tem
 * permissão de um módulo só, sem proteger nada: não há dado de outro módulo neles.
 *
 * A lista é de PREFIXOS, e a ordem não importa: a decisão é "começa com".
 */
export const API_SEMPRE_LIBERADA = [
  "/api/auth",
  "/api/preferencias",
  "/api/idioma",
  "/api/assinatura",
  "/api/webhook",
  "/api/webhooks",
  "/api/perfil",
  "/api/me",
  "/api/notificacoes",
  "/api/upload",
  "/api/saude",
  "/api/versao",
  "/api/cron",
  "/api/cadastro",
  "/api/impersonar",
  "/api/recursos",
  "/api/admin",
];

/**
 * AS PERMISSÕES FINAS: o que a pessoa pode FAZER, e não só ver.
 *
 * "Faz as permissões finas."
 *
 * Até aqui valia só "vê o módulo" ou "não vê" — então quem tinha permissão de ver o WhatsApp
 * conseguia, pela API, enviar mensagem, apagar conversa e reagir. As caixinhas de "Responder",
 * "Excluir mensagens", "Criar negócios" eram gravadas no banco e nenhuma rota as consultava.
 *
 * A chave é o MÉTODO: ler é GET, criar é POST, mudar é PUT/PATCH, apagar é DELETE. O proxy já vê
 * os dois (endereço e método), então a regra cabe no mesmo lugar onde o bloqueio por módulo já
 * mora — sem espalhar checagem por quarenta rotas, que é como se esquece uma.
 *
 * DECLARO SÓ O QUE É INEQUÍVOCO. Onde um endereço serve a várias ações pelo mesmo método (o PUT
 * de `/api/funis` grava etapa, ordem e cartão de uma vez), o método fica sem regra própria e vale
 * a do módulo. Restringir no chute quebraria a conta de quem tem a permissão certa, em silêncio,
 * e a pessoa só descobre quando precisa.
 */
type RegraFina = {
  /** POST. */
  criar?: string;
  /** PUT e PATCH. */
  editar?: string;
  /** DELETE. */
  excluir?: string;
};

export const API_REGRA_FINA: Record<string, RegraFina> = {
  // WHATSAPP: enviar é a que mais importa — era o furo que eu mesmo apontei na entrega passada.
  "/api/conversas/enviar": { criar: "wa_responder" },
  "/api/conversas/reagir": { criar: "wa_responder" },
  "/api/integracoes/whatsapp-nao-oficial/enviar": { criar: "wa_responder" },
  "/api/integracoes/meta/whatsapp/enviar": { criar: "wa_responder" },
  "/api/conversas/[id]": { excluir: "wa_excluir_mensagens" },
  "/api/mensagens-extra": { excluir: "wa_excluir_mensagens" },

  // INSTAGRAM
  "/api/instagram/mensagens": { criar: "insta_responder" },
  "/api/integracoes/instagram/enviar": { criar: "insta_responder" },
  "/api/integracoes/instagram/enviar-anexo": { criar: "insta_responder" },

  // FUNIL: só o que tem endereço próprio. O PUT de `/api/funis` grava o quadro inteiro (etapa,
  // ordem e cartão juntos) e por isso fica de fora — ver o comentário acima.
  "/api/funis/mover": { criar: "funil_mover_negocios" },

  // CONTATOS
  "/api/contatos": { criar: "contatos_criar" },
  "/api/contatos/[id]": { editar: "contatos_editar", excluir: "contatos_excluir" },

  // AUTOMAÇÕES
  "/api/automacoes": { criar: "auto_criar", editar: "auto_editar", excluir: "auto_excluir" },
  "/api/automacoes-fluxos": { criar: "auto_criar", editar: "auto_editar", excluir: "auto_excluir" },
  "/api/automacoes-pastas": { criar: "auto_criar", editar: "auto_editar", excluir: "auto_excluir" },

  // EQUIPE: convidar, editar permissões e remover são três permissões distintas, e são as três
  // coisas que dão medo quando a pessoa errada pode fazer.
  "/api/equipe": { criar: "equipe_convidar" },
  "/api/equipe/[id]": { editar: "equipe_editar", excluir: "equipe_remover" },

  // CONFIGURAÇÕES: mexer em integração é desconectar o WhatsApp da empresa inteira.
  "/api/integracoes": { criar: "config_integracoes", editar: "config_integracoes", excluir: "config_integracoes" },
  "/api/workspace": { editar: "config_editar" },
};

/** Qual campo da regra fina este método usa. GET e HEAD não mudam nada: só pedem o módulo. */
function campoDoMetodo(metodo: string): keyof RegraFina | null {
  const m = metodo.toUpperCase();
  if (m === "POST") return "criar";
  if (m === "PUT" || m === "PATCH") return "editar";
  if (m === "DELETE") return "excluir";
  return null;
}

/**
 * Casa um caminho com uma chave do mapa, entendendo `[id]` como um trecho qualquer.
 *
 * `/api/contatos/abc123` tem que casar com `/api/contatos/[id]` e NÃO com `/api/contatos` — senão
 * apagar um contato pediria a permissão de criar.
 */
function casaComPadrao(pathname: string, padrao: string): boolean {
  const partesCaminho = pathname.split("/").filter(Boolean);
  const partesPadrao = padrao.split("/").filter(Boolean);
  if (partesCaminho.length !== partesPadrao.length) return false;
  return partesPadrao.every((parte, i) => parte === "[id]" || parte === partesCaminho[i]);
}

/**
 * A permissão fina que este endereço + método exigem, ou `null` quando não há regra própria.
 *
 * Devolver `null` NÃO libera: quem chama continua exigindo a permissão do módulo. Esta função só
 * responde "além de ver o módulo, precisa de mais alguma coisa?".
 */
export function permissaoFina(caminhoOuUrl: string, metodo: string): string | null {
  const pathname = caminhoOuUrl.split("?")[0].split("#")[0];
  const campo = campoDoMetodo(metodo);
  if (!campo) return null;

  /*
   * QUEM CASA EXATO MANDA, E NÃO HERDA DE CIMA.
   *
   * `/api/contatos/[id]` declara editar e excluir, e não criar. Um POST nele não é "criar
   * contato" — é outra coisa qualquer, e deve cair na regra do módulo. Se ele herdasse do
   * `/api/contatos` logo acima, pediria `contatos_criar`, que é uma permissão que não tem nada a
   * ver com o que está sendo feito. Peguei isso no teste.
   */
  const exatos = Object.keys(API_REGRA_FINA)
    .filter((padrao) => casaComPadrao(pathname, padrao))
    .sort((a, b) => b.length - a.length);
  if (exatos.length > 0) return API_REGRA_FINA[exatos[0]][campo] ?? null;

  /*
   * Sem regra exata, herda do endereço mais fundo que seja prefixo. É o que faz qualquer escrita
   * sob `/api/integracoes` pedir permissão de integração sem precisar listar as quarenta rotas —
   * e o "mais fundo primeiro" é o que impede `/api/integracoes/meta/whatsapp/enviar` de pedir
   * permissão de integração em vez de Responder.
   */
  const prefixos = Object.keys(API_REGRA_FINA)
    .filter((padrao) => pathname.startsWith(`${padrao}/`))
    .sort((a, b) => b.length - a.length);

  for (const chave of prefixos) {
    const exigida = API_REGRA_FINA[chave][campo];
    if (exigida) return exigida;
  }
  return null;
}

/**
 * A permissão que este endereço exige, ou `null` se ele é livre para qualquer pessoa logada.
 *
 * Casa por PREFIXO, e sempre pelo mais longo primeiro: sem isso `/api/integracoes/numeros` casaria
 * com `/api/integracoes` e também com uma entrada mais específica, e qual das duas valeria
 * dependeria da ordem em que o objeto foi escrito — o tipo de regra que funciona até alguém
 * reordenar o arquivo.
 */
export function permissaoDoEndereco(caminhoOuUrl: string): string | null {
  /* Só o caminho: quem chamar com `request.url` (ou com um endereço que já traz `?filtro=`) não
     pode receber "livre" por causa da query — seria um jeito trivial de contornar a tranca. */
  const pathname = caminhoOuUrl.split("?")[0].split("#")[0];

  if (!pathname.startsWith("/api")) {
    const rotaBase = "/" + pathname.split("/")[1];
    return ROTA_PERMISSAO[rotaBase] ?? null;
  }

  if (API_SEMPRE_LIBERADA.some((livre) => pathname === livre || pathname.startsWith(`${livre}/`))) {
    return null;
  }

  const candidatos = Object.keys(API_PERMISSAO)
    .filter((prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`))
    .sort((a, b) => b.length - a.length);

  return candidatos.length > 0 ? API_PERMISSAO[candidatos[0]] : null;
}
