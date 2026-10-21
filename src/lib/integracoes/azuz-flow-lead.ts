import { prisma } from "@/lib/prisma";
import { aoCriarContato } from "@/lib/automacoes/gatilhos-crm";
import { dispararAutomacoesDoCrm } from "@/lib/automation-flow/disparar-no-servidor";
import { encontrarContatoPorTelefone } from "@/lib/contatos/upsert";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import {
  entrarNaPrimeiraEtapaComoNovoLead,
  subirCardParaOTopo,
} from "@/lib/funis/upsert";
import {
  escolherCanalDoFlow,
  type ConexoesDoWorkspace,
} from "@/lib/integracoes/azuz-flow-canal";
import {
  configDoFlow,
  type ConfigDoFlow,
} from "@/lib/integracoes/azuz-flow-config";
import { decidirConfirmacao } from "@/lib/integracoes/azuz-flow-confirmacao-decisao";
import { quandoEnviar } from "@/lib/integracoes/azuz-flow-janela";
import { montarTextoDaConfirmacao } from "@/lib/integracoes/azuz-flow-confirmacao-texto";
import {
  anotarNaConversa,
  enfileirarConfirmacao,
  type ResultadoDaFila,
} from "@/lib/integracoes/azuz-flow-confirmacao-fila";
import { conexoesDeWhatsappDoWorkspace } from "@/lib/integracoes/azuz-flow-conexoes";
import { intervaloEntreEnvios } from "@/lib/campanhas/ritmo";
import { anotarNaLinhaDoTempo } from "@/lib/integracoes/instagram-eventos";
import { slugId } from "@/lib/ids";
import { normalizarTelefoneParaComparacao } from "@/lib/telefone";
import { ehChaveDuplicada } from "@/lib/prisma-erros";
import { dataIsoEmBrasilia, horaEmBrasilia } from "@/lib/agenda/fuso";
import type { LeadDoFlow, ReuniaoDoFlow } from "./azuz-flow-payload";

export const ORIGEM_FLOW = "azuz_flow";

export type ResultadoDoLead = {
  ok: true;
  criado: boolean;
  duplicado: boolean;
  contatoId: string | null;
  conversaId: string | null;
  etapa: { funil: string; etapa: string } | null;
  whatsappOficialConectado: boolean;
  avisos: string[];
};

/**
 * Tudo que fala com o banco ou com a Meta, num objeto só.
 *
 * Existe pra o teste poder exercitar a ORDEM e as decisões sem banco nenhum — e a ordem é o que
 * mais importa aqui: a automação que manda o modelo só funciona se a conversa já existir quando
 * ela dispara, e isso é invisível em qualquer teste que mocke no nível errado.
 */
