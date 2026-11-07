import { prisma } from "@/lib/prisma";
import { decriptar } from "@/lib/integracoes/crypto";
import { enviarMensagemWhatsAppNaoOficial } from "@/lib/integracoes/evolution";
import { slotDeEnvio, slotPadraoDeEnvio } from "@/lib/integracoes/conexoes-whatsapp";
import { enviarDirectInstagram } from "@/lib/integracoes/instagram-login";
import { explicarErroDoInstagram } from "@/lib/integracoes/erro-instagram";
import { contaConectada, enviarPelaCloudApi, janelaDeAtendimentoAberta } from "@/lib/integracoes/whatsapp-oficial";
import { dentroDaJanelaDirect } from "@/lib/social/janela-direct";
import { enviarModeloDeRetomada } from "./retomada-envio";
import { upsertConversaAoReceberMensagem } from "./upsert";
import {
  MOTIVO_SEM_CONSENTIMENTO,
  bloqueadoPorFaltaDeConsentimento,
} from "@/lib/integracoes/consentimento-whatsapp";

/**
 * Manda um texto pelo canal de uma conversa. Do lado do SERVIDOR.
 *
 * A tela de Conversas tem o equivalente dela (`despacharTexto`), mas aquele roda no navegador de
 * quem está atendendo. Automação precisa de um caminho que funcione sem ninguém logado: a mensagem
 * chega de madrugada, o fluxo dispara e a resposta sai.
 *
 * Escolhe o canal pela conversa, não por parâmetro, pra não existir a chance de um chamador novo
 * mandar pelo canal errado: a conversa já sabe por onde ela fala.
 */
