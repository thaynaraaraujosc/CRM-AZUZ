// Script de uso único — limpa o que floodou o banco na primeira conexão do WhatsApp não oficial
// (Evolution API trouxe TODO o histórico do celular de uma vez, antes da correção que só aceita
// mensagem recente). Apaga só o que nasceu desse flood: mensagens com canal "whatsapp_nao_oficial",
// os contatos que a Evolution criou sozinha a partir delas (criadoVia="whatsapp"), as conversas e
// os cards de negócio ligados a esses contatos. Não toca em nada criado manualmente, nem nas
// mensagens/contatos que já existiam antes desse flood.
// Rode com: npx tsx scripts/limpar-flood-whatsapp-nao-oficial.ts
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

setDefaultResultOrder("ipv4first");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada — confira se o arquivo .env existe na raiz do projeto.");
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL!.replace(/^mysql:\/\//, "mariadb://");
  const adapter = new PrismaMariaDb(url);
  const prisma = new PrismaClient({ adapter });

  const contatosDoFlood = await prisma.contato.findMany({
    where: { criadoVia: "whatsapp" },
    select: { id: true, nome: true, workspaceId: true },
  });
  const nomesDoFlood = contatosDoFlood.map((c) => c.nome);
  const idsDoFlood = contatosDoFlood.map((c) => c.id);

  console.log(`Contatos criados pelo flood: ${contatosDoFlood.length}`);

  const mensagens = await prisma.mensagemExtra.deleteMany({ where: { canal: "whatsapp_nao_oficial" } });
  console.log(`Mensagens apagadas (canal whatsapp_nao_oficial): ${mensagens.count}`);

  if (nomesDoFlood.length > 0) {
    const negocios = await prisma.negocioCard.deleteMany({ where: { nome: { in: nomesDoFlood } } });
    console.log(`Cards de negócio apagados (leads criados pelo flood): ${negocios.count}`);

    const conversas = await prisma.conversa.deleteMany({ where: { contatoId: { in: idsDoFlood } } });
    console.log(`Conversas apagadas: ${conversas.count}`);

    const contatos = await prisma.contato.deleteMany({ where: { id: { in: idsDoFlood } } });
    console.log(`Contatos apagados: ${contatos.count}`);
  }

  console.log("Limpeza concluída — o número continua conectado, só o histórico importado errado saiu.");
  await prisma.$disconnect();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
