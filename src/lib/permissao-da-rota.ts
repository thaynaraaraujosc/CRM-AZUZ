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
