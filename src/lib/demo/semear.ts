import type { PrismaClient } from "@/generated/prisma/client";

import {
  CONTATOS_DEMO,
  CONVERSAS_DEMO,
  EMAIL_DEMO,
  EMPRESA_DEMO,
  ETAPAS_DEMO,
  FECHADOS_DEMO,
  TAREFAS_DEMO,
  WORKSPACE_DEMO,
  iniciais,
  telefoneDemo,
} from "@/lib/demo/dados-demo";

/**
 * A escrita da conta de demonstração, separada da rota HTTP de propósito.
 *
 * A rota não dá pra testar sem sessão, sem super-admin e sem servidor de pé, então na prática ela
 * nunca era exercitada antes de ir pro ar. E esta função APAGA e recria um workspace inteiro: é
 * exatamente o tipo de código que não pode estrear em produção.
 *
 * Aqui ela recebe o cliente Prisma por parâmetro e roda contra qualquer banco, inclusive um
 * MariaDB local descartável. Ver `__tests__/semear.test.ts`.
 *
 * Duas quedas do CRM em dois dias vieram de mudança que tinha teste de unidade passando e nunca
 * tinha tocado num banco de verdade. Esta separação existe por causa disso.
 */

/** Identificadores das conexões fictícias. Ficam aqui porque a marca gravada em cada conversa
 *  precisa casar exatamente com o que a conexão declara, senão o filtro esconde tudo. */
const CONTA_WHATSAPP_DEMO = "demo-whatsapp";
const CONTA_INSTAGRAM_DEMO = "demo-instagram";

function contaDoCanal(canal: "WhatsApp" | "Instagram"): string {
  return canal === "WhatsApp"
    ? `meta_whatsapp:${CONTA_WHATSAPP_DEMO}`
    : `meta_instagram:${CONTA_INSTAGRAM_DEMO}`;
}