export async function enviarTextoPeloCanal(params: {
  workspaceId: string;
  conversaNome: string;
  texto: string;
}): Promise<{
  enviado: boolean;
  motivo?: string;
  /**
   * O id que a Meta devolve no envio.
   *
   * É por ele que o webhook de status acha a bolha depois pra dizer "entregue", "lido" ou
   * "FALHOU". Sem guardar, a mensagem ficava com o tique de enviada pra sempre mesmo quando a Meta
   * avisava minutos depois que a entrega falhou. Nulo no QR Code, que não tem id equivalente.
   *
   * No Instagram ele existe e é o MESMO id que volta no eco do webhook — é o que faz a mensagem
   * enviada pelo CRM não entrar de novo como se fosse uma segunda. Eu tinha anotado aqui que o
   * Instagram não tinha id; tinha, e era só não estar sendo lido.
   *
   * O MESMO ERRO ESTAVA ESCRITO AQUI SOBRE O QR CODE ("nulo no QR Code, que não tem id
   * equivalente"). Também tinha: a Evolution devolve o `key.id` no envio, e é ele que liga a
   * mensagem ao "entregue"/"lido" que chega depois.
   */
  wamid?: string | null;
}> {
  const { workspaceId, conversaNome, texto } = params;
  if (!texto.trim()) return { enviado: false, motivo: "mensagem vazia" };

  const conversa = await prisma.conversa.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: conversaNome } },
  });
  if (!conversa?.contato) return { enviado: false, motivo: "conversa sem destinatário" };

  // Grupo não recebe automação: ele existe pra ser respondido à mão em Conversas. Uma automação
  // disparando num grupo escreveria pra dezenas de pessoas de uma vez.
  if (conversa.ehGrupo) return { enviado: false, motivo: "conversa de grupo" };

  try {
    if (conversa.canal === "Instagram") {
      const integracao = await prisma.integracao.findUnique({
        where: { workspaceId_provedor_slot: { workspaceId, provedor: "meta_instagram", slot: 1 } },
      });
      if (!integracao?.accessTokenCriptografado || integracao.status !== "conectado") {
        return { enviado: false, motivo: "Instagram não conectado" };
      }
      // A janela ANTES de tentar. Fora dela o Instagram recusa, e a recusa chegaria como um erro
      // técnico da Meta, em inglês, difícil de ligar à causa. Aqui a explicação já vem certa e a
      // chamada nem sai: não gasta cota nem suja a conta com erro previsível.
      if (!(await dentroDaJanelaDirect(workspaceId, conversaNome))) {
        return {
          enviado: false,
          motivo:
            "a janela de 24 horas do Instagram fechou. Só dá pra escrever até 24 horas depois da última mensagem da pessoa, e no Direct não existe modelo aprovado pra retomar.",
        };
      }
      try {
        // O id DEVOLVIDO PELO ENVIO, que antes era jogado fora.
        //
        // Guardá-lo é o que impede a mensagem de aparecer duas vezes: tudo que a conta envia volta
        // como eco de webhook, com este mesmo id. Sem ele, a linha gravada aqui ficava com um id
        // próprio, o eco não casava com nada e entrava como uma segunda mensagem.
        const mid = await enviarDirectInstagram(
          decriptar(integracao.accessTokenCriptografado),
          conversa.contato,
          texto,
        );
        return { enviado: true, wamid: mid ?? null };
      } catch (erro) {
        // A frase crua da Meta ("The requested user cannot be found") sugere que a pessoa sumiu do
        // Instagram, o que não tem nada a ver com o que aconteceu. Ver `erro-instagram.ts`.
        const cru = erro instanceof Error ? erro.message : "Falha ao enviar pelo Direct.";
        return { enviado: false, motivo: explicarErroDoInstagram(cru) };
      }
    }

    // WhatsApp: a conversa pertence à conexão por onde ela veio (ver `contaCanal`). QR Code e API
    // oficial são serviços diferentes: mandar pelo errado dá erro ou vai pro número errado.
    if (conversa.contaCanal?.startsWith("whatsapp_nao_oficial:") || conversa.contaCanal?.startsWith("whatsapp_baileys:")) {
      /*
       * SAI PELO NÚMERO QUE RECEBEU. Com um número só isso era automático; com vários, é decisão.
       *
       * O cliente escreveu pra vendedora e a automação responde pelo número do closer: do lado de
       * lá, uma conversa que começou com uma pessoa continua com outra, do nada. É o tipo de coisa
       * que destrói a confiança numa negociação, então quando o CRM não sabe por onde sair ele não
       * sai — e diz por quê.
       */
      const { slot, motivo } = await slotDeEnvio(workspaceId, conversa.contaCanal);
      if (slot === null) return { enviado: false, motivo };
      // O id volta junto: é por ele que `messages.update` acha esta bolha depois pra dizer
      // "entregue" e "lido". O QR Code sempre devolveu esse id; o CRM é que o jogava fora.
      const id = await enviarMensagemWhatsAppNaoOficial(workspaceId, conversa.contato, texto, slot);
      return { enviado: true, wamid: id };
    }

    /*
     * CONVERSA SEM DONO É DO QR CODE, e isso já é regra do produto — só não estava aqui.
     *
     * `contasCanalVisiveis` diz com todas as letras: `contaCanal IS NULL` é o histórico anterior a
     * essa coluna existir, e todo ele veio do QR Code, o único canal que já espelhou histórico. É
     * por isso que essas conversas aparecem na caixa de entrada quando o QR está ligado.
     *
     * Aqui elas caíam no caminho da API oficial e voltavam "WhatsApp não conectado" — num
     * workspace que estava com o WhatsApp funcionando o dia inteiro. Valia pra toda automação
     * respondendo a conversa antiga, e passou a valer também pro lead do Flow, que agora pode
     * nascer sem marca quando o CRM não sabe o número da conexão (ver `azuz-flow-canal.ts`).
     *
     * Só quando o QR está LIGADO: com ele fora e o oficial de pé, a saída é o caminho de baixo.
     */
    if (!conversa.contaCanal && (await qrCodeConectado(workspaceId))) {
      const { slot, motivo } = await slotDeEnvio(workspaceId, null);
      if (slot === null) return { enviado: false, motivo };
      const id = await enviarMensagemWhatsAppNaoOficial(workspaceId, conversa.contato, texto, slot);
      return { enviado: true, wamid: id };
    }

    const conta = await contaConectada(workspaceId);
    if (!conta) return { enviado: false, motivo: "WhatsApp não conectado" };

    /*
     * A JANELA DE 24 HORAS, conferida antes de tentar.
     *
     * Este é o ponto onde um follow-up morre em silêncio, e é o defeito que motivou esta correção.
     * O bloco de espera existe justamente pra falar com quem parou de responder, e é exatamente
     * nesse momento que a janela costuma estar fechada. A Cloud API recusa texto livre fora dela e
     * devolve um erro técnico em inglês; sem esta checagem, a automação registrava "falhou" com
     * uma mensagem que não dizia o que fazer.
     *
     * NÃO trocamos por um modelo aprovado sozinhos, e isso é deliberado: qual modelo mandar é
     * decisão de quem montou o fluxo, e escolher um por conta própria mandaria pro cliente um
     * texto que ninguém aprovou. Quem quer falar fora da janela usa o bloco "Enviar modelo do
     * WhatsApp", que existe pra isso. O que a automação faz aqui é dizer o motivo com todas as
     * letras, pra tela de execuções mostrar a saída em vez de um enigma.
     */
    if (!(await janelaDeAtendimentoAberta(workspaceId, conversaNome))) {
      // Fora da janela, o CRM tenta o modelo de retomada que a pessoa escolheu UMA vez em
      // Configurações. É o que faz o follow-up sair sozinho em vez de virar tarefa de quem usa:
      // o follow-up existe pra falar com quem parou de responder, ou seja, ele nasce mirando o
      // lado de fora da janela. Sem modelo escolhido, nada muda e o motivo é dito como antes.
      const retomada = await enviarModeloDeRetomada({ workspaceId, conversaNome, destinatario: conversa.contato });
      if (retomada) return retomada;
      return {
        enviado: false,
        motivo:
          "a janela de 24 horas do WhatsApp fechou. Fora dela a Meta só aceita modelo aprovado. Escolha um modelo de retomada em Configurações → WhatsApp e o CRM passa a mandar sozinho nessas horas.",
      };
    }

    const wamid = await enviarPelaCloudApi(conta, conversa.contato, { type: "text", text: { body: texto } });
    return { enviado: true, wamid };
  } catch (erro) {
    return { enviado: false, motivo: erro instanceof Error ? erro.message : "falha no envio" };
  }
}