export type DependenciasDoFlow = {
  acharEntregaAnterior: (chave: string) => Promise<ResultadoDoLead | null>;
  gravarEntrega: (params: {
    chave: string;
    contatoId: string | null;
    conversaId: string | null;
    resultado: ResultadoDoLead;
  }) => Promise<void>;

  acharContatoPorTelefone: (
    telefone: string,
  ) => Promise<{ id: string; nome: string } | null>;
  acharContatoPorEmail: (
    email: string,
  ) => Promise<{ id: string; nome: string } | null>;
  nomeOcupado: (nome: string) => Promise<boolean>;
  lerContato: (nome: string) => Promise<Record<string, unknown> | null>;

  criarContato: (
    dados: Record<string, unknown> & { nome: string },
  ) => Promise<{ id: string; nome: string }>;
  atualizarContato: (
    nome: string,
    dados: Record<string, unknown>,
  ) => Promise<void>;

  anotarNaLinhaDoTempo: (params: {
    contatoNome: string;
    descricao: string;
  }) => Promise<void>;

  /** Idempotente por definição: repetir a mesma entrega não cria um segundo compromisso. */
  garantirCompromisso: (params: {
    chaveDaEntrega: string;
    contatoId: string;
    contatoNome: string;
    formularioNome: string;
    reuniao: ReuniaoDoFlow;
  }) => Promise<void>;

  /**
   * As conexões de WhatsApp ligadas agora, por identificador.
   *
   * Substituiu `contaOficial`, que só sabia responder sobre o canal oficial — e era por isso que o
   * lead entrava sem conversa toda vez que ele estivesse fora, mesmo com o QR Code conectado.
   */
  conexoesDeWhatsapp: () => Promise<ConexoesDoWorkspace>;
  /** As opções desta empresa: canal e confirmação. Ver `azuz-flow-config.ts`. */
  config: () => Promise<ConfigDoFlow>;
  /** O nome da empresa, pra mensagem dizer de onde a pessoa veio. */
  nomeDaEmpresa: () => Promise<string>;
  /** Põe a confirmação na fila. Quem envia é quem processa a fila, nunca a entrega do lead. */
  enfileirarConfirmacao: (params: {
    telefone: string;
    inicio: Date;
    contatoNome: string;
    conversaNome: string | null;
    texto: string;
    enviarApos: Date;
  }) => Promise<ResultadoDaFila>;
  /**
   * O atraso aleatório antes do envio, em milissegundos.
   *
   * Entra por dependência, e não é sorteado dentro da regra, porque função que sorteia não se
   * testa. Quem decide o valor é `intervaloEntreEnvios` em `ritmo.ts`, onde a variação do canal
   * não oficial já estava escrita com o porquê ao lado.
   */
  atrasoDoEnvio: () => number;
  /** Escreve o que aconteceu com a confirmação dentro da conversa, como bolha de sistema. */
  anotarNaConversa: (params: {
    conversaNome: string;
    contaCanal: string | null;
    marca: string;
    telefone: string;
    inicio: Date;
    texto: string;
  }) => Promise<void>;
  /**
   * A conversa que este contato já tem, se tiver.
   *
   * Existe pra o lead NÃO ROUBAR uma conversa que já é de outro canal. `upsertConversaAoReceber-
   * Mensagem` sobrescreve `contaCanal` quando recebe um, de propósito (é assim que conversa antiga
   * ganha dono). Aqui isso seria um estrago: alguém que já fala com a empresa pelo Instagram ou
   * pelo número oficial preencheria um formulário e veria a conversa mudar de canal embaixo dela.
   */
  conversaDoContato: (
    nome: string,
  ) => Promise<{ id: string; canal: string; contaCanal: string | null } | null>;
  garantirConversa: (params: {
    nome: string;
    telefone: string;
    contatoId: string;
    contaCanal: string | null;
  }) => Promise<{ id: string } | null>;

  temCardNoFunil: (contatoNome: string) => Promise<boolean>;
  entrarNoFunil: (params: {
    contatoNome: string;
    contaCanal: string | null;
  }) => Promise<{ funil: string; etapa: string } | null>;
  subirCard: (contatoNome: string) => Promise<void>;

  avisarContatoCriado: (params: {
    contatoNome: string;
    contatoId: string;
  }) => void;
  dispararAutomacoes: (params: {
    contatoNome: string;
    chaveEvento: string;
  }) => Promise<void>;
};

/**
 * O banco recusou por chave repetida (`P2002`).
 *
 * Isto não é um caso raro de laboratório: um formulário que publica em dois canais entrega dois
 * leads no mesmo segundo, e o id do contato é derivado do NOME (`workspaceId-slug(nome)`). Os dois
 * pedidos perguntam "esse nome está livre?" antes de qualquer um gravar, os dois ouvem "está", e o
 * segundo `create` bate na chave primária.
 *
 * Mora em `@/lib/prisma-erros` agora, porque o funil e as automações precisam da mesma pergunta.
 * Continua exportado daqui pra não quebrar quem já importava.
 */
export { ehChaveDuplicada } from "@/lib/prisma-erros";

/** Etiqueta que as automações usam pra filtrar de qual formulário o lead veio. É o que permite um
 *  fluxo por formulário sem inventar um tipo de gatilho novo pra cada um. */
export function etiquetaDoFormulario(formularioNome: string): string {
  return `Flow: ${formularioNome}`;
}

function etiquetasAtuais(contato: Record<string, unknown> | null): string[] {
  const valor = contato?.etiquetas;
  return Array.isArray(valor)
    ? valor.filter((e): e is string => typeof e === "string")
    : [];
}

/**
 * Entrega um lead do Flow no CRM.
 *
 * A ORDEM É O CONTRATO, não uma preferência de estilo: contato, conversa e card primeiro, e só
 * então a automação. `enviarModeloOficial` só manda mensagem se já existe uma `Conversa` do
 * contato — disparar antes significa uma automação que falha em silêncio dizendo "conversa não
 * encontrada", que é o defeito que esta função existe pra não ter.
 */
