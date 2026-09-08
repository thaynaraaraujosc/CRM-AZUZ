import { prisma } from "@/lib/prisma";
import { enviarTextoPeloCanal } from "@/lib/conversas/enviar-pelo-canal";
import { registrarMensagemEnviada } from "@/lib/conversas/registrar-saida";
import {
  enviarContatoPeloCanal,
  enviarLocalizacaoPeloCanal,
  enviarPerguntaPeloCanal,
  textoNumerado,
  type OpcaoPergunta,
} from "@/lib/conversas/enviar-pergunta";
import { enviarMidiaPeloCanal, type TipoMidia } from "@/lib/conversas/enviar-midia";
import { componentesParaMeta, resolverParametros, type MapeamentoVariavel } from "@/lib/campanhas/variaveis";
import { contaConectada, enviarPelaCloudApi } from "@/lib/integracoes/whatsapp-oficial";
import { enviarEmailOuFalhar } from "@/lib/email";
import { encerrarExecucao, execucoesVivasDoContato } from "./execucoes";
import { categoriaEscolhida, conversaEmTexto, provedorDeIA } from "./ia";
import { anotarNaLinhaDoTempo } from "@/lib/integracoes/instagram-eventos";

/**
 * O que uma automação consegue FAZER no mundo — separado de QUANDO fazer (o motor).
 *
 * A separação existe por um motivo prático: o botão "Testar" precisa percorrer exatamente o mesmo
 * fluxo, tomar exatamente as mesmas decisões, e **não** mandar mensagem pra ninguém nem mexer no
 * funil. Com as ações atrás de uma interface, o simulador troca a implementação e ganha uma
 * simulação que é o comportamento real — não uma aproximação escrita à parte, que foi o que o
 * simulador antigo era (e que por isso divergia do que acontecia de verdade).
 *
 * Toda ação devolve `{ ok, detalhe, erroTecnico? }` em vez de estourar: uma automação de sete
 * passos não pode morrer inteira porque o Instagram caiu no terceiro. O motor registra a falha
 * naquele nó e decide se segue.
 */
export type ResultadoAcao = {
  ok: boolean;
  /** O que a pessoa lê no histórico ("Mensagem enviada", "Template não aprovado"). */
  detalhe: string;
  /** Detalhe pra investigação: código da Meta, corpo do erro. Nunca credencial. */
  erroTecnico?: string;
};

const ok = (detalhe: string): ResultadoAcao => ({ ok: true, detalhe });
const falha = (detalhe: string, erroTecnico?: string): ResultadoAcao => ({ ok: false, detalhe, erroTecnico });

