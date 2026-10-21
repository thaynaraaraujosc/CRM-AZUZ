import { CANAIS_DO_FLOW, escolherCanalDoFlow, type ConexoesDoWorkspace } from "@/lib/integracoes/azuz-flow-canal";
import type { ConfigDoFlow } from "@/lib/integracoes/azuz-flow-config";
import type { EstadoDoDisjuntor } from "@/lib/integracoes/azuz-flow-disjuntor";

/**
 * O corpo que a rota de opções do AZUZ Flow devolve — UM só, pro GET e pro PUT.
 *
 * Isto existe por causa de um defeito real, e o defeito foi culpa de a resposta ser montada em dois
 * lugares: o GET devolvia a configuração MAIS o estado (conexões, canal efetivo, aviso, disjuntor),
 * e o PUT devolvia só a configuração. A tela guarda o que a rota devolve, então salvar qualquer
 * opção substituía um objeto inteiro por um pela metade — e o render seguinte morria em
 * `canal.disjuntor.pausadoEm`, com a tela virando "Algo deu errado por aqui".
 *
 * A lição não é "ponha uma interrogação no acesso": é que uma rota tem UMA representação do
 * recurso. Quem responde com meio recurso obriga toda tela a adivinhar qual metade chegou.
 *
 * Puro de propósito: dá pra provar que as duas saídas têm a mesma forma sem subir servidor.
 */
export type RespostaDoFlow = ConfigDoFlow & {
  /** As opções do seletor, na ordem em que a tela deve mostrá-las. */
  opcoes: readonly string[];
  /** Quais conexões existem agora. Booleano: a tela não precisa do número. */
  conexoes: { oficial: boolean; qrcode: boolean };
  /**
   * A conexão que o PRÓXIMO lead vai usar de verdade.
   *
   * Não é a opção guardada: "Só oficial" com o oficial desconectado é um aviso, "Automático" com o
   * QR ligado não é. Quem decide é a mesma função que a entrega do lead usa, então a frase da tela
   * e o comportamento não têm como divergir.
   */
  conexaoEfetiva: "oficial" | "qrcode" | null;
  aviso: string | null;
  /** O que está acontecendo com o canal agora. Não é escolha da empresa. */
  disjuntor: EstadoDoDisjuntor;
};

export function montarRespostaDoFlow(params: {
  config: ConfigDoFlow;
  conexoes: ConexoesDoWorkspace;
  disjuntor: EstadoDoDisjuntor;
}): RespostaDoFlow {
  const escolha = escolherCanalDoFlow(params.config.canal, params.conexoes);
  return {
    ...params.config,
    opcoes: CANAIS_DO_FLOW,
    conexoes: { oficial: Boolean(params.conexoes.oficial), qrcode: Boolean(params.conexoes.qrcode) },
    conexaoEfetiva: escolha.conexao,
    aviso: escolha.aviso,
    disjuntor: params.disjuntor,
  };
}
