import { prisma } from "@/lib/prisma";
import { ehChaveDuplicada } from "@/lib/prisma-erros";

/**
 * A fila da confirmação de reunião, e o registro do que aconteceu com ela.
 *
 * NADA AQUI PODE DERRUBAR A ENTREGA DO LEAD. Tudo é chamado depois que o lead já está gravado, num
 * caminho que o Flow não repete: uma falha de banco aqui tem que virar aviso, nunca exceção. Vale
 * também pra tabela AUSENTE — o código sobe antes de alguém aplicar o schema em produção, e o lead
 * continua entrando enquanto isso.
 */

/**
 * O id da linha, derivado do telefone e do horário.
 *
 * Determinístico pela mesma razão que a chave única existe: duas entregas simultâneas da mesma
 * pessoa chegam aqui juntas, e quem perde a corrida bate na chave em vez de criar uma segunda
 * confirmação. 191 é o limite da coluna; telefone e timestamp são curtos e de tamanho conhecido.
 */
function idDaConfirmacao(workspaceId: string, telefone: string, inicio: Date): string {
  return `conf-${workspaceId}-${telefone}-${inicio.getTime()}`.slice(0, 190);
}

export type ResultadoDaFila =
  /** `id` vai junto nos dois casos de sucesso: é por ele que a ENTREGA guarda qual confirmação
   *  produziu, e é isso que permite ao Flow perguntar depois o que aconteceu com aquela resposta. */
  | { situacao: "enfileirada"; id: string }
  /** Já havia uma confirmação pra este número neste horário. Repetição do Flow, ou formulário
   *  preenchido de novo com a mesma reunião. Não é erro — e o `id` é o MESMO, porque ele é
   *  derivado do telefone e do horário, não da entrega. */
  | { situacao: "ja_existia"; id: string }
  | { situacao: "falhou"; aviso: string };

/**
 * Põe a confirmação na fila. O envio é de quem processa a fila, nunca daqui.
 *
 * A TRAVA É DO BANCO, não deste código: `@@unique([workspaceId, telefone, inicio])`. Conferir antes
 * com um `findFirst` não resolveria a corrida — duas chamadas simultâneas passariam as duas pela
 * conferência antes de qualquer uma gravar. Deixar o banco recusar é o que torna "uma vez só" uma
 * garantia em vez de uma intenção.
 */
export async function enfileirarConfirmacao(params: {
  workspaceId: string;
  /** Telefone normalizado (DDI + DDD + 9). Metade da trava. */
  telefone: string;
  /** Início da reunião, em UTC. A outra metade. */
  inicio: Date;
  contatoNome: string;
  conversaNome: string | null;
  /** Quando ela pode sair. Hoje é "agora"; a janela e o intervalo entram na etapa das proteções. */
  enviarApos: Date;
  /** O texto já montado, guardado porque "o que foi que o CRM mandou" é a primeira pergunta
   *  quando algo dá errado — e o modelo pode ter mudado desde então. */
  texto: string;
  /** A entrega do Flow que trouxe esta reunião. Guardada pra ele poder perguntar depois. */
  respostaId?: string | null;
}): Promise<ResultadoDaFila> {
  const id = idDaConfirmacao(params.workspaceId, params.telefone, params.inicio);
  try {
    await prisma.confirmacaoDeReuniao.create({
      data: {
        id,
        workspaceId: params.workspaceId,
        telefone: params.telefone,
        inicio: params.inicio,
        contatoNome: params.contatoNome,
        conversaNome: params.conversaNome,
        situacao: "na_fila",
        enviarApos: params.enviarApos,
        texto: params.texto,
        respostaId: params.respostaId ?? null,
      },
    });
    return { situacao: "enfileirada", id };
  } catch (erro) {
    // O id é derivado do telefone e do horário, então a linha que já existe é ESTA mesma — não
    // precisa de consulta pra saber qual é.
    if (ehChaveDuplicada(erro)) return { situacao: "ja_existia", id };
    console.error("[azuz-flow] confirmação não foi pra fila:", erro);
    return {
      situacao: "falhou",
      aviso: "A confirmação de reunião não pôde ser agendada; o lead entrou normalmente.",
    };
  }
}

/**
 * Escreve o que aconteceu DENTRO da conversa, como bolha de sistema.
 *
 * É onde quem atende vai olhar: a pergunta "o CRM avisou essa pessoa?" se responde abrindo a
 * conversa dela, não procurando num painel separado. A bolha de sistema já existe no CRM e já
 * aparece na linha do tempo do contato — não há tela nova pra construir.
 *
 * Id determinístico: a entrega repetida do Flow não escreve a mesma frase duas vezes.
 */
export async function anotarNaConversa(params: {
  workspaceId: string;
  conversaNome: string;
  contaCanal: string | null;
  /** O que diferencia esta anotação das outras da mesma reunião ("fila", "recusa"). */
  marca: string;
  telefone: string;
  inicio: Date;
  texto: string;
}): Promise<void> {
  const id = `${idDaConfirmacao(params.workspaceId, params.telefone, params.inicio)}-${params.marca}`.slice(0, 190);
  try {
    await prisma.mensagemExtra.create({
      data: {
        id,
        workspaceId: params.workspaceId,
        contato: params.conversaNome,
        tipo: "system",
        texto: params.texto,
        // Bolha de sistema não tem hora na tela: ela é um fato da conversa, não uma mensagem que
        // alguém mandou às 14h32.
        hora: "",
        criadoEm: new Date(),
        contaCanal: params.contaCanal,
      },
    });
  } catch (erro) {
    // Chave repetida aqui é o caso NORMAL da entrega repetida: a anotação já estava lá.
    if (ehChaveDuplicada(erro)) return;
    console.error("[azuz-flow] não deu pra anotar a confirmação na conversa:", erro);
  }
}
