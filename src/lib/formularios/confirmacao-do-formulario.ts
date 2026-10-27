import { prisma } from "@/lib/prisma";
import { slugId } from "@/lib/ids";
import { dataIsoEmBrasilia, horaEmBrasilia } from "@/lib/agenda/fuso";
import { ehChaveDuplicada } from "@/lib/prisma-erros";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { escolherCanalDoFlow } from "@/lib/integracoes/azuz-flow-canal";
import { configDoFlow } from "@/lib/integracoes/azuz-flow-config";
import { conexoesDeWhatsappDoWorkspace } from "@/lib/integracoes/azuz-flow-conexoes";
import { decidirConfirmacao } from "@/lib/integracoes/azuz-flow-confirmacao-decisao";
import { anotarNaConversa, enfileirarConfirmacao } from "@/lib/integracoes/azuz-flow-confirmacao-fila";
import { montarTextoDaConfirmacao } from "@/lib/integracoes/azuz-flow-confirmacao-texto";
import { quandoEnviar } from "@/lib/integracoes/azuz-flow-janela";
import { intervaloEntreEnvios } from "@/lib/campanhas/ritmo";
import type { LeadDaResposta } from "@/lib/formularios/lead-da-resposta";
import type { Formulario } from "@/lib/formularios-context";
import { horarioValido } from "@/lib/formularios/agendamento";
import { agendaDoFormulario, ocupadosDoWorkspace } from "@/lib/formularios/agendamento-servidor";
import { hojeEmBrasilia, somarDias } from "@/lib/agenda/fuso";

/**
 * O formulário DO CRM fazendo o que o formulário do AZUZ Flow já fazia: virar reunião na agenda e
 * confirmação no WhatsApp.
 *
 * Existe porque nem todo cliente usa o Flow. Quem usa só o formulário do CRM tinha a resposta
 * gravada, o contato criado e o card no funil — e nada mais: a reunião que a pessoa marcou não
 * aparecia na Agenda, e ninguém confirmava nada com ela.
 *
 * TUDO QUE JÁ EXISTE É REAPROVEITADO, e isso é a parte importante: a decisão (consentimento,
 * conversa, canal), o texto com as variáveis, a janela de horário, os tetos por dia e por número, o
 * disjuntor, o SAIR/PARAR e o envio pelo cron são os MESMOS do Flow. Elas protegem o NÚMERO da
 * agência, não a origem do lead — duas cópias protegeriam pela metade e divergiriam na primeira
 * correção feita só de um lado.
 *
 * O que muda por origem é só o TEXTO, que a agência escreve separado.
 *
 * NADA AQUI PODE DERRUBAR A RESPOSTA DO FORMULÁRIO. Quem respondeu já viu "enviado"; uma falha
 * daqui vira log, nunca erro na cara de quem preencheu.
 */