export async function receberLeadDoFlow(params: {
  workspaceId: string;
  lead: LeadDoFlow;
  deps: DependenciasDoFlow;
}): Promise<ResultadoDoLead> {
  const { lead, deps } = params;

  // 1. Idempotência. O Flow repete quando a rede falha; repetir não pode criar um segundo lead.
  const anterior = await deps.acharEntregaAnterior(lead.respostaId);
  if (anterior) return { ...anterior, duplicado: true };

  const avisos = [...lead.avisos];

  /*
   * ACHAR, DECIDIR O NOME E GRAVAR — tudo junto, porque tudo isso pode precisar ser refeito.
   *
   * Entre a pergunta "esse nome está livre?" e o `create` existe uma janela, e ela não é teórica:
   * um formulário publicado em dois canais entrega dois leads no mesmo segundo. Os dois perguntam,
   * os dois ouvem "está livre", e o segundo `create` bate na chave primária (o id do contato sai do
   * nome). Antes isso virava 500, e só se resolvia porque o Flow repetia a entrega um minuto
   * depois.
   *
   * A correção não é travar o banco: é REFAZER a decisão. Na passada seguinte o contato do
   * concorrente já existe, e aí as mesmas regras de sempre resolvem sozinhas — mesmo telefone cai
   * no caminho de completar, telefone diferente encontra o nome ocupado e usa o sufixo. Nenhuma
   * regra nova, só a chance de olhar de novo.
   *
   * ATÉ TRÊS PASSADAS, e o teste com banco de verdade (14/10/2026) mostrou por quê: com UMA
   * repetição, três pessoas homônimas chegando juntas falhavam em 25 de 25 rodadas. As três
   * perguntam pelo nome base, uma vence; as outras duas repetem, as duas acham o base ocupado, as
   * duas escolhem o MESMO nome com sufixo do formulário, e a perdedora dessa segunda corrida não
   * tinha mais passada nenhuma — virava 500.
   *
   * Três passadas bastam pra qualquer número de chamadas simultâneas porque a terceira não disputa
   * nada: ela usa o id da entrega, que é único por definição. Não é um laço "tenta até dar" — é um
   * degrau por forma de nome, e as formas acabam.
   */
  const MAXIMO_DE_PASSADAS = 3;

  async function resolverEGravarContato(tentativa: number): Promise<{
    contatoId: string;
    nomeDoContato: string;
    criado: boolean;
  }> {
    // 2. Achar a pessoa: telefone primeiro (é a chave mais confiável), e-mail depois.
    let existente: { id: string; nome: string } | null = null;
    if (lead.whatsapp)
      existente = await deps.acharContatoPorTelefone(lead.whatsapp);
    if (!existente && lead.email)
      existente = await deps.acharContatoPorEmail(lead.email);

    /*
     * O NOME, quando o contato é novo.
     *
     * Duas pessoas diferentes com o mesmo nome não podem virar uma só: o nome é a chave do contato,
     * e fundir é irreversível — o histórico de uma passa a ser o da outra. Então, nome ocupado por
     * OUTRA pessoa, acrescenta o sufixo do formulário. Feio, e muito melhor do que perder um
     * cliente dentro do cadastro de outro.
     */
    const comFormulario =
      `${lead.nomeDoContato} (${lead.formularioNome})`.slice(0, 120);
    const comEntrega =
      `${lead.nomeDoContato} (${lead.respostaId.slice(-6)})`.slice(0, 120);

    let nomeDoContato = existente?.nome ?? lead.nomeDoContato;
    if (!existente && (await deps.nomeOcupado(nomeDoContato))) {
      // Na ÚLTIMA passada vai direto pro nome da entrega, sem passar pelo do formulário: já se sabe
      // que o do formulário está sendo disputado (foi ele que falhou na passada anterior), e perder
      // a última chance nele deixaria o lead sem onde entrar.
      if (tentativa >= MAXIMO_DE_PASSADAS - 1) {
        nomeDoContato = comEntrega;
      } else {
        nomeDoContato = comFormulario;
        // Ainda ocupado (o mesmo formulário já trouxe um homônimo): desempata pelo id da entrega,
        // que é único por definição.
        if (await deps.nomeOcupado(nomeDoContato)) nomeDoContato = comEntrega;
      }
      avisos.push(
        `Já havia outro contato chamado "${lead.nomeDoContato}", então este entrou como "${nomeDoContato}".`,
      );
    }

    const contatoAtual = existente
      ? await deps.lerContato(nomeDoContato)
      : null;
    const etiquetas = new Set(etiquetasAtuais(contatoAtual));
    etiquetas.add(etiquetaDoFormulario(lead.formularioNome));
    if (lead.consentimentoWhatsApp) etiquetas.add("WhatsApp: consentiu");

    const consentimento = decidirConsentimento({
      novo: !existente,
      jaGravado: contatoAtual?.consentimentoWhatsApp as
        | boolean
        | null
        | undefined,
      aceitou: lead.consentimentoWhatsApp,
      texto: lead.consentimentoTexto,
      em: lead.consentimentoEm ?? lead.recebidaEm ?? new Date(),
      origem: `azuz-flow:${lead.formularioNome}`,
    });

    // 3. Criar ou completar. Em contato existente só entra o que está VAZIO: o CRM é a fonte da
    //    verdade sobre quem já é cliente, e um formulário preenchido às pressas não pode
    //    sobrescrever o telefone que a equipe confirmou por telefone.
    if (existente) {
      const completar: Record<string, unknown> = {
        etiquetas: [...etiquetas],
        ...consentimento,
      };
      for (const [campo, valor] of camposDoLead(lead)) {
        if (valor && !contatoAtual?.[campo]) completar[campo] = valor;
      }
      await deps.atualizarContato(nomeDoContato, completar);
      return { contatoId: existente.id, nomeDoContato, criado: false };
    }

    try {
      const novo = await deps.criarContato({
        nome: nomeDoContato,
        origem: `Formulário: ${lead.formularioNome}`,
        criadoVia: "azuz-flow",
        etapa: "Novo",
        etiquetas: [...etiquetas],
        ...Object.fromEntries(
          camposDoLead(lead).filter(([, valor]) => Boolean(valor)),
        ),
        ...consentimento,
      });
      return { contatoId: novo.id, nomeDoContato, criado: true };
    } catch (erro) {
      // Outro pedido criou este nome entre a conferência e agora. Repete a DECISÃO, não o `create`:
      // na passada seguinte o concorrente já existe e as regras normais resolvem. O limite existe
      // pra um defeito de verdade não ficar escondido atrás de um laço.
      if (ehChaveDuplicada(erro) && tentativa + 1 < MAXIMO_DE_PASSADAS) {
        // O aviso de homônimo da passada anterior não vale mais: a decisão vai ser refeita do zero.
        avisos.length = lead.avisos.length;
        return resolverEGravarContato(tentativa + 1);
      }
      throw erro;
    }
  }

  const { contatoId, nomeDoContato, criado } = await resolverEGravarContato(0);

  // 4. Linha do tempo: o que a pessoa respondeu, por extenso. É o que o vendedor lê antes de falar
  //    com ela, e é a única cópia dessas respostas dentro do CRM.
  const corpo = lead.respostas
    .map((r) => `${r.pergunta}: ${r.resposta}`)
    .join(" · ");
  await deps
    .anotarNaLinhaDoTempo({
      contatoNome: nomeDoContato,
      descricao: `Respondeu o formulário ${lead.formularioNome}${corpo ? ` — ${corpo}` : ""}`,
    })
    .catch(() => {});

  /*
   * 5. A REUNIÃO, como dado na Agenda.
   *
   * Antes disso ela só existia como frase na linha do tempo, que ninguém consegue consultar: não
   * aparece na Agenda, não vira lembrete e não dá pra pôr num modelo. Como `Compromisso` ela é um
   * registro com dia e hora.
   *
   * Vem ANTES das automações de propósito, porque as variáveis `reuniao.*` são lidas do banco na
   * hora do envio. Gravar depois mandaria "sua reunião é dia " — a automação já teria rodado.
   *
   * Falhar aqui NÃO derruba o lead: o nome e o WhatsApp da pessoa valem mais do que o compromisso,
   * e devolver erro faria o Flow repetir uma entrega que, no essencial, deu certo. Fica o aviso na
   * resposta e o registro no log (só ids, nunca o conteúdo do lead).
   */
  if (lead.reuniao) {
    try {
      await deps.garantirCompromisso({
        chaveDaEntrega: lead.respostaId,
        contatoId,
        contatoNome: nomeDoContato,
        formularioNome: lead.formularioNome,
        reuniao: lead.reuniao,
      });
    } catch (erro) {
      avisos.push(
        "A reunião não pôde ser gravada na Agenda; o lead entrou sem compromisso.",
      );
      console.error("[azuz-flow] compromisso não gravado:", {
        contatoId,
        erro,
      });
    }
  }

  // 6. Conversa. Ela nasce VAZIA e com zero não lidas: existe pra a automação ter por onde falar,
  //    não porque alguém escreveu. Contar como não lida poria um badge vermelho numa conversa em
  //    que ninguém disse nada.
  const conexoes = await deps.conexoesDeWhatsapp();
  const whatsappOficialConectado = Boolean(conexoes.oficial);
  /*
   * O pedido do FORMULÁRIO manda sobre a opção da empresa — e não tem plano B. Ver
   * `escolherCanalDoFlow`.
   */
  const config = await deps.config();
  const escolha = escolherCanalDoFlow(
    config.canal,
    conexoes,
    lead.canalWhatsApp,
  );
  const contaCanal = escolha.contaCanal;

  let conversaId: string | null = null;
  /** O canal da conversa onde a confirmação sairia. `null` quando não há conversa. */
  let canalDaConversa: string | null = null;
  /** A CONEXÃO dona dela. Separa "WhatsApp pelo QR" de "WhatsApp oficial", que têm o mesmo canal. */
  let donoDaConversa: string | null = null;

  if (lead.whatsapp) {
    /*
     * Conversa que já existe é REAPROVEITADA, nunca reivindicada.
     *
     * A diferença está no `contaCanal` que vai (ou não) pro upsert: num registro novo ele diz de
     * quem é a conversa; num que já existe, ele TROCARIA o dono. Mandar `null` aqui é o que faz
     * quem já fala com a empresa por outro canal continuar falando por lá depois de preencher um
     * formulário. O resto do upsert continua valendo, inclusive o conserto do `contatoId` em
     * conversa antiga.
     */
    const jaExiste = await deps.conversaDoContato(nomeDoContato);
    if (jaExiste || contaCanal) {
      const conversa = await deps.garantirConversa({
        nome: nomeDoContato,
        telefone: lead.whatsapp,
        contatoId,
        contaCanal: jaExiste ? null : contaCanal,
      });
      conversaId = conversa?.id ?? jaExiste?.id ?? null;
      // Conversa nova nasce de WhatsApp; a que já existia pode ser de qualquer canal. Quem decide o
      // que fazer com isso é `decidirConfirmacao`, pra a frase existir num lugar só.
      canalDaConversa = jaExiste?.canal ?? "WhatsApp";
      // E de QUEM ela é. A conversa que já existia mantém o dono dela (o upsert recebeu `null`); a
      // nova nasce com o `contaCanal` que a escolha de canal produziu.
      donoDaConversa = jaExiste?.contaCanal ?? contaCanal;
    } else if (escolha.aviso) {
      avisos.push(escolha.aviso);
    }
  }

  /*
   * 6b. A CONFIRMAÇÃO DE REUNIÃO.
   *
   * Decidir e enfileirar, nunca enviar daqui. Enviar neste ponto seria uma chamada de rede dentro
   * da entrega de um lead: ela atrasaria a resposta ao Flow, e uma falha dela viraria um 500 que
   * faz o Flow repetir uma entrega que já deu certo. A fila separa as duas coisas.
   *
   * Tudo que acontece aqui é relatado em DOIS lugares, e os dois importam: `avisos`, que o Flow
   * mostra na tela de Respostas de quem publicou o formulário, e uma bolha de sistema dentro da
   * conversa, que é onde quem atende vai olhar. Falha silenciosa aqui é uma pessoa esperando uma
   * mensagem que nunca foi mandada.
   */
  if (lead.reuniao) {
    const decisao = decidirConfirmacao({
      ativa: config.confirmacao.ativa,
      inicio: lead.reuniao.inicio,
      consentiu: lead.consentimentoWhatsApp,
      telefone: lead.whatsapp,
      conversa:
        conversaId && canalDaConversa
          ? { nome: nomeDoContato, canal: canalDaConversa, contaCanal: donoDaConversa }
          : null,
      agora: new Date(),
    });

    if (decisao.acao === "nao_enviar") {
      avisos.push(decisao.motivo);
      if (conversaId) {
        await deps.anotarNaConversa({
          conversaNome: nomeDoContato,
          contaCanal,
          marca: "recusa",
          telefone: lead.whatsapp ?? nomeDoContato,
          inicio: lead.reuniao.inicio,
          texto: decisao.motivo,
        });
      }
    } else if (decisao.acao === "enfileirar" && lead.whatsapp) {
      /*
       * QUANDO ela pode sair — e isto pode virar uma recusa.
       *
       * Fora da janela, a fila espera abrir. Mas quando a janela só abriria depois do início da
       * reunião, não existe hora boa: enfileirar seria prometer uma mensagem que chegaria depois
       * de a pessoa já ter entrado na reunião, e ficaria na fila parecendo resolvido.
       */
      const quando = quandoEnviar({
        agora: new Date(),
        janela: config.confirmacao.janela,
        inicioDaReuniao: lead.reuniao.inicio,
        atrasoMs: deps.atrasoDoEnvio(),
      });

      if (!quando.pode) {
        avisos.push(quando.motivo);
        if (conversaId) {
          await deps.anotarNaConversa({
            conversaNome: nomeDoContato,
            contaCanal,
            marca: "recusa",
            telefone: lead.whatsapp,
            inicio: lead.reuniao.inicio,
            texto: quando.motivo,
          });
        }
      } else {
        const texto = montarTextoDaConfirmacao(config.confirmacao.texto, {
          primeiroNome: lead.nome ?? nomeDoContato,
          inicio: lead.reuniao.inicio,
          link: lead.reuniao.link,
          empresa: await deps.nomeDaEmpresa(),
        });
        const resultado = await deps.enfileirarConfirmacao({
          telefone: lead.whatsapp,
          inicio: lead.reuniao.inicio,
          contatoNome: nomeDoContato,
          conversaNome: nomeDoContato,
          texto,
          enviarApos: quando.enviarApos,
        });

        if (resultado.situacao === "falhou") {
          avisos.push(resultado.aviso);
        } else if (resultado.situacao === "enfileirada") {
          const frase = "Confirmação de reunião na fila para envio.";
          avisos.push(frase);
          await deps.anotarNaConversa({
            conversaNome: nomeDoContato,
            contaCanal,
            marca: "fila",
            telefone: lead.whatsapp,
            inicio: lead.reuniao.inicio,
            texto: frase,
          });
        }
        // `ja_existia` é silêncio de propósito: é a entrega repetida do Flow, ou a mesma pessoa
        // preenchendo o formulário de novo com a mesma reunião. Nada aconteceu de novo pra contar.
      }
    }
  }

  // 7. Funil. Quem já está no funil NÃO muda de etapa: o vendedor pôs a pessoa onde ela está, e um
  //    formulário novo não é motivo pra jogá-la de volta pro começo. Só sobe pro topo.
  let etapa: { funil: string; etapa: string } | null = null;
  if (await deps.temCardNoFunil(nomeDoContato)) {
    await deps.subirCard(nomeDoContato);
  } else {
    etapa = await deps.entrarNoFunil({
      contatoNome: nomeDoContato,
      contaCanal,
    });
  }

  const resultado: ResultadoDoLead = {
    ok: true,
    criado,
    duplicado: false,
    contatoId,
    conversaId,
    etapa,
    whatsappOficialConectado,
    avisos,
  };

  /*
   * 8. Marca a entrega como feita ANTES de disparar automação: se o processo morrer entre uma coisa
   *    e outra, a repetição do Flow não cria tudo de novo. Automação perdida é um lead sem
   *    mensagem; entrega não registrada é um lead duplicado, com duas mensagens.
   *
   *    DUAS CHAMADAS SIMULTÂNEAS COM A MESMA ENTREGA chegam aqui juntas: as duas passaram pela
   *    conferência de idempotência antes de qualquer uma gravar. Uma vence, a outra bate na chave
   *    única — e isso é a resposta, não um erro. Ela devolve o resultado que a vencedora guardou,
   *    como qualquer repetição. Devolver 500 faria o Flow repetir uma entrega que já deu certo.
   */
  try {
    await deps.gravarEntrega({
      chave: lead.respostaId,
      contatoId,
      conversaId,
      resultado,
    });
  } catch (erro) {
    if (!ehChaveDuplicada(erro)) throw erro;
    const guardado = await deps.acharEntregaAnterior(lead.respostaId);
    // Sem o registro da vencedora não há o que devolver: aí o erro é de verdade e sobe.
    if (!guardado) throw erro;
    return { ...guardado, duplicado: true };
  }

  // 9. Por último, com tudo gravado. Falha aqui não derruba a resposta: o lead já está no CRM, e
  //    devolver erro faria o Flow repetir uma entrega que deu certo.
  if (criado)
    deps.avisarContatoCriado({ contatoNome: nomeDoContato, contatoId });
  await deps
    .dispararAutomacoes({
      contatoNome: nomeDoContato,
      chaveEvento: `flow:${lead.respostaId}`,
    })
    .catch((erro) =>
      console.error(
        "[azuz-flow] automações falharam depois do lead gravado:",
        erro,
      ),
    );

  return resultado;
}