export type AcoesDoMotor = {
  /** Envia texto pelo canal da conversa daquele contato. */
  enviarTexto: (params: { contatoNome: string; texto: string; canal?: string }) => Promise<ResultadoAcao>;
  /** Envia uma pergunta com opções no melhor formato que o canal suporta (botão, lista, resposta
   * rápida ou menu numerado). O `detalhe` diz qual formato saiu — a pessoa precisa ver isso. */
  perguntar: (params: { contatoNome: string; texto: string; opcoes: OpcaoPergunta[] }) => Promise<ResultadoAcao>;
  /** Envia uma localização (cartão com mapa no WhatsApp; link do Maps nos outros canais). */
  enviarLocalizacao: (params: { contatoNome: string; latitude: number; longitude: number; nome?: string; endereco?: string }) => Promise<ResultadoAcao>;
  /** Envia um cartão de contato. */
  enviarContato: (params: { contatoNome: string; nome: string; telefone?: string; email?: string; empresa?: string }) => Promise<ResultadoAcao>;
  /** Avisa a equipe por dentro do CRM — vai pro histórico do lead e, quando há e-mail, pra caixa
   * de quem foi indicado. */
  avisarEquipe: (params: { contatoNome: string; equipe?: string; mensagem: string }) => Promise<ResultadoAcao>;
  /** Dados de um contato do CRM, em JSON no `detalhe` — pro bloco que compartilha um contato. */
  buscarContato: (nome: string) => Promise<ResultadoAcao>;
  /** Endereço público do formulário, no `detalhe`. */
  linkDoFormulario: (params: { origem: "interno" | "externo"; formularioId?: string; urlExterna?: string }) => Promise<ResultadoAcao>;
  /** Envia um arquivo da biblioteca pelo canal da conversa. */
  enviarMidia: (params: { contatoNome: string; arquivoId: string; tipo: TipoMidia; legenda?: string }) => Promise<ResultadoAcao>;
  /** Envia um modelo aprovado do WhatsApp oficial, com as variáveis preenchidas. É o único jeito
   * de falar com alguém fora da janela de 24 horas. */
  enviarModeloOficial: (params: { contatoNome: string; templateId: string; variaveis?: Record<string, string> }) => Promise<ResultadoAcao>;
  /** Manda um e-mail. */
  enviarEmail: (params: { contatoNome: string; para?: string; assunto: string; corpo: string }) => Promise<ResultadoAcao>;
  /** Cria uma tarefa no quadro. */
  criarTarefa: (params: { contatoNome: string; titulo: string; descricao?: string; responsavel?: string; prazo?: Date; prioridade?: string }) => Promise<ResultadoAcao>;
  /** Responde o contato com IA, seguindo a instrução do bloco. */
  responderComIA: (params: { contatoNome: string; instrucao: string; contexto?: string; maximoCaracteres?: number }) => Promise<ResultadoAcao>;
  /** Classifica a última mensagem numa das categorias. A escolhida volta no `detalhe`; `ok: false`
   * com detalhe vazio quer dizer "não encaixou em nenhuma". */
  classificarComIA: (params: { contatoNome: string; instrucao?: string; categorias: string[] }) => Promise<ResultadoAcao>;
  /** Cria um negócio (card) no funil/etapa escolhidos. */
  criarNegocio: (params: { contatoNome: string; nome: string; funilId: string; etapaTitulo: string; valor?: string }) => Promise<ResultadoAcao>;
  /** Marca um compromisso na agenda. */
  agendarConsulta: (params: { contatoNome: string; dataIso: string; hora: string; responsavel?: string; tipo?: string; observacao?: string }) => Promise<ResultadoAcao>;
  /** Cancela o próximo compromisso do contato. */
  cancelarAgendamento: (params: { contatoNome: string; motivo?: string }) => Promise<ResultadoAcao>;
  /** Oculta o comentário do Instagram que disparou o fluxo. */
  ocultarComentario: () => Promise<ResultadoAcao>;
  /** Pausa ou cancela as OUTRAS automações vivas deste contato. */
  pararOutrasAutomacoes: (params: { contatoNome: string; fluxoAtualId: string; modo: "pausar" | "cancelar" }) => Promise<ResultadoAcao>;
  /** Escolhe quem assume o atendimento. O nome escolhido volta no `detalhe`. */
  escolherAtendente: (params: { equipe?: string; metodo?: string }) => Promise<ResultadoAcao>;
  /** Chama um endereço externo, com repetição em caso de falha temporária. */
  chamarWebhook: (params: { url: string; corpo: Record<string, unknown> }) => Promise<ResultadoAcao>;
  /** Grava campos no contato (etiquetas, responsável, campo personalizado, valor…). */
  salvarContato: (params: { contatoNome: string; dados: Record<string, unknown> }) => Promise<ResultadoAcao>;
  /** Move (ou cria) o card do contato numa etapa do funil. */
  moverEtapa: (params: { contatoNome: string; funilId: string; etapaTitulo: string }) => Promise<ResultadoAcao>;
  /** Responde o comentário do Instagram que disparou o fluxo, quando foi um. */
  responderComentario: (texto: string) => Promise<ResultadoAcao>;
  /** Anota no histórico do lead. */
  anotar: (params: { contatoNome: string; canal: string; tipo: string; descricao: string; dados?: Record<string, unknown> }) => Promise<void>;
};