function horaDe(data: Date): string {
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function diaDe(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * Apaga a conta de demonstração e a recria do zero.
 *
 * `senhaHash` chega pronta: gerar hash é lento e não pertence a uma transação de banco aberta.
 */
export async function semearDemo(cliente: PrismaClient, senhaHash: string, agora = new Date()): Promise<void> {
  await cliente.$transaction(
    async (tx) => {
      // Limpeza. Cada `deleteMany` é amarrado ao workspace da demonstração; nenhum roda solto.
      const noDemo = { workspaceId: WORKSPACE_DEMO };
      await tx.mensagemExtra.deleteMany({ where: noDemo });
      await tx.conversa.deleteMany({ where: noDemo });
      await tx.tarefaCard.deleteMany({ where: noDemo });
      await tx.tarefaEtapa.deleteMany({ where: noDemo });
      await tx.negocioCard.deleteMany({ where: noDemo });
      await tx.funilEtapa.deleteMany({ where: noDemo });
      await tx.funil.deleteMany({ where: noDemo });
      await tx.contato.deleteMany({ where: noDemo });
      await tx.integracao.deleteMany({ where: noDemo });

      await tx.workspace.upsert({
        where: { id: WORKSPACE_DEMO },
        create: { id: WORKSPACE_DEMO, nome: EMPRESA_DEMO, slug: WORKSPACE_DEMO, segmento: "Saúde e estética" },
        update: { nome: EMPRESA_DEMO },
      });

      // Assinatura ativa: sem isso o paywall manda a demonstração pra tela de pagamento, que é o
      // pior primeiro quadro possível num vídeo de apresentação.
      await tx.assinatura.upsert({
        where: { workspaceId: WORKSPACE_DEMO },
        create: {
          id: `assinatura-${WORKSPACE_DEMO}`,
          workspaceId: WORKSPACE_DEMO,
          plano: "profissional",
          valor: 0,
          status: "ativa",
          asaasCustomerId: "",
        },
        update: { status: "ativa" },
      });

      await tx.membro.upsert({
        where: { email: EMAIL_DEMO },
        create: {
          id: `demo-${WORKSPACE_DEMO}`,
          workspaceId: WORKSPACE_DEMO,
          initials: "CV",
          nome: "Equipe Vitta",
          email: EMAIL_DEMO,
          senha: senhaHash,
          papel: "Administrador",
          papelTipo: "admin",
          leads: "-",
          enxerga: "Tudo",
          permissoes: [],
          ativo: true,
          convitePendente: false,
        },
        update: { senha: senhaHash, ativo: true, convitePendente: false, workspaceId: WORKSPACE_DEMO },
      });

      /*
       * As conexões de canal da demonstração.
       *
       * Sem isto a caixa de entrada ESCONDE toda conversa de WhatsApp: a tela só mostra conversa
       * de canal conectado, e uma demonstração sem conexão nenhuma abria vazia, com aviso de
       * "conecte um canal". A tela principal do produto, a que mais aparece numa venda e no vídeo,
       * era justamente a que não dava pra mostrar.
       *
       * `accessTokenCriptografado` fica NULO de propósito, e isso é o que torna a conexão segura:
       * todo trabalho automático que fala com a Meta pula conexão sem token (ver a rota de saúde
       * do WhatsApp). Então a demonstração aparece conectada na tela e nunca dispara uma chamada
       * de verdade, nem gera erro no log, nem consome cota de API.
       */
      await tx.integracao.create({
        data: {
          id: `integracao-wa-${WORKSPACE_DEMO}`,
          workspaceId: WORKSPACE_DEMO,
          provedor: "meta_whatsapp",
          status: "conectado",
          accessTokenCriptografado: null,
          metadados: { phoneNumberId: CONTA_WHATSAPP_DEMO, numero: "(11) 90880-0000", demonstracao: true },
        },
      });

      await tx.integracao.create({
        data: {
          id: `integracao-ig-${WORKSPACE_DEMO}`,
          workspaceId: WORKSPACE_DEMO,
          provedor: "meta_instagram",
          status: "conectado",
          accessTokenCriptografado: null,
          metadados: { instagramContaId: CONTA_INSTAGRAM_DEMO, usuario: "clinicaaurora", demonstracao: true },
        },
      });

      // Funil e etapas.
      const funilId = `funil-${WORKSPACE_DEMO}`;
      await tx.funil.create({
        data: { id: funilId, workspaceId: WORKSPACE_DEMO, nome: "Comercial", responsavel: "Paula Mendes" },
      });
      const etapaIdPorTitulo = new Map<string, string>();
      for (const [ordem, titulo] of ETAPAS_DEMO.entries()) {
        const id = `${funilId}-${ordem}`;
        etapaIdPorTitulo.set(titulo, id);
        await tx.funilEtapa.create({ data: { id, funilId, workspaceId: WORKSPACE_DEMO, titulo, ordem } });
      }

      // Contatos, conversas, mensagens e cards de funil.
      for (const [indice, contato] of CONTATOS_DEMO.entries()) {
        const contatoId = `demo-contato-${indice}`;
        const whatsapp = telefoneDemo(indice);

        await tx.contato.create({
          data: {
            id: contatoId,
            workspaceId: WORKSPACE_DEMO,
            initials: iniciais(contato.nome),
            nome: contato.nome,
            origem: contato.origem,
            etapa: contato.etapa,
            responsavel: contato.responsavel,
            ultima: contato.ultima,
            valor: contato.valor,
            email: contato.email,
            whatsapp,
            cidade: contato.cidade,
            estado: "SP",
            pais: "Brasil",
            canalPreferido: contato.canal,
          },
        });

        await tx.conversa.create({
          data: {
            id: `demo-conversa-${indice}`,
            workspaceId: WORKSPACE_DEMO,
            contatoId,
            nome: contato.nome,
            initials: iniciais(contato.nome),
            canal: contato.canal,
            contato: contato.canal === "WhatsApp" ? whatsapp : `@${contato.nome.split(" ")[0].toLowerCase()}`,
            origem: contato.origem,
            status: "Respondido",
            // Sem a marca da conexão dona, o filtro da caixa de entrada não reivindica a conversa
            // e ela fica gravada e invisível.
            contaCanal: contaDoCanal(contato.canal),
          },
        });

        const mensagens = CONVERSAS_DEMO[contato.nome] ?? [];
        for (const [i, mensagem] of mensagens.entries()) {
          const quando = new Date(agora.getTime() - mensagem.minutosAtras * 60_000);
          await tx.mensagemExtra.create({
            data: {
              id: `demo-msg-${indice}-${i}`,
              workspaceId: WORKSPACE_DEMO,
              contato: contato.nome,
              tipo: mensagem.de === "cliente" ? "in" : "out",
              texto: mensagem.texto,
              hora: horaDe(quando),
              criadoEm: quando,
              canal: contato.canal,
              contaCanal: contaDoCanal(contato.canal),
              status: mensagem.de === "empresa" ? "lida" : null,
            },
          });
        }

        const etapaId = etapaIdPorTitulo.get(contato.etapa);
        if (etapaId) {
          await tx.negocioCard.create({
            data: {
              id: `demo-card-${indice}`,
              etapaId,
              ordem: indice,
              workspaceId: WORKSPACE_DEMO,
              nome: contato.nome,
              valor: contato.valor,
              origem: contato.origem,
              dias: String((indice % 9) + 1),
              data: diaDe(new Date(agora.getTime() - ((indice % 9) + 1) * 86_400_000)),
              responsavel: contato.responsavel,
            },
          });
        }
      }

      // Negócios já encerrados, que alimentam Motivos de perda e Performance. Ficam na última
      // etapa porque já saíram do fluxo; o que importa deles é `statusFechamento`.
      const etapaFinal = etapaIdPorTitulo.get(ETAPAS_DEMO[ETAPAS_DEMO.length - 1])!;
      for (const [i, fechado] of FECHADOS_DEMO.entries()) {
        await tx.negocioCard.create({
          data: {
            id: `demo-fechado-${i}`,
            etapaId: etapaFinal,
            ordem: 100 + i,
            workspaceId: WORKSPACE_DEMO,
            nome: fechado.nome,
            valor: fechado.valor,
            origem: "Instagram",
            dias: "0",
            data: diaDe(new Date(agora.getTime() - (i + 2) * 86_400_000)),
            responsavel: "Paula Mendes",
            statusFechamento: fechado.status,
            motivoPerda: fechado.motivo,
            dataFechamento: new Date(agora.getTime() - (i + 2) * 86_400_000),
          },
        });
      }

      // Tarefas.
      const etapaTarefaId = `demo-tarefa-etapa`;
      await tx.tarefaEtapa.create({
        data: { id: etapaTarefaId, workspaceId: WORKSPACE_DEMO, titulo: "A fazer", ordem: 0 },
      });
      for (const [i, tarefa] of TAREFAS_DEMO.entries()) {
        const vencimento = new Date(agora.getTime() + tarefa.diasAteOVencimento * 86_400_000);
        await tx.tarefaCard.create({
          data: {
            id: `demo-tarefa-${i}`,
            etapaId: etapaTarefaId,
            ordem: i,
            workspaceId: WORKSPACE_DEMO,
            titulo: tarefa.titulo,
            contato: tarefa.contato,
            data: diaDe(vencimento),
            atrasada: tarefa.diasAteOVencimento < 0 && !tarefa.concluida,
            responsavelNome: tarefa.responsavel,
            responsavelInitials: iniciais(tarefa.responsavel),
            concluida: tarefa.concluida,
            urgencia: tarefa.urgencia,
            descricao: tarefa.descricao,
          },
        });
      }
    },
    // Semear é muito `create` em sequência. O padrão do Prisma (5s) estoura e a transação volta
    // atrás inteira, deixando a conta pela metade sem dizer por quê.
    { timeout: 60_000, maxWait: 15_000 },
  );
}
