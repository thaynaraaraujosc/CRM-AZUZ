/**
 * O FUNIL QUE TODA CONTA NOVA JÁ NASCE COM.
 *
 * Conta nova nascia SEM funil nenhum. O cliente abria o CRM, ia em Funil e via uma tela branca;
 * ia em Automações e via "nenhum funil criado ainda"; e o pedaço do produto que mais importa —
 * saber onde cada lead está — dependia de ele adivinhar quais etapas inventar antes de usar
 * qualquer coisa. O primeiro contato com o produto virava um formulário em branco.
 *
 * As seis etapas são as que a Thaynara usa com os clientes dela, e são a esteira comum de
 * atendimento: o lead chega, é qualificado, é trabalhado, recebe proposta, fecha, e volta depois.
 * "Proposta" vem antes de "Fechado" porque é essa a ordem em que acontecem.
 *
 * NÃO É UMA JAULA: é um ponto de partida. Renomear, reordenar, apagar e criar etapa continuam
 * valendo igual, e quem não quiser nada disso apaga em dois cliques. O que não dá pra fazer é
 * começar do zero sem saber que começar do zero era uma opção.
 *
 * A cor sai da paleta fechada de `etapa-aparencia.ts` — nenhuma cor inventada aqui.
 */

export const NOME_DO_FUNIL_PADRAO = "Funil comercial";

export const ETAPAS_DO_FUNIL_PADRAO: { titulo: string; cor: string }[] = [
  { titulo: "Novo lead", cor: "#d6eaff" },
  { titulo: "Qualificado", cor: "#c1e0ff" },
  { titulo: "Follow-up", cor: "#ffeab2" },
  { titulo: "Proposta", cor: "#f9deff" },
  { titulo: "Fechado", cor: "#ebffb1" },
  { titulo: "Retorno", cor: "#f2f3f4" },
];

export type FunilPadrao = {
  id: string;
  nome: string;
  etapas: { id: string; titulo: string; cor: string; ordem: number }[];
};

/**
 * O funil padrão com ids derivados do workspace.
 *
 * Os ids são ESTÁVEIS e previsíveis (`<workspace>-funil`, `<workspace>-etapa-1`…), e não
 * aleatórios, por dois motivos: criar duas vezes falha em vez de duplicar silenciosamente, e dá
 * pra reconhecer de onde veio a etapa olhando o banco.
 */
export function montarFunilPadrao(workspaceId: string): FunilPadrao {
  return {
    id: `${workspaceId}-funil`,
    nome: NOME_DO_FUNIL_PADRAO,
    etapas: ETAPAS_DO_FUNIL_PADRAO.map((e, ordem) => ({
      id: `${workspaceId}-etapa-${ordem + 1}`,
      titulo: e.titulo,
      cor: e.cor,
      ordem,
    })),
  };
}
