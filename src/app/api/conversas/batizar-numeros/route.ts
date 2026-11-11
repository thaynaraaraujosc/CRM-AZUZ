import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { nomeAindaEhIdCru } from "@/lib/conversas/exibicao";
import { nomeDePerfilNoHistorico } from "@/lib/conversas/nome-do-historico";
import { renomearConversa } from "@/lib/conversas/renomear";
import { conexoesLigadas, slotDaConversa } from "@/lib/integracoes/conexoes-whatsapp";
import { buscarMensagensDoChat } from "@/lib/integracoes/evolution";
import { prisma } from "@/lib/prisma";

/**
 * DÁ NOME ÀS CONVERSAS QUE JÁ ESTÃO NO CRM COMO NÚMERO.
 *
 * O batismo pelo nome de perfil acontece quando a mensagem chega, então ele conserta o futuro: a
 * conversa que já existe só é batizada quando aquela pessoa escrever de novo. "Eu queria entender
 * se só vai aparecer agora o nome em números que chegar na mensagem nova, porque os que estão lá
 * não mudou." Esta rota é o passado.
 *
 * COMO ELA SABE O NOME. No QR Code as mensagens antigas continuam no aparelho, e cada mensagem
 * RECEBIDA carrega o `pushName` de quem escreveu. Então pra cada conversa ainda chamada pelo
 * número, o CRM pede o histórico daquele chat e lê o nome ali.
 *
 * NÃO VALE PRA API OFICIAL, e isso não é uma escolha: o nome de perfil só existe dentro do webhook
 * da mensagem, e a Meta não tem endereço que devolva "qual é o nome de exibição deste telefone".
 * Nessas conversas, só a próxima mensagem batiza — ou alguém renomeia à mão.
 *
 * EM LOTES, de propósito. É uma chamada à Evolution por conversa, e uma função serverless tem
 * minuto contado: trinta por vez terminam rápido e a tela chama de novo enquanto sobrar. Melhor
 * um botão que anda do que um que estoura no meio e não diz o que já fez.
 */
const POR_RODADA = 30;

export async function POST() {
  const sessao = await auth();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  const workspaceId = sessao.user.workspaceId;

  const ligadas = await conexoesLigadas(workspaceId);
  if (!ligadas.length) {
    return NextResponse.json({ erro: "Nenhum número de WhatsApp conectado agora." }, { status: 409 });
  }

  /*
   * SÓ CONVERSA INDIVIDUAL DE WHATSAPP, e só a que ainda se chama pelo número.
   *
   * A filtragem fina (`nomeAindaEhIdCru`) roda aqui e não no banco porque a regra é uma só e já
   * está escrita — duplicá-la como expressão de SQL é como as duas passam a discordar.
   */
  const candidatas = await prisma.conversa.findMany({
    where: { workspaceId, ehGrupo: false, canal: "WhatsApp", contato: { not: null } },
    select: { nome: true, contato: true, contaCanal: true },
  });

  const alvos = candidatas.filter((c) => nomeAindaEhIdCru(c.nome));
  const doLote = alvos.slice(0, POR_RODADA);

  let batizadas = 0;
  let semNome = 0;
  for (const conversa of doLote) {
    const slot = slotDaConversa(ligadas, conversa.contaCanal);
    // Conversa de um número que não está ligado agora (ou da API oficial): não há de onde ler o
    // histórico. Fica pra outra vez, sem virar erro.
    if (slot === null || !conversa.contato) {
      semNome += 1;
      continue;
    }
    const jid = conversa.contato.includes("@") ? conversa.contato : `${conversa.contato}@s.whatsapp.net`;
    const historico = await buscarMensagensDoChat(workspaceId, jid, 50, slot).catch(() => []);
    const nome = nomeDePerfilNoHistorico(historico);
    if (!nome) {
      semNome += 1;
      continue;
    }
    try {
      await renomearConversa(workspaceId, conversa.nome, nome);
      batizadas += 1;
    } catch {
      // Nome que acabou de ser ocupado por outra pessoa, corrida com uma mensagem que chegou
      // agora: o número continua valendo, e a próxima rodada tenta de novo.
      semNome += 1;
    }
  }

  return NextResponse.json({
    batizadas,
    semNome,
    restam: Math.max(0, alvos.length - doLote.length),
  });
}
