import { prisma } from "@/lib/prisma";

import { avisarQueEntrouNaEtapa } from "@/lib/funil/entrou-na-etapa";
import { cardDoContatoNoFunil, entrarNaPrimeiraEtapaComoNovoLead } from "@/lib/funis/upsert";
import { escolherCanalDoFlow } from "@/lib/integracoes/azuz-flow-canal";
import { conexoesDeWhatsappDoWorkspace } from "@/lib/integracoes/azuz-flow-conexoes";
import { configDoFlow } from "@/lib/integracoes/azuz-flow-config";
import { encontrarContatoPorTelefone } from "@/lib/contatos/upsert";
import { upsertConversaAoReceberMensagem } from "@/lib/conversas/upsert";
import { normalizarTelefoneParaComparacao } from "@/lib/telefone";
import { slugId } from "@/lib/ids";

import type { DependenciasDaLista } from "./azuz-flow-lista";

/**
 * As dependências de verdade da lista do Flow: as mesmas funções que o resto do CRM usa.
 *
 * Nada de implementação nova aqui — achar contato por telefone, criar conversa, garantir card e
 * disparar gatilho de etapa já existem e já foram corrigidos uma vez cada. Reescrever qualquer uma
 * delas aqui criaria uma segunda resposta pra mesma pergunta, e as duas divergem na primeira
 * correção feita só de um lado. Este arquivo é fiação, não regra.
 */