/** O WhatsApp por QR Code está ligado neste workspace? Consulta curta e própria: a leitura completa
 *  das conexões (`azuz-flow-conexoes.ts`) ainda descriptografa o token do oficial, que aqui não
 *  serve pra nada. */
async function qrCodeConectado(workspaceId: string): Promise<boolean> {
  // QUALQUER número conectado conta, não a posição 1. Com o primeiro caído e o segundo de pé, ler
  // só a posição 1 responderia "não tem QR Code" — e a conversa sem dono cairia no caminho da API
  // oficial, voltando "WhatsApp não conectado" com o WhatsApp funcionando.
  const quantos = await prisma.integracao
    .count({ where: { workspaceId, provedor: "whatsapp_nao_oficial", status: "conectado" } })
    .catch(() => 0);
  return quantos > 0;
}


/**
 * COMEÇAR A CONVERSA PRA PODER FALAR: o envio pra quem nunca escreveu.
 *
 * `enviarTextoPeloCanal` escolhe o canal PELA CONVERSA, e isso é certo — mas quer dizer que, sem
 * conversa, ele não tem por onde mandar e devolve "conversa sem destinatário". Para um lead que
 * entrou por importação, por formulário ou pela mão de alguém, é esse o estado: existe cadastro,
 * existe número, e nunca houve mensagem. O robô simplesmente não falava com ele.
 *
 * Aqui a conversa é CRIADA pelo envio, como o disparo em massa já faz: manda pro número e abre a
 * thread. As duas travas que valem pro disparo valem aqui também, pelo mesmo motivo:
 *
 * - CONSENTIMENTO. Quem marcou que não quer receber WhatsApp não recebe por este caminho. Quem
 *   escreveu primeiro já consentiu na prática; quem nunca escreveu, não.
 * - CANAL. Só o WhatsApp inicia conversa: no Instagram, a Meta não deixa escrever pra quem nunca
 *   mandou mensagem, e não existe modelo aprovado pra isso no Direct.
 *
 * No WhatsApp OFICIAL, texto livre só sai dentro da janela de 24 horas — que, por definição, não
 * existe aqui. Então o caminho é a conexão por QR Code; com só a oficial conectada, a função diz
 * exatamente isso em vez de falhar com o erro cru da Meta.
 */
