// Tira foto, áudio e vídeo de dentro do banco e leva pro Cloudflare R2.
//
// Rode com: npx tsx scripts/migrar-midias-para-r2.ts
// Só pra ver quanto tem, sem mover nada: npx tsx scripts/migrar-midias-para-r2.ts --contar
//
// POR QUE ISTO EXISTE — a linha de EGRESS da fatura da Railway.
//
// Mensagem antiga guarda o anexo INTEIRO, em base64, dentro da coluna `extras`. A tela de Conversas
// carrega as 3.000 mensagens mais recentes do workspace de uma vez, e faz isso de novo toda vez que
// chega mensagem nova. Cada uma dessas cargas puxa do banco todos esses arquivos, que a aplicação
// descarta na hora (o navegador só recebe um link, ver `midia-mensagem.ts`). Ou seja: megabytes
// saindo do banco a cada carga, pagos por gigabyte, pra serem jogados fora.
//
// Mensagem nova já não faz isso: o anexo vai pro R2 e no banco fica só a referência `r2:<chave>`,
// com uns 60 bytes. Este script faz o mesmo com o que já estava gravado. Depois dele, a linha da
// mensagem no banco pesa o que pesa o texto dela, e a carga da tela fica leve pra sempre.
//
// SEGURANÇA DA OPERAÇÃO:
// - Uma mensagem por vez, e cada uma só é reescrita DEPOIS que o arquivo já está no R2. Se a subida
//   falhar, a mensagem fica como estava (com o base64), e o script avisa. Nada se perde.
// - Pode ser interrompido e rodado de novo quantas vezes precisar: mensagem já migrada não tem
//   mais data URL e não entra na lista.
// - Precisa das variáveis do R2 (`R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`,
//   `R2_SECRET_ACCESS_KEY`) no `.env`, além da `DATABASE_URL`. São as mesmas que estão na Vercel.
import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
import { r2Configurado } from "../src/lib/armazenamento/r2";
import { guardarMidiasDosExtras } from "../src/lib/armazenamento/midia";

setDefaultResultOrder("ipv4first");

const soContar = process.argv.includes("--contar");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não encontrada — confira se o arquivo .env existe na raiz do projeto.");
  process.exit(1);
}
if (!soContar && !r2Configurado()) {
  console.error("As variáveis do R2 não estão no .env (R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).");
  console.error("Copie da Vercel: projeto do CRM → Settings → Environment Variables. Sem elas não há pra onde mover.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL) });

/**
 * A busca é feita pelo BANCO, com `JSON_SEARCH`, e traz só o id e o tamanho. Trazer `extras` de
 * todas as mensagens pra decidir aqui quais têm data URL seria justamente o tráfego que este
 * script existe pra eliminar — e faria a migração custar, sozinha, mais uma carga inteira.
 *
 * Sem `ORDER BY` de propósito: ordenar obriga o MySQL a passar as linhas (com o JSON gigante
 * dentro) pelo buffer de ordenação, que é pequeno — e ele responde `1038 Out of sort memory`.
 * A ordem não importa pra migrar.
 */
async function listarPendentes(): Promise<{ id: string; workspaceId: string; bytes: number }[]> {
  return prisma.$queryRawUnsafe<{ id: string; workspaceId: string; bytes: number }[]>(
    `SELECT id, workspaceId, LENGTH(extras) AS bytes
       FROM MensagemExtra
      WHERE extras IS NOT NULL
        AND JSON_SEARCH(extras, 'one', 'data:%') IS NOT NULL`,
  ).then((linhas) => linhas.map((l) => ({ id: l.id, workspaceId: l.workspaceId, bytes: Number(l.bytes) })));
}

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

async function main() {
  const pendentes = await listarPendentes();
  const totalBytes = pendentes.reduce((soma, p) => soma + p.bytes, 0);

  console.log(`Destino: ${process.env.DATABASE_URL!.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`${pendentes.length} mensagem(ns) com anexo embutido, ${mb(totalBytes)} MB dentro do banco.`);
  // Por workspace: o botão "Mover para a nuvem" em Configurações → Plano só enxerga o workspace
  // de quem está logado. Saber ONDE as mensagens estão diz em qual conta apertar o botão.
  const porWorkspace = new Map<string, { n: number; bytes: number }>();
  for (const p of pendentes) {
    const atual = porWorkspace.get(p.workspaceId) ?? { n: 0, bytes: 0 };
    porWorkspace.set(p.workspaceId, { n: atual.n + 1, bytes: atual.bytes + p.bytes });
  }
  for (const [workspaceId, w] of porWorkspace) {
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { nome: true } });
    console.log(`  ${String(w.n).padStart(5)} × workspace "${ws?.nome ?? workspaceId}"  (${mb(w.bytes)} MB)`);
  }
  console.log("");

  if (!pendentes.length) {
    console.log("✓ Nada a migrar. Todos os anexos já estão fora do banco.");
    return;
  }
  if (soContar) {
    console.log("(--contar: nada foi movido. Rode sem a opção pra migrar.)");
    return;
  }

  let migradas = 0;
  let falhas = 0;
  let bytesLiberados = 0;

  for (const [i, pendente] of pendentes.entries()) {
    const mensagem = await prisma.mensagemExtra.findUnique({
      where: { id: pendente.id },
      select: { id: true, workspaceId: true, extras: true },
    });
    if (!mensagem?.extras) continue;

    // `guardarMidiasDosExtras` devolve a data URL de volta quando a subida falha (nunca perde o
    // arquivo). Então "migrou" é: o resultado não tem mais data URL nenhuma. Se ainda tem, alguma
    // subida falhou, e a mensagem NÃO é reescrita — evita gravar meio migrada.
    const extrasNovos = await guardarMidiasDosExtras(mensagem.extras, mensagem.workspaceId);
    const aindaTemDataUrl = JSON.stringify(extrasNovos).includes('"data:');
    if (aindaTemDataUrl) {
      falhas++;
      console.error(`  ✗ ${i + 1}/${pendentes.length} ${mensagem.id}: subida pro R2 falhou, mensagem mantida como estava`);
      continue;
    }

    await prisma.mensagemExtra.update({
      where: { id: mensagem.id },
      // `extras` é Json: o Prisma aceita o objeto direto.
      data: { extras: extrasNovos as object },
    });
    migradas++;
    bytesLiberados += pendente.bytes;
    if ((i + 1) % 25 === 0 || i + 1 === pendentes.length) {
      console.log(`  ${String(i + 1).padStart(5)}/${pendentes.length} migradas, ${mb(bytesLiberados)} MB liberados do banco`);
    }
  }

  console.log(`\n✓ ${migradas} mensagem(ns) migradas, ${mb(bytesLiberados)} MB fora do banco.`);
  if (falhas) {
    console.error(`⚠ ${falhas} falharam e ficaram como estavam. Rode o script de novo mais tarde; ele só pega o que faltou.`);
    process.exit(1);
  }
  console.log("  Abra uma conversa antiga com foto ou áudio e confira que o anexo continua abrindo.");
}

main()
  .catch((erro) => {
    console.error("\n✗ A migração NÃO foi concluída:", erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