export async function confirmarReuniaoDoFormulario(params: {
  workspaceId: string;
  formularioNome: string;
  respostaId: string;
  /** As páginas do formulário, pra achar a configuração da agenda do campo "Agendar reunião". */
  paginas: Formulario["paginas"];
  lead: LeadDaResposta;
}): Promise<void> {
  const { workspaceId, lead } = params;
  if (!lead.reuniao || !lead.nome) return;

  /**
   * O HORÁRIO AINDA ESTÁ LIVRE?
   *
   * Conferido DE NOVO aqui, e não só quando a lista foi montada na tela: entre a pessoa escolher
   * e apertar enviar pode passar meia hora, e nesse tempo outra pessoa marca o mesmo horário.
   * Sem esta segunda conferência, duas pessoas ficam esperando na mesma chamada e ninguém
   * descobre até a hora.
   */
  if (!(await aindaEstaLivre(params))) {
    console.error(
      `[formularios] horário já ocupado quando a resposta ${params.respostaId} chegou; a reunião não foi marcada.`,
    );
    return;
  }

  const contato = await prisma.contato.findFirst({
    where: { workspaceId, nome: lead.nome },
    select: { id: true, nome: true },
  });

  /**
   * A REUNIÃO ENTRA NA AGENDA MESMO COM A CONFIRMAÇÃO DESLIGADA, e isso é deliberado.
   *
   * Antes o compromisso era criado depois do `if (!confirmacao.ativa) return`, então desligar a
   * mensagem automática desligava junto a marcação. Com os horários vindo da agenda, isso virou
   * defeito: sem compromisso, a vaga continua livre, e a próxima pessoa que abrir o formulário
   * recebe exatamente o mesmo horário.
   *
   * São duas coisas diferentes. "Não quero mandar mensagem sozinha" não é "não quero a reunião na
   * minha agenda".
   */
  await garantirCompromisso({ ...params, contatoId: contato?.id ?? null });

  // Daqui pra baixo é só a confirmação por WhatsApp, que precisa de número e de a empresa ter
  // ligado o aviso. Desligada é silêncio: foi uma escolha, não uma falha pra registrar em cada
  // resposta.
  if (!lead.whatsapp) return;

  const config = await configDoFlow(workspaceId);
  const confirmacao = config.formulario.confirmacao;
  if (!confirmacao.ativa) return;

  const conexoes = await conexoesDeWhatsappDoWorkspace(workspaceId);
  const escolha = escolherCanalDoFlow(config.canal, conexoes);

  // A conversa só nasce quando há canal. Sem ela não há por onde mandar — e `decidirConfirmacao`
  // diz isso com todas as letras, em vez de o lead sumir em silêncio.
  let conversaNome: string | null = null;
  if (escolha.conexao) {
    const jaExiste = await prisma.conversa.findUnique({
      where: { workspaceId_nome: { workspaceId, nome: lead.nome } },
      select: { nome: true, contaCanal: true },
    });
    await upsertConversaAoReceberMensagem({
      workspaceId,
      nome: lead.nome,
      canal: "WhatsApp",
      contato: lead.whatsapp,
      contatoId: contato?.id,
      origem: "Formulário",
      // Conversa que já existe mantém o dono dela: quem já fala com a empresa por outro número não
      // muda de dono por ter preenchido um formulário.
      contaCanal: jaExiste ? null : escolha.contaCanal,
      contarComoNaoLida: false,
    });
    conversaNome = lead.nome;
  }

  const donoDaConversa = conversaNome
    ? ((await prisma.conversa.findUnique({
        where: { workspaceId_nome: { workspaceId, nome: conversaNome } },
        select: { contaCanal: true },
      }))?.contaCanal ?? null)
    : null;

  const decisao = decidirConfirmacao({
    ativa: true,
    inicio: lead.reuniao,
    consentiu: lead.consentiu,
    telefone: lead.whatsapp,
    conversa: conversaNome ? { nome: conversaNome, canal: "WhatsApp", contaCanal: donoDaConversa } : null,
    agora: new Date(),
  });

  if (decisao.acao !== "enfileirar") {
    if (decisao.acao === "nao_enviar" && conversaNome) {
      await anotarNaConversa({
        workspaceId,
        conversaNome,
        contaCanal: escolha.contaCanal,
        marca: "recusa",
        telefone: lead.whatsapp,
        inicio: lead.reuniao,
        texto: decisao.motivo,
      });
    }
    return;
  }

  const quando = quandoEnviar({
    agora: new Date(),
    janela: config.confirmacao.janela,
    inicioDaReuniao: lead.reuniao,
    atrasoMs: intervaloEntreEnvios("whatsapp_nao_oficial"),
  });

  if (!quando.pode) {
    if (conversaNome) {
      await anotarNaConversa({
        workspaceId,
        conversaNome,
        contaCanal: escolha.contaCanal,
        marca: "recusa",
        telefone: lead.whatsapp,
        inicio: lead.reuniao,
        texto: quando.motivo,
      });
    }
    return;
  }

  const empresa = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { nome: true } });
  const texto = montarTextoDaConfirmacao(confirmacao.texto, {
    primeiroNome: lead.nome,
    inicio: lead.reuniao,
    // O formulário do CRM não tem link de reunião: a linha do `{{link}}`, sozinha, some inteira.
    link: null,
    empresa: empresa?.nome ?? "",
  });

  const resultado = await enfileirarConfirmacao({
    workspaceId,
    telefone: lead.whatsapp,
    inicio: lead.reuniao,
    contatoNome: lead.nome,
    conversaNome,
    texto,
    enviarApos: quando.enviarApos,
    respostaId: params.respostaId,
  });

  if (resultado.situacao === "enfileirada" && conversaNome) {
    await anotarNaConversa({
      workspaceId,
      conversaNome,
      contaCanal: escolha.contaCanal,
      marca: "fila",
      telefone: lead.whatsapp,
      inicio: lead.reuniao,
      texto: "Confirmação de reunião na fila para envio.",
    });
  }
}

/**
 * A reunião como dado na Agenda, não só como texto numa resposta.
 *
 * Id derivado da RESPOSTA: a mesma resposta reenviada não cria um segundo compromisso, e a chave
 * primária é quem garante isso — não um `if (já existe)`, que duas chamadas simultâneas passariam
 * juntas.
 */
async function garantirCompromisso(params: {
  workspaceId: string;
  formularioNome: string;
  respostaId: string;
  contatoId: string | null;
  lead: LeadDaResposta;
}): Promise<void> {
  const { workspaceId, lead } = params;
  if (!lead.reuniao || !lead.nome) return;

  try {
    await prisma.compromisso.create({
      data: {
        id: `formulario-reuniao-${workspaceId}-${slugId(params.respostaId)}`.slice(0, 180),
        workspaceId,
        contato: lead.nome,
        contatoId: params.contatoId,
        responsavel: "-",
        // Dia e hora LOCAIS: é o que a Agenda guarda (o que a pessoa digita lá), e o campo do
        // formulário já foi lido como horário de Brasília.
        dataIso: dataIsoEmBrasilia(lead.reuniao),
        hora: horaEmBrasilia(lead.reuniao),
        horaFim: null,
        tipo: "Reunião",
        descricao: `Agendada no formulário ${params.formularioNome}`,
        local: null,
        status: "agendado",
        origem: "formulario",
      },
    });
  } catch (erro) {
    if (!ehChaveDuplicada(erro)) {
      console.error("[formularios] não deu pra criar o compromisso da reunião:", erro);
    }
  }
}

/**
 * O horário escolhido continua livre na agenda do workspace?
 *
 * SEM CAMPO DE AGENDAMENTO NO FORMULÁRIO, nada a conferir: a reunião veio de um campo de data
 * comum, que nunca ofereceu horário nenhum, e recusá-la aqui tiraria um comportamento que já
 * existia.
 */
async function aindaEstaLivre(params: {
  workspaceId: string;
  paginas: Formulario["paginas"];
  lead: LeadDaResposta;
}): Promise<boolean> {
  const config = agendaDoFormulario({ paginas: params.paginas });
  if (!config || !params.lead.reuniao) return true;

  const agora = new Date();
  const hoje = hojeEmBrasilia(agora);
  const ocupados = await ocupadosDoWorkspace({
    workspaceId: params.workspaceId,
    deDia: hoje,
    ateDia: somarDias(hoje, config.janelaDias + 1),
    duracaoPadrao: config.duracao,
  });

  return horarioValido({ config, ocupados, inicio: params.lead.reuniao.toISOString(), agora }).ok;
}
