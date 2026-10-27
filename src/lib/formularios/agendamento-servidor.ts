import { isoDeBrasilia } from "@/lib/agenda/fuso";
import { prisma } from "@/lib/prisma";
import type { Formulario, PerguntaFormulario } from "@/lib/formularios-context";
import { lerConfiguracao, type ConfiguracaoDaAgenda, type Intervalo } from "@/lib/formularios/agendamento";

/**
 * O lado do agendamento que precisa do banco: que horários já estão ocupados, e qual é a
 * configuração do campo.
 *
 * Separado do `agendamento.ts` de propósito. A conta de quais horários sobram é pura e tem teste
 * sem banco; o que mora aqui é só a leitura. Juntar os dois obrigaria a subir um MariaDB pra
 * provar que 09:00 de Brasília é 12:00 UTC.
 */

/** O primeiro campo de agendamento do formulário. Mais de um não faz sentido (seriam duas
 *  reuniões na mesma resposta) e o construtor não impede — então vale o primeiro. */
export function campoDeAgendamento(formulario: Pick<Formulario, "paginas">): PerguntaFormulario | null {
  for (const pagina of formulario.paginas ?? []) {
    for (const pergunta of pagina.perguntas ?? []) {
      if (pergunta.tipo === "agendamento" && !pergunta.oculta) return pergunta;
    }
  }
  return null;
}

/** A configuração da agenda desse formulário, já com os padrões preenchidos. */
export function agendaDoFormulario(formulario: Pick<Formulario, "paginas">): ConfiguracaoDaAgenda | null {
  const campo = campoDeAgendamento(formulario);
  return campo ? lerConfiguracao(campo.agenda) : null;
}

/**
 * Os compromissos que já ocupam a agenda do workspace, como instantes.
 *
 * O `Compromisso` guarda dia e hora LOCAIS (é o que a pessoa digita na Agenda), então a conversão
 * pra instante acontece aqui, uma vez, e o resto do caminho trabalha só com UTC.
 *
 * CANCELADO NÃO OCUPA: a reunião desmarcada devolve a vaga, e é o que a empresa espera ao
 * cancelar. Qualquer outro estado conta como ocupado — inclusive os que o produto ainda não tem,
 * porque errar pra mais aqui custa um horário a menos oferecido, e errar pra menos põe duas
 * pessoas na mesma chamada.
 *
 * `horaFim` costuma ser nulo nos compromissos criados pelo formulário; nesse caso vale a duração
 * configurada, que é o que aquela reunião de fato ocupa.
 */
export async function ocupadosDoWorkspace(params: {
  workspaceId: string;
  deDia: string;
  ateDia: string;
  duracaoPadrao: number;
}): Promise<Intervalo[]> {
  const linhas = await prisma.compromisso.findMany({
    where: {
      workspaceId: params.workspaceId,
      status: { not: "cancelado" },
      dataIso: { gte: params.deDia, lte: params.ateDia },
    },
    select: { dataIso: true, hora: true, horaFim: true },
  });

  const intervalos: Intervalo[] = [];
  for (const linha of linhas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(linha.dataIso) || !/^\d{2}:\d{2}$/.test(linha.hora)) continue;
    const inicio = isoDeBrasilia(linha.dataIso, linha.hora);
    const comeco = new Date(inicio);
    if (Number.isNaN(comeco.getTime())) continue;

    const fim =
      linha.horaFim && /^\d{2}:\d{2}$/.test(linha.horaFim)
        ? isoDeBrasilia(linha.dataIso, linha.horaFim)
        : new Date(comeco.getTime() + params.duracaoPadrao * 60 * 1000).toISOString();

    // Compromisso que atravessa a meia-noite ficaria com fim antes do início; nesse caso vale a
    // duração, que é o que dá pra afirmar sem inventar.
    intervalos.push(
      new Date(fim) > comeco
        ? { inicio, fim }
        : { inicio, fim: new Date(comeco.getTime() + params.duracaoPadrao * 60 * 1000).toISOString() },
    );
  }
  return intervalos;
}