/** As ações de verdade: gravam no banco e falam com os canais. */
export function acoesReais(params: {
  workspaceId: string;
  /** Só existe quando o fluxo foi disparado por um comentário. */
  responderComentario?: (texto: string) => Promise<void>;
  /** Idem — ocultar só faz sentido quando há um comentário de origem. */
  ocultarComentario?: () => Promise<void>;
}): AcoesDoMotor {
  const { workspaceId } = params;
  return {
    async enviarTexto({ contatoNome, texto }) {
      if (!texto.trim()) return falha("Mensagem vazia — nada foi enviado.");
      try {
        const r = await enviarTextoPeloCanal({ workspaceId, conversaNome: contatoNome, texto });
        if (!r.enviado) return falha(`Não foi possível enviar: ${r.motivo ?? "motivo desconhecido"}`);
        // A mensagem entra na conversa. Sem isto quem abre a tela vê a resposta do cliente sem a
        // pergunta que a automação fez.
        await registrarMensagemEnviada({ workspaceId, contatoNome, texto, origem: "automacao" });
        return ok(`Mensagem enviada: "${resumir(texto)}"`);
      } catch (erro) {
        return falha("Falha ao enviar a mensagem.", mensagemDoErro(erro));
      }
    },

    async perguntar({ contatoNome, texto, opcoes }) {
      if (!texto.trim()) return falha("Pergunta sem texto — nada foi enviado.");
      try {
        const r = await enviarPerguntaPeloCanal({ workspaceId, conversaNome: contatoNome, texto, opcoes });
        if (!r.enviado) return falha(`Não foi possível enviar: ${r.motivo ?? "motivo desconhecido"}`);
        // Registra com o texto do jeito que a pessoa recebeu: no menu numerado as opções fazem
        // parte do texto; nos formatos interativos elas vão em `opcoes` e viram as bolhas de botão.
        await registrarMensagemEnviada({
          workspaceId,
          contatoNome,
          texto: r.formato === "numerado" ? textoNumerado(texto, opcoes) : texto,
          opcoes: r.formato === "numerado" ? undefined : opcoes.map((o) => o.rotulo),
          origem: "automacao",
        });
        return ok(`Pergunta enviada (${NOME_DO_FORMATO[r.formato]})${r.observacao ? ` — ${r.observacao}` : ""}.`);
      } catch (erro) {
        return falha("Falha ao enviar a pergunta.", mensagemDoErro(erro));
      }
    },

    async enviarMidia({ contatoNome, arquivoId, tipo, legenda }) {
      if (!arquivoId) return falha("O bloco não tem arquivo escolhido — nada foi enviado.");
      try {
        const r = await enviarMidiaPeloCanal({ workspaceId, conversaNome: contatoNome, arquivoId, tipo, legenda });
        if (!r.enviado) return falha(`Não foi possível enviar o arquivo: ${r.motivo ?? "motivo desconhecido"}`);
        await registrarMensagemEnviada({
          workspaceId,
          contatoNome,
          texto: legenda || `[${tipo}]`,
          origem: "automacao",
        });
        return ok(`Arquivo enviado (${tipo}).`);
      } catch (erro) {
        return falha("Falha ao enviar o arquivo.", mensagemDoErro(erro));
      }
    },

    async enviarLocalizacao({ contatoNome, latitude, longitude, nome, endereco }) {
      try {
        const r = await enviarLocalizacaoPeloCanal({ workspaceId, conversaNome: contatoNome, latitude, longitude, nome, endereco });
        if (!r.enviado) return falha(`Não foi possível enviar a localização: ${r.motivo ?? "motivo desconhecido"}`);
        await registrarMensagemEnviada({
          workspaceId,
          contatoNome,
          texto: [nome, endereco, `https://maps.google.com/?q=${latitude},${longitude}`].filter(Boolean).join("\n"),
          origem: "automacao",
        });
        return ok(r.comoTexto ? "Localização enviada como link do mapa (o canal não tem cartão de localização)." : "Localização enviada.");
      } catch (erro) {
        return falha("Falha ao enviar a localização.", mensagemDoErro(erro));
      }
    },

    async enviarContato({ contatoNome, nome, telefone, email, empresa }) {
      if (!nome.trim()) return falha("O bloco não tem contato escolhido.");
      try {
        const r = await enviarContatoPeloCanal({ workspaceId, conversaNome: contatoNome, nome, telefone, email, empresa });
        if (!r.enviado) return falha(`Não foi possível enviar o contato: ${r.motivo ?? "motivo desconhecido"}`);
        await registrarMensagemEnviada({
          workspaceId,
          contatoNome,
          texto: [nome, empresa, telefone, email].filter(Boolean).join("\n"),
          origem: "automacao",
        });
        return ok(r.comoTexto ? `Contato "${nome}" enviado como texto (o canal não tem cartão de contato).` : `Contato "${nome}" enviado.`);
      } catch (erro) {
        return falha("Falha ao enviar o contato.", mensagemDoErro(erro));
      }
    },

    async avisarEquipe({ contatoNome, equipe, mensagem }) {
      if (!mensagem.trim()) return falha("Aviso interno sem texto.");
      try {
        // Vai pro histórico do lead sempre: é ali que quem abre a conversa vê o que aconteceu.
        await anotarNaLinhaDoTempo({
          workspaceId,
          contatoNome,
          canal: "CRM",
          tipo: "aviso_interno",
          descricao: mensagem,
          dados: equipe ? { equipe } : undefined,
        });

        // E por e-mail, quando dá: um aviso que só existe dentro da tela não acorda ninguém.
        const membros = await prisma.membro.findMany({
          where: { workspaceId, ativo: true, convitePendente: false, ...(equipe ? { papel: equipe } : {}) },
          select: { email: true },
        });
        const destinos = membros.map((m) => m.email).filter(Boolean);
        if (!destinos.length) return ok("Aviso registrado no histórico do lead.");

        await Promise.all(
          destinos.map((to) =>
            enviarEmailOuFalhar({
              to,
              subject: `CRM AZUZ — ${contatoNome}`,
              html: `<p>${mensagem}</p><p style="color:#666">Lead: ${contatoNome}</p>`,
            }).catch((erro) => console.error("[automacao] aviso interno não saiu por e-mail:", erro)),
          ),
        );
        return ok(`Aviso registrado e enviado para ${destinos.length} pessoa(s) da equipe.`);
      } catch (erro) {
        return falha("Falha ao avisar a equipe.", mensagemDoErro(erro));
      }
    },

    async buscarContato(nome) {
      try {
        const contato = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome } } });
        if (!contato) return falha(`O contato "${nome}" não existe mais.`);
        return ok(
          JSON.stringify({
            nome: contato.nome,
            telefone: contato.whatsapp ?? undefined,
            email: contato.email ?? undefined,
            empresa: contato.empresa ?? undefined,
          }),
        );
      } catch (erro) {
        return falha("Falha ao buscar o contato.", mensagemDoErro(erro));
      }
    },

    async linkDoFormulario({ origem, formularioId, urlExterna }) {
      if (origem === "externo") {
        const url = urlExterna?.trim();
        return url ? ok(url) : falha("O bloco não tem o endereço do formulário externo.");
      }
      if (!formularioId) return falha("O bloco não tem formulário escolhido.");
      try {
        const formulario = await prisma.formulario.findFirst({ where: { id: formularioId, workspaceId }, select: { id: true } });
        if (!formulario) return falha("Esse formulário não existe mais.");
        const base = (process.env.APP_URL ?? "").replace(/\/+$/, "");
        if (!base) return falha("APP_URL não está configurado no servidor — sem ele não dá pra montar o link do formulário.");
        return ok(`${base}/formulario-preview?id=${formulario.id}`);
      } catch (erro) {
        return falha("Falha ao montar o link do formulário.", mensagemDoErro(erro));
      }
    },

    async enviarModeloOficial({ contatoNome, templateId, variaveis }) {
      if (!templateId) return falha("O bloco não tem modelo escolhido.");
      try {
        const modelo = await prisma.template.findFirst({ where: { id: templateId, workspaceId } });
        if (!modelo) return falha("Esse modelo não existe mais.");
        // Modelo não aprovado é recusado pela Meta com erro genérico. Dizer isso aqui é o que
        // permite corrigir; deixar tentar só produziria "falhou" sem motivo.
        if (modelo.status !== "aprovado") return falha(`O modelo "${modelo.nome}" ainda não está aprovado pela Meta.`);

        const conta = await contaConectada(workspaceId);
        if (!conta) return falha("WhatsApp oficial não conectado.");

        const conversa = await prisma.conversa.findUnique({ where: { workspaceId_nome: { workspaceId, nome: contatoNome } } });
        if (!conversa?.contato) return falha("Conversa sem destinatário.");

        const contato = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome: contatoNome } } });
        const mapeamento = ((modelo.variaveis ?? []) as MapeamentoVariavel[]).map((v) => ({
          ...v,
          // Valor fixo escolhido no bloco tem prioridade sobre o padrão do modelo.
          ...(variaveis?.[v.chave] ? { origem: "texto" as const, valor: variaveis[v.chave] } : {}),
        }));
        const parametros = resolverParametros(mapeamento, contato ? { ...contato, nome: contatoNome } : null);

        await enviarPelaCloudApi(conta, conversa.contato, {
          type: "template",
          template: {
            name: modelo.nome,
            language: { code: modelo.idioma },
            components: componentesParaMeta(mapeamento, parametros),
          },
        });
        return ok(`Modelo "${modelo.nome}" enviado.`);
      } catch (erro) {
        return falha("Falha ao enviar o modelo.", mensagemDoErro(erro));
      }
    },

    async enviarEmail({ contatoNome, para, assunto, corpo }) {
      try {
        let destino = para?.trim();
        if (!destino) {
          const contato = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome: contatoNome } } });
          destino = contato?.email?.trim() || undefined;
        }
        if (!destino) return falha(`${contatoNome} não tem e-mail cadastrado — nada foi enviado.`);
        // `enviarEmailOuFalhar` e não `enviarEmail`: o segundo engole a falha e devolve sucesso,
        // e o histórico da automação diria "enviado" para alguém que não recebeu nada.
        await enviarEmailOuFalhar({ to: destino, subject: assunto, html: corpo });
        return ok(`E-mail enviado para ${destino}.`);
      } catch (erro) {
        return falha("Falha ao enviar o e-mail.", mensagemDoErro(erro));
      }
    },

    async criarTarefa({ contatoNome, titulo, descricao, responsavel, prazo, prioridade }) {
      try {
        // A tarefa entra na primeira coluna do quadro ("a fazer"), que é onde alguém vai olhar.
        const etapa = await prisma.tarefaEtapa.findFirst({ where: { workspaceId }, orderBy: { ordem: "asc" } });
        if (!etapa) return falha("Não há quadro de tarefas configurado nesse workspace.");

        const contato = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome: contatoNome } } });
        const quando = prazo ?? new Date();
        await prisma.tarefaCard.create({
          data: {
            id: `tarefa-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            etapaId: etapa.id,
            workspaceId,
            ordem: 0,
            titulo,
            contato: contatoNome,
            contatoId: contato?.id ?? null,
            data: quando.toISOString().slice(0, 10),
            responsavelNome: responsavel ?? "—",
            responsavelInitials: iniciais(responsavel ?? contatoNome),
            urgencia: prioridade ?? "normal",
            descricao: descricao ?? "",
          },
        });
        return ok(`Tarefa criada: "${resumir(titulo)}".`);
      } catch (erro) {
        return falha("Falha ao criar a tarefa.", mensagemDoErro(erro));
      }
    },

    async responderComIA({ contatoNome, instrucao, contexto, maximoCaracteres }) {
      const ia = provedorDeIA();
      // Sem IA configurada o bloco NÃO inventa resposta: uma frase genérica saindo em nome da
      // empresa é pior do que nenhuma, e quem montou o fluxo precisa saber que falta a chave.
      if (!ia) return falha("IA não configurada no servidor — nada foi respondido.");
      if (!instrucao.trim()) return falha("O bloco de IA está sem instrução.");

      try {
        const historico = await ultimasMensagens(workspaceId, contatoNome);
        if (!historico.length) return falha("Sem conversa pra a IA ler.");

        const limite = maximoCaracteres ?? 400;
        const texto = await ia.responder({
          sistema: [
            "Você responde clientes pelo WhatsApp/Instagram em nome de uma empresa brasileira.",
            `Instrução de quem montou o atendimento: ${instrucao}`,
            contexto?.trim() ? `Informações da empresa: ${contexto}` : "",
            `Responda em português do Brasil, em no máximo ${limite} caracteres.`,
            "Não invente preço, prazo ou política que não estejam nas informações acima — se não souber, diga que vai confirmar.",
          ]
            .filter(Boolean)
            .join("\n"),
          pergunta: `Conversa até agora:\n${conversaEmTexto(historico)}\n\nEscreva a próxima mensagem nossa.`,
        });

        const resposta = texto.trim().slice(0, limite);
        if (!resposta) return falha("A IA não devolveu texto.");
        const envio = await enviarTextoPeloCanal({ workspaceId, conversaNome: contatoNome, texto: resposta });
        return envio.enviado
          ? ok(`Respondido pela IA (${ia.nome}): "${resumir(resposta)}"`)
          : falha(`A IA escreveu, mas não foi possível enviar: ${envio.motivo ?? "motivo desconhecido"}`);
      } catch (erro) {
        return falha("Falha ao responder com IA.", mensagemDoErro(erro));
      }
    },

    async classificarComIA({ contatoNome, instrucao, categorias }) {
      const ia = provedorDeIA();
      if (!ia) return falha("IA não configurada no servidor.");
      const opcoes = categorias.filter((c) => c.trim());
      if (!opcoes.length) return falha("O bloco de classificação está sem categorias.");

      try {
        const historico = await ultimasMensagens(workspaceId, contatoNome);
        if (!historico.length) return falha("Sem conversa pra classificar.");

        const texto = await ia.responder({
          sistema: [
            "Você classifica mensagens de clientes numa única categoria.",
            instrucao?.trim() ? `Critério: ${instrucao}` : "",
            `Categorias possíveis: ${opcoes.join(", ")}.`,
            "Responda APENAS com o nome exato de uma das categorias, sem explicação. Se nenhuma servir, responda: nenhuma.",
          ]
            .filter(Boolean)
            .join("\n"),
          pergunta: `Conversa:\n${conversaEmTexto(historico, 6)}\n\nQual categoria?`,
        });

        const escolhida = categoriaEscolhida(texto, opcoes);
        return escolhida ? ok(escolhida) : falha("");
      } catch (erro) {
        return falha("Falha ao classificar com IA.", mensagemDoErro(erro));
      }
    },

    async criarNegocio({ contatoNome, nome, funilId, etapaTitulo, valor }) {
      // Reaproveita `moverEtapa`: ele já cria o card quando não existe, e já confere o workspace
      // antes do funil. Duas implementações do mesmo "põe esse contato nessa etapa" divergiriam na
      // primeira correção feita só de um lado.
      const r = await acoesReais({ workspaceId }).moverEtapa({ contatoNome: nome || contatoNome, funilId, etapaTitulo });
      if (!r.ok) return r;
      if (valor?.trim()) {
        await prisma.negocioCard
          .updateMany({ where: { workspaceId, nome: nome || contatoNome }, data: { valor } })
          .catch(() => {});
      }
      return ok(`Negócio criado em "${etapaTitulo}"${valor ? ` (${valor})` : ""}.`);
    },

    async agendarConsulta({ contatoNome, dataIso, hora, responsavel, tipo, observacao }) {
      try {
        const contato = await prisma.contato.findUnique({ where: { workspaceId_nome: { workspaceId, nome: contatoNome } } });
        const linha = await prisma.compromisso.create({
          data: {
            id: `agenda-auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            workspaceId,
            contato: contatoNome,
            contatoId: contato?.id ?? null,
            responsavel: responsavel || "—",
            dataIso,
            hora,
            tipo: tipo || "Consulta",
            descricao: observacao || null,
            status: "agendado",
            origem: "Automação",
          },
        });
        return ok(`Consulta marcada para ${linha.dataIso} às ${linha.hora}.`);
      } catch (erro) {
        return falha("Falha ao marcar a consulta.", mensagemDoErro(erro));
      }
    },

    async cancelarAgendamento({ contatoNome, motivo }) {
      try {
        // O PRÓXIMO compromisso, não todos: cancelar o histórico inteiro de alguém por causa de uma
        // automação seria destrutivo e irreversível.
        const hoje = new Date().toISOString().slice(0, 10);
        const proximo = await prisma.compromisso.findFirst({
          where: { workspaceId, contato: contatoNome, status: { notIn: ["cancelado"] }, dataIso: { gte: hoje } },
          orderBy: [{ dataIso: "asc" }, { hora: "asc" }],
        });
        if (!proximo) return ok("Não havia compromisso futuro pra cancelar.");
        await prisma.compromisso.update({
          where: { id: proximo.id },
          data: { status: "cancelado", motivoCancelamento: motivo ?? "Cancelado por automação" },
        });
        return ok(`Compromisso de ${proximo.dataIso} às ${proximo.hora} cancelado.`);
      } catch (erro) {
        return falha("Falha ao cancelar o compromisso.", mensagemDoErro(erro));
      }
    },

    async ocultarComentario() {
      // Sem comentário na origem não é erro: é o mesmo fluxo disparado por outro gatilho.
      if (!params.ocultarComentario) return ok("Ignorado — este disparo não veio de um comentário.");
      try {
        await params.ocultarComentario();
        return ok("Comentário ocultado.");
      } catch (erro) {
        return falha("Falha ao ocultar o comentário.", mensagemDoErro(erro));
      }
    },

    async pararOutrasAutomacoes({ contatoNome, fluxoAtualId, modo }) {
      try {
        const vivas = await execucoesVivasDoContato(workspaceId, contatoNome);
        const outras = vivas.filter((e) => e.fluxoId !== fluxoAtualId);
        if (!outras.length) return ok("Nenhuma outra automação estava rodando pra este contato.");

        for (const execucao of outras) {
          await encerrarExecucao({
            execucaoId: execucao.id,
            situacao: "cancelada",
            erroMensagem: modo === "pausar" ? "Pausada por outra automação." : "Cancelada por outra automação.",
          });
        }
        // Pausar e cancelar terminam do mesmo jeito hoje: encerram a execução. A diferença seria
        // poder RETOMAR depois, e pra isso faltaria guardar de onde retomar e quem manda retomar —
        // duas coisas que não existem. O histórico diz qual das duas a pessoa pediu, pra o dia em
        // que a retomada existir não haver dúvida sobre a intenção de quem montou o fluxo.
        return ok(`${outras.length} ${outras.length === 1 ? "automação encerrada" : "automações encerradas"} (${modo}).`);
      } catch (erro) {
        return falha("Falha ao parar as outras automações.", mensagemDoErro(erro));
      }
    },

    async escolherAtendente({ metodo }) {
      try {
        const equipe = await prisma.membro.findMany({
          where: { workspaceId, ativo: true, convitePendente: false },
          select: { nome: true },
          orderBy: { nome: "asc" },
        });
        if (!equipe.length) return falha("Não há ninguém ativo na equipe pra assumir o atendimento.");

        if (metodo === "menos_atendimentos") {
          // Quem tem menos conversa aberta assume. É o único método aqui que olha carga de verdade;
          // "disponibilidade" e "prioridade" dependem de dados que o CRM ainda não guarda.
          const contagens = await prisma.contato.groupBy({
            by: ["responsavel"],
            where: { workspaceId, responsavel: { in: equipe.map((m) => m.nome) } },
            _count: { _all: true },
          });
          const porNome = new Map(contagens.map((c) => [c.responsavel, c._count._all]));
          const escolhido = equipe.reduce((menor, atual) =>
            (porNome.get(atual.nome) ?? 0) < (porNome.get(menor.nome) ?? 0) ? atual : menor,
          );
          return ok(escolhido.nome);
        }

        // Rodízio: gira a partir de quem recebeu o último encaminhamento, pela ordem alfabética
        // (estável). Sem contador guardado, a base é quem está como responsável no contato mais
        // recente — o suficiente pra não cair sempre na mesma pessoa.
        const ultimo = await prisma.contato.findFirst({
          where: { workspaceId, responsavel: { in: equipe.map((m) => m.nome) } },
          orderBy: { atualizadoEm: "desc" },
          select: { responsavel: true },
        });
        const indiceAnterior = equipe.findIndex((m) => m.nome === ultimo?.responsavel);
        return ok(equipe[(indiceAnterior + 1) % equipe.length].nome);
      } catch (erro) {
        return falha("Falha ao escolher o atendente.", mensagemDoErro(erro));
      }
    },

    async chamarWebhook({ url, corpo }) {
      if (!/^https?:\/\//i.test(url)) return falha("Endereço do webhook inválido.");
      // Três tentativas com espera crescente. Um endereço fora do ar por dois segundos é o caso
      // comum, e sem repetição a automação perderia o evento em silêncio.
      let ultimoErro = "";
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        try {
          const resposta = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(corpo),
            signal: AbortSignal.timeout(10_000),
          });
          if (resposta.ok) return ok(`Webhook chamado (HTTP ${resposta.status}).`);
          // 4xx é erro de quem chamou: repetir daria o mesmo resultado três vezes.
          if (resposta.status < 500) return falha(`O webhook respondeu HTTP ${resposta.status}.`);
          ultimoErro = `HTTP ${resposta.status}`;
        } catch (erro) {
          ultimoErro = mensagemDoErro(erro);
        }
        if (tentativa < 3) await esperar(tentativa * 1000);
      }
      return falha("O webhook não respondeu depois de 3 tentativas.", ultimoErro);
    },

    async salvarContato({ contatoNome, dados }) {
      try {
        const { count } = await prisma.contato.updateMany({
          where: { workspaceId, nome: contatoNome },
          data: dados,
        });
        return count ? ok(descreverCampos(dados)) : falha(`Contato "${contatoNome}" não encontrado.`);
      } catch (erro) {
        return falha("Falha ao gravar no contato.", mensagemDoErro(erro));
      }
    },

    async moverEtapa({ contatoNome, funilId, etapaTitulo }) {
      try {
        // Filtra pelo workspace ANTES do funil: id de funil é adivinhável, e sem isto uma
        // automação poderia mover um card pra um funil de outro cliente.
        const etapa = await prisma.funilEtapa.findFirst({
          where: { titulo: etapaTitulo, funil: { id: funilId, workspaceId } },
          select: { id: true },
        });
        if (!etapa) return falha(`A etapa "${etapaTitulo}" não existe mais nesse funil.`);

        const card = await prisma.negocioCard.findFirst({ where: { workspaceId, nome: contatoNome }, select: { id: true } });
        if (card) {
          await prisma.negocioCard.update({ where: { id: card.id }, data: { etapaId: etapa.id, ordem: 0 } });
          return ok(`Movido para "${etapaTitulo}".`);
        }
        await prisma.negocioCard.create({
          data: {
            id: `${workspaceId}-${contatoNome}-${Date.now()}`,
            etapaId: etapa.id,
            ordem: 0,
            workspaceId,
            nome: contatoNome,
            valor: "—",
            origem: "Automação",
            dias: "Hoje",
            data: new Date().toISOString().slice(0, 10),
          },
        });
        return ok(`Card criado em "${etapaTitulo}".`);
      } catch (erro) {
        return falha("Falha ao mover no funil.", mensagemDoErro(erro));
      }
    },

    async responderComentario(texto) {
      // Sem comentário na origem não é erro: é o mesmo fluxo disparado por outro gatilho.
      if (!params.responderComentario) return ok("Ignorado — este disparo não veio de um comentário.");
      try {
        await params.responderComentario(texto);
        return ok(`Comentário respondido: "${resumir(texto)}"`);
      } catch (erro) {
        return falha("Falha ao responder o comentário.", mensagemDoErro(erro));
      }
    },

    async anotar({ contatoNome, canal, tipo, descricao, dados }) {
      await anotarNaLinhaDoTempo({ workspaceId, contatoNome, canal, tipo, descricao, dados });
    },
  };
}