export function dependenciasReaisDaLista(workspaceId: string): DependenciasDaLista {
  return {
    /**
     * O DESTINO TEM QUE SER DESTA EMPRESA, e a etapa tem que ser daquele funil.
     *
     * Funil de outra empresa é 422 com "não encontrei", nunca "encontrado" — responder qualquer
     * outra coisa contaria a quem perguntou que aquele id existe em algum lugar.
     */
    async conferirDestino(funilId, etapaId) {
      const etapa = await prisma.funilEtapa.findFirst({
        where: { id: etapaId, funil: { workspaceId } },
        select: { funilId: true },
      });
      if (!etapa) return { ok: false, erro: "Não encontrei essa etapa nesta empresa." };
      if (etapa.funilId !== funilId) return { ok: false, erro: "Essa etapa não é do funil escolhido." };
      return { ok: true };
    },

    async acharContatoPorTelefone(telefone) {
      // A regra brasileira (nono dígito) mora em `encontrarContatoPorTelefone`, com teste: o mesmo
      // número chega com e sem o 9 conforme o caminho, e comparar cru criava dois contatos.
      const achado = await encontrarContatoPorTelefone(workspaceId, telefone);
      return achado ? { id: achado.id, nome: achado.nome } : null;
    },
    async acharContatoPorEmail(email) {
      // Comparação em memória: o conjunto por workspace é pequeno, e MySQL com collation sensível
      // a caixa deixaria passar o mesmo e-mail com outra grafia — a duplicata que se quer evitar.
      const candidatos = await prisma.contato.findMany({
        where: { workspaceId, email: { not: null } },
        select: { id: true, nome: true, email: true },
      });
      const alvo = email.toLowerCase();
      const achado = candidatos.find((c) => c.email?.toLowerCase() === alvo);
      return achado ? { id: achado.id, nome: achado.nome } : null;
    },
    async acharContatoPorNome(nome) {
      const achado = await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
        select: { id: true, nome: true },
      });
      return achado ?? null;
    },
    async lerContato(nome) {
      return (await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
      })) as Record<string, unknown> | null;
    },
    async nomeOcupado(nome) {
      const achado = await prisma.contato.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
        select: { id: true },
      });
      return Boolean(achado);
    },
    async criarContato(dados) {
      const { nome, ...resto } = dados;
      const criado = await prisma.contato.create({
        data: {
          id: `${workspaceId}-${slugId(nome)}`,
          workspaceId,
          initials: iniciaisDe(nome),
          nome,
          origem: (resto.origem as string) ?? "AZUZ Flow",
          etapa: "Novo",
          responsavel: "-",
          ultima: "Agora",
          valor: "-",
          ...(resto as object),
        },
      });
      return { id: criado.id, nome: criado.nome };
    },
    async atualizarContato(nome, dados) {
      await prisma.contato.update({ where: { workspaceId_nome: { workspaceId, nome } }, data: dados });
    },

    /**
     * A CONVERSA, pra a automação da etapa ter por onde falar.
     *
     * `contarComoNaoLida: false` faz dois trabalhos: a conversa nova nasce sem badge (ninguém
     * escreveu) e a que já existia não é tocada — um envio de lista não desarquiva conversa nem
     * marca não lida.
     */
    async garantirConversa({ nome, telefone, contatoId }) {
      const [config, conexoes] = await Promise.all([
        configDoFlow(workspaceId),
        conexoesDeWhatsappDoWorkspace(workspaceId),
      ]);
      const escolha = escolherCanalDoFlow(config.canal, conexoes);
      if (!escolha.conexao) {
        return { erro: escolha.aviso ?? "Nenhum WhatsApp conectado: a automação pode não conseguir enviar." };
      }

      /*
       * A CONVERSA QUE JÁ EXISTE MANTÉM O DONO DELA. `upsertConversaAoReceberMensagem` sobrescreve
       * `contaCanal` quando recebe um — é assim que conversa antiga ganha dono —, e aqui isso
       * seria estrago: quem já fala com a empresa pelo número oficial veria a conversa mudar de
       * canal por ter sido incluído numa lista.
       */
      const jaExiste = await prisma.conversa.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
        select: { id: true },
      });

      await upsertConversaAoReceberMensagem({
        workspaceId,
        nome,
        canal: "WhatsApp",
        contato: normalizarTelefoneParaComparacao(telefone),
        contatoId,
        origem: "AZUZ Flow",
        contaCanal: jaExiste ? null : escolha.contaCanal,
        contarComoNaoLida: false,
      });

      const conversa = await prisma.conversa.findUnique({
        where: { workspaceId_nome: { workspaceId, nome } },
        select: { id: true },
      });
      return conversa ? { id: conversa.id } : null;
    },

    async cardNoFunil(contatoNome, funilId) {
      const card = await cardDoContatoNoFunil(workspaceId, contatoNome, funilId);
      return card ? { id: card.id, etapaId: card.etapaId } : null;
    },
    async criarCard({ contatoNome, funilId, etapaId, origem }) {
      /*
       * A MESMA função que o webhook usa. Ela já sabe recusar grupo e conversa arquivada, já
       * garante um card por contato por funil e já sabe perder uma corrida sem estourar — três
       * coisas que uma implementação nova aqui teria que aprender de novo, provavelmente na
       * produção de alguém.
       */
      const card = await entrarNaPrimeiraEtapaComoNovoLead({
        workspaceId,
        contatoNome,
        origem,
        funilId,
        etapaId,
      });
      return card ? { id: card.id, etapaId: card.etapaId } : null;
    },
    async moverCard({ cardId, etapaId }) {
      // Entra no TOPO da coluna de destino, como o card arrastado: quem acabou de chegar é o que
      // precisa ser visto primeiro.
      const primeiro = await prisma.negocioCard.findFirst({
        where: { etapaId, workspaceId },
        orderBy: { ordem: "asc" },
        select: { ordem: true },
      });
      await prisma.negocioCard.update({
        where: { id: cardId },
        data: { etapaId, ordem: primeiro ? primeiro.ordem - 1 : 0 },
      });
    },

    /**
     * OS GATILHOS DA ETAPA, e só eles.
     *
     * É o mesmo caminho que o arrastar usa (`/api/funis/mover`) — não uma cópia. Sem isto a
     * agência monta o robô na etapa e ele nunca roda, que é pior do que não ter a opção: ela só
     * descobre dias depois, pelo silêncio.
     *
     * `formulario_preenchido`, `lead_entrou_etapa` e a confirmação de reunião ficam de fora de
     * propósito. Lista não é formulário, e ninguém marcou reunião aqui.
     */
    async dispararGatilhoDaEtapa({ etapaId, contatoNome, evento }) {
      // Pela porta única, igual ao arrastar na tela e ao robô: a lista repete chamada por desenho
      // (ela é idempotente de propósito), e a trava por minuto é o que impede a mesma entrada de
      // disparar duas vezes.
      await avisarQueEntrouNaEtapa({ workspaceId, etapaId, contatoNome, evento });
    },
  };
}

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
  return (primeira + ultima).toUpperCase() || "?";
}