/** Os campos do lead que viram colunas do contato. Fora daqui nada é escrito. */
function camposDoLead(lead: LeadDoFlow): [string, string | null][] {
  return [
    ["email", lead.email],
    ["whatsapp", lead.whatsapp],
    ["sobrenome", lead.sobrenome],
    ["empresa", lead.empresa],
    ["cargo", lead.cargo],
    ["cidade", lead.cidade],
    ["estado", lead.estado],
    ["pais", lead.pais],
    ["endereco", lead.endereco],
  ];
}

/**
 * O que gravar de consentimento.
 *
 * `aceitou: false` NÃO revoga um `true` anterior, e essa é a regra que mais importa: a ausência de
 * uma caixa marcada num formulário qualquer não é a pessoa dizendo "pare de me mandar mensagem".
 * Ela pode ter consentido noutro formulário, ou por escrito. Revogação é um gesto explícito e não
 * passa por aqui.
 */
export function decidirConsentimento(params: {
  novo: boolean;
  jaGravado: boolean | null | undefined;
  aceitou: boolean;
  texto: string | null;
  em: Date;
  origem: string;
}): Record<string, unknown> {
  const gravar = {
    consentimentoWhatsApp: true,
    consentimentoWhatsAppEm: params.em,
    consentimentoWhatsAppTexto: params.texto,
    consentimentoWhatsAppOrigem: params.origem,
  };

  if (params.aceitou) return gravar;
  // Recusou agora, mas já havia consentido antes: nada muda.
  if (params.jaGravado === true) return {};
  return { ...gravar, consentimentoWhatsApp: false };
}