/**
 * As condições pra começar uma conversa, numa função só e sem tocar no banco.
 *
 * Mora separada do envio porque é a parte que PRECISA de teste: consentimento e canal marcado são
 * as duas travas que impedem o robô de escrever pra quem não quer, ou por onde não pode — e elas
 * não podem depender de alguém ler o código do envio pra conferir se continuam lá.
 *
 * Devolve o motivo do impedimento, ou `null` quando pode seguir.
 */
export function motivoParaNaoIniciarConversa(params: {
  /** Os canais que o bloco deixa usar. Vazio/ausente = qualquer um. */
  canaisPermitidos?: string[];
  /** O número do cadastro, como está guardado (com máscara ou sem). */
  numero: string | null | undefined;
  consentimento: boolean | null | undefined;
}): string | null {
  // O vocabulário é o do BLOCO ("whatsapp", "instagram"), o mesmo que a pessoa marca no botão
  // "Canais" do cartão. Só o WhatsApp inicia conversa; o Instagram não deixa escrever primeiro.
  if (params.canaisPermitidos?.length && !params.canaisPermitidos.includes("whatsapp")) {
    return "só o WhatsApp inicia conversa com quem nunca escreveu, e ele não está marcado neste bloco";
  }
  const numero = (params.numero ?? "").replace(/\D/g, "");
  if (!numero) return "o contato não tem número de WhatsApp no cadastro";
  if (numero.length < 10) return "número de WhatsApp incompleto no cadastro";
  if (bloqueadoPorFaltaDeConsentimento(params.consentimento)) return MOTIVO_SEM_CONSENTIMENTO;
  return null;
}

export async function iniciarConversaEEnviarTexto(params: {
  workspaceId: string;
  contatoNome: string;
  texto: string;
  /** Os canais que o bloco deixa usar. Vazio/ausente = qualquer um que esteja conectado. */
  canaisPermitidos?: string[];
}): Promise<{ enviado: boolean; motivo?: string }> {
  const { workspaceId, contatoNome, texto } = params;
  if (!texto.trim()) return { enviado: false, motivo: "mensagem vazia" };

  const contato = await prisma.contato.findUnique({
    where: { workspaceId_nome: { workspaceId, nome: contatoNome } },
    select: { id: true, whatsapp: true, consentimentoWhatsApp: true },
  });

  const impedimento = motivoParaNaoIniciarConversa({
    canaisPermitidos: params.canaisPermitidos,
    numero: contato?.whatsapp,
    consentimento: contato?.consentimentoWhatsApp,
  });
  if (impedimento) return { enviado: false, motivo: impedimento };

  const numero = (contato?.whatsapp ?? "").replace(/\D/g, "");

  let wamid: string | null = null;
  try {
    // Conversa que ainda não existe não tem "número que recebeu": sai pelo primeiro conectado.
    // Ver `slotPadraoDeEnvio`.
    const slot = (await slotPadraoDeEnvio(workspaceId)) ?? 1;
    wamid = await enviarMensagemWhatsAppNaoOficial(workspaceId, numero, texto, slot);
  } catch (erro) {
    const cru = erro instanceof Error ? erro.message : "falha ao enviar";
    // Com a oficial conectada e a de QR Code não, a explicação certa é a da janela — e não o erro
    // de conexão, que faria procurar defeito no lugar errado.
    const oficial = await contaConectada(workspaceId);
    return {
      enviado: false,
      motivo: oficial
        ? "o WhatsApp oficial não inicia conversa com texto livre: fora da janela de 24 horas só sai modelo aprovado. Conecte o WhatsApp por QR Code pra o robô falar com quem nunca escreveu."
        : cru,
    };
  }

  // A conversa só nasce DEPOIS do envio dar certo: uma thread vazia na caixa de entrada, criada
  // por uma mensagem que não saiu, é pior do que não ter nada.
  await upsertConversaAoReceberMensagem({
    workspaceId,
    nome: contatoNome,
    canal: "WhatsApp",
    contato: numero,
    contatoId: contato?.id,
    origem: "automacao",
    contarComoNaoLida: false,
  }).catch(() => {});

  return { enviado: true, motivo: wamid ?? undefined };
}