/**
 * As ações do modo seco: registram a INTENÇÃO e não tocam em nada.
 *
 * É o que o botão "Testar" usa. O fluxo percorrido é o mesmo, as decisões são as mesmas, e no fim
 * a lista `intencoes` conta o que teria acontecido.
 */
export function acoesSecas(): AcoesDoMotor & { intencoes: string[] } {
  const intencoes: string[] = [];
  const registrar = (texto: string) => {
    intencoes.push(texto);
    return ok(`${texto} (simulado)`);
  };
  return {
    intencoes,
    async enviarTexto({ contatoNome, texto }) {
      return registrar(`Enviaria para ${contatoNome}: "${resumir(texto)}"`);
    },
    async perguntar({ contatoNome, texto, opcoes }) {
      return registrar(`Perguntaria para ${contatoNome}: "${resumir(textoNumerado(texto, opcoes))}"`);
    },
    async enviarMidia({ contatoNome, tipo }) {
      return registrar(`Enviaria um arquivo (${tipo}) para ${contatoNome}`);
    },
    async enviarLocalizacao({ contatoNome, nome }) {
      return registrar(`Enviaria a localização${nome ? ` de "${nome}"` : ""} para ${contatoNome}`);
    },
    async buscarContato(nome) {
      return ok(JSON.stringify({ nome }));
    },
    async linkDoFormulario({ origem, urlExterna }) {
      return ok(origem === "externo" ? (urlExterna ?? "(link externo)") : "(link do formulário)");
    },
    async enviarContato({ contatoNome, nome }) {
      return registrar(`Enviaria o contato de ${nome} para ${contatoNome}`);
    },
    async avisarEquipe({ equipe, mensagem }) {
      return registrar(`Avisaria ${equipe ? `a equipe ${equipe}` : "a equipe"}: "${resumir(mensagem)}"`);
    },
    async enviarModeloOficial({ contatoNome, templateId }) {
      return registrar(`Enviaria o modelo ${templateId} para ${contatoNome}`);
    },
    async enviarEmail({ contatoNome, assunto }) {
      return registrar(`Mandaria e-mail para ${contatoNome}: "${resumir(assunto)}"`);
    },
    async criarTarefa({ contatoNome, titulo }) {
      return registrar(`Criaria a tarefa "${resumir(titulo)}" para ${contatoNome}`);
    },
    async responderComIA({ contatoNome }) {
      // Modo seco não chama a IA: além do custo por chamada, uma simulação que gasta crédito toda
      // vez que alguém clica em "Testar" vira uma conta que ninguém entende no fim do mês.
      return registrar(`Responderia ${contatoNome} com IA`);
    },
    async classificarComIA({ categorias }) {
      const primeira = categorias.find((c) => c.trim());
      if (!primeira) return falha("O bloco de classificação está sem categorias.");
      intencoes.push(`Classificaria a conversa (no teste, assume "${primeira}")`);
      return ok(primeira);
    },
    async criarNegocio({ nome, etapaTitulo }) {
      return registrar(`Criaria o negócio "${nome}" em "${etapaTitulo}"`);
    },
    async agendarConsulta({ contatoNome, dataIso, hora }) {
      return registrar(`Marcaria consulta de ${contatoNome} em ${dataIso} às ${hora}`);
    },
    async cancelarAgendamento({ contatoNome }) {
      return registrar(`Cancelaria o próximo compromisso de ${contatoNome}`);
    },
    async ocultarComentario() {
      return registrar("Ocultaria o comentário");
    },
    async pararOutrasAutomacoes({ modo }) {
      return registrar(`${modo === "pausar" ? "Pausaria" : "Cancelaria"} as outras automações deste contato`);
    },
    async escolherAtendente({ equipe }) {
      return registrar(`Escolheria um atendente${equipe ? ` da equipe ${equipe}` : ""}`);
    },
    async chamarWebhook({ url }) {
      return registrar(`Chamaria o webhook ${url}`);
    },
    async salvarContato({ contatoNome, dados }) {
      return registrar(`Gravaria em ${contatoNome}: ${descreverCampos(dados)}`);
    },
    async moverEtapa({ contatoNome, etapaTitulo }) {
      return registrar(`Moveria ${contatoNome} para "${etapaTitulo}"`);
    },
    async responderComentario(texto) {
      return registrar(`Responderia o comentário: "${resumir(texto)}"`);
    },
    async anotar() {
      /* histórico do lead não é escrito em simulação */
    },
  };
}

const NOME_DO_FORMATO = {
  botoes: "botões",
  lista: "lista",
  respostas_rapidas: "respostas rápidas",
  numerado: "menu numerado",
} as const;

/** As últimas mensagens da conversa, em ordem — o contexto que a IA lê. */
async function ultimasMensagens(workspaceId: string, contatoNome: string) {
  const linhas = await prisma.mensagemExtra.findMany({
    where: { workspaceId, contato: contatoNome },
    orderBy: { criadoEm: "desc" },
    take: 20,
    select: { tipo: true, texto: true },
  });
  return linhas.reverse();
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "??";
}

function resumir(texto: string): string {
  const limpo = texto.trim().replace(/\s+/g, " ");
  return limpo.length > 80 ? `${limpo.slice(0, 77)}…` : limpo;
}

function descreverCampos(dados: Record<string, unknown>): string {
  const partes = Object.entries(dados).map(([chave, valor]) =>
    Array.isArray(valor) ? `${chave}: ${valor.join(", ")}` : `${chave}: ${String(valor)}`,
  );
  return partes.join(" · ") || "nada a gravar";
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