/** As dependências de verdade, ligadas no banco e na Meta. */
export function dependenciasReais(workspaceId: string): DependenciasDoFlow {
  return {
    async acharEntregaAnterior(chave) {
      const linha = await prisma.leadRecebido.findUnique({
        where: {
          workspaceId_origem_chaveExterna: {
            workspaceId,
            origem: ORIGEM_FLOW,
            chaveExterna: chave,
          },
        },
        select: { resultado: true },
      });
      return (linha?.resultado as ResultadoDoLead | undefined) ?? null;
    },
    async gravarEntrega({ chave, contatoId, conversaId, resultado }) {
      await prisma.leadRecebido.create({
        data: {
          workspaceId,
          origem: ORIGEM_FLOW,
          chaveExterna: chave,
          contatoId,
          conversaId,
          resultado: resultado as unknown as object,
        },
      });
    },

    async acharContatoPorTelefone(telefone) {
      const achado = await encontrarContatoPorTelefone(workspaceId, telefone);
      return achado ? { id: achado.id, nome: achado.nome } : null;
    },
    async acharContatoPorEmail(email) {
      // `email` é gravado como veio; a comparação é em memória porque o conjunto por workspace é
      // pequeno e MySQL com collation sensível a caixa deixaria passar o mesmo e-mail com outra
      // grafia — que é justamente a duplicata que se quer evitar.
      const candidatos = await prisma.contato.findMany({
        where: { workspaceId, email: { not: null } },
        select: { id: true, nome: true, email: true },
      });
      const alvo = email.toLowerCase();
      const achado = candidatos.find((c) => c.email?.toLowerCase() === alvo);
      return achado ? { id: achado.id, nome: achado.nome } : null;
    },
    async nomeOcupado(nome) {
      const achado = await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
        select: { id: true },
      });
      return Boolean(achado);
    },
    async lerContato(nome) {
      return (await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
      })) as Record<string, unknown> | null;
    },

    async criarContato(dados) {
      const { nome, ...resto } = dados;
      const criado = await prisma.contato.create({
        data: {
          id: `${workspaceId}-${slugId(nome)}`,
          workspaceId,
          initials: iniciaisDe(nome),
          nome,
          origem: (resto.origem as string) ?? "Formulário",
          etapa: (resto.etapa as string) ?? "Novo",
          responsavel: "-",
          ultima: "Agora",
          valor: "-",
          ...(resto as object),
        },
      });
      return { id: criado.id, nome: criado.nome };
    },
    async atualizarContato(nome, dados) {
      await prisma.contato.update({
        where: { workspaceId_nome: { workspaceId, nome } },
        data: dados,
      });
    },

    async anotarNaLinhaDoTempo({ contatoNome, descricao }) {
      await anotarNaLinhaDoTempo({
        workspaceId,
        contatoNome,
        canal: "CRM",
        tipo: "formulario_respondido",
        descricao,
      });
    },

    /*
     * O ID DO COMPROMISSO É DERIVADO DA ENTREGA, e é isso que dá a idempotência.
     *
     * `Compromisso.id` é chave primária. Com um id que sai do `respostaId`, a repetição do Flow e
     * duas chamadas simultâneas com a mesma entrega colidem no banco: o segundo `create` recebe
     * `P2002` e a gente trata isso como "já está gravado", porque é o que é. Não precisou de índice
     * novo nem de transação — e a regra do projeto é mudança de banco só aditiva.
     *
     * O `slugId` entra porque o `respostaId` vem de fora e pode ter caractere que não se quer numa
     * chave primária. O corte em 180 respeita o varchar(191) que o Prisma usa pra `String @id`.
     */
    async garantirCompromisso({
      chaveDaEntrega,
      contatoId,
      contatoNome,
      formularioNome,
      reuniao,
    }) {
      const id = `flow-reuniao-${workspaceId}-${slugId(chaveDaEntrega)}`.slice(
        0,
        180,
      );
      try {
        await prisma.compromisso.create({
          data: {
            id,
            workspaceId,
            contato: contatoNome,
            contatoId,
            responsavel: "-",
            // Dia e hora no fuso de Brasília: `Compromisso.dataIso`/`hora` são hora LOCAL (é o que
            // o usuário digita na Agenda), e o Flow manda o instante em UTC.
            dataIso: dataIsoEmBrasilia(reuniao.inicio),
            hora: horaEmBrasilia(reuniao.inicio),
            horaFim: reuniao.fim ? horaEmBrasilia(reuniao.fim) : null,
            tipo: "Reunião",
            descricao: `Agendada no formulário ${formularioNome}`,
            local: reuniao.link,
            status: "agendado",
            origem: "azuz-flow",
          },
        });
      } catch (erro) {
        // Já gravado por uma entrega repetida ou pela chamada concorrente: é o resultado esperado.
        if (!ehChaveDuplicada(erro)) throw erro;
      }
    },

    conexoesDeWhatsapp: () => conexoesDeWhatsappDoWorkspace(workspaceId),
    config: () => configDoFlow(workspaceId),
    async nomeDaEmpresa() {
      const workspace = await prisma.workspace
        .findUnique({ where: { id: workspaceId }, select: { nome: true } })
        .catch(() => null);
      // Sem nome, a frase "pelo formulário da ..." fica estranha mas continua verdadeira o
      // bastante. Derrubar a confirmação por causa disso seria desproporcional.
      return workspace?.nome?.trim() || "nossa equipe";
    },
    enfileirarConfirmacao: (params) =>
      enfileirarConfirmacao({ workspaceId, ...params }),
    atrasoDoEnvio: () => intervaloEntreEnvios("whatsapp_nao_oficial"),
    anotarNaConversa: (params) => anotarNaConversa({ workspaceId, ...params }),
    async conversaDoContato(nome) {
      return prisma.conversa.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
        select: { id: true, canal: true, contaCanal: true },
      });
    },
    async garantirConversa({ nome, telefone, contatoId, contaCanal }) {
      await upsertConversaAoReceberMensagem({
        workspaceId,
        nome,
        canal: "WhatsApp",
        contato: normalizarTelefoneParaComparacao(telefone),
        origem: "Formulário",
        // `contarComoNaoLida: false` faz o trabalho de duas coisas aqui: a conversa nova nasce com
        // zero não lidas (ninguém escreveu), e uma conversa que já existia não é tocada — não ganha
        // badge nem é desarquivada por um formulário preenchido.
        contatoId,
        contarComoNaoLida: false,
        contaCanal,
      });
      // `upsertConversaAoReceberMensagem` não devolve a linha (ela é chamada por webhook, que não
      // precisa do id). Lemos de volta porque a resposta ao Flow carrega o `conversaId`.
      const conversa = await prisma.conversa.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
        select: { id: true },
      });
      return conversa ? { id: conversa.id } : null;
    },

    async temCardNoFunil(contatoNome) {
      const card = await prisma.negocioCard.findFirst({
        where: { workspaceId, nome: contatoNome },
        select: { id: true },
      });
      return Boolean(card);
    },
    async entrarNoFunil({ contatoNome, contaCanal }) {
      const card = await entrarNaPrimeiraEtapaComoNovoLead({
        workspaceId,
        contatoNome,
        origem: "Formulário",
        contaCanal,
      });
      if (!card) return null;
      const etapa = await prisma.funilEtapa.findUnique({
        where: { id: card.etapaId },
        select: { titulo: true, funil: { select: { nome: true } } },
      });
      return etapa ? { funil: etapa.funil.nome, etapa: etapa.titulo } : null;
    },
    async subirCard(contatoNome) {
      await subirCardParaOTopo(workspaceId, contatoNome);
    },

    avisarContatoCriado({ contatoNome, contatoId }) {
      aoCriarContato({ workspaceId, contatoNome, contatoId });
    },
    async dispararAutomacoes({ contatoNome, chaveEvento }) {
      await dispararAutomacoesDoCrm({
        workspaceId,
        contatoNome,
        tipoGatilho: "formulario_preenchido",
        chaveEvento,
      });
    },
  };
}

function iniciaisDe(nome: string): string {
  return (
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}
