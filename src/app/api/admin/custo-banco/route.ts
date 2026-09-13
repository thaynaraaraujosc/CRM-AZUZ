import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { exigirSuperAdmin } from "@/lib/admin/guard";

/**
 * De onde vem a conta de egresso do banco.
 *
 * Existe por causa de uma fatura que não fechava: o Railway cobrou 87 GB de saída do MySQL num
 * ciclo em que o produto ainda não tinha nenhum cliente pagante. Sem cliente não há aba aberta,
 * então a explicação fácil (o polling das telas) não se sustentava, e as três hipóteses que eu
 * levantei olhando só o código estavam erradas. Adivinhar de novo sairia mais caro que medir.
 *
 * O MySQL já contabiliza tudo isso sozinho, desde que subiu. Esta rota só pergunta e faz as
 * divisões que interessam:
 *
 * - `Bytes_sent / Uptime` dá a vazão real de saída. É esse número que o Railway cobra.
 * - `Bytes_sent / (Com_select + ...)` dá o peso MÉDIO de uma resposta. É o que separa os dois
 *   mundos possíveis: "muitas consultas pequenas" (problema de frequência, se resolve com cache e
 *   ETag) e "poucas consultas gigantes" (problema de payload, se resolve com `select` e `take`).
 *   Sem essa divisão não dá pra saber qual dos dois consertos é o certo.
 * - O tamanho de cada tabela mostra onde o volume mora, e serve de teto de sanidade: nenhuma
 *   consulta pode devolver mais do que a tabela inteira tem.
 * - `innodb_buffer_pool_size` explica a OUTRA metade da fatura, que é memória: o MySQL estica o
 *   buffer pool até ocupar a RAM que a máquina oferecer, e no Railway a RAM ocupada é cobrada por
 *   GB. O banco engorda sozinho e a fatura acompanha, sem ninguém ter feito nada.
 *
 * Somente leitura, e só super-admin: nenhuma linha de dado de cliente sai daqui, só contadores do
 * servidor e nomes de tabela.
 */
export const dynamic = "force-dynamic";

type LinhaStatus = { Variable_name: string; Value: string };
type LinhaTabela = { tabela: string; linhas: bigint | number; bytes: bigint | number };

function numero(valor: bigint | number | string | null | undefined): number {
  return valor == null ? 0 : Number(valor);
}

/** "1,23 GB" em vez de 1321205760, que ninguém lê. */
function legivel(bytes: number): string {
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i += 1;
  }
  return `${valor.toFixed(2)} ${unidades[i]}`;
}

export async function GET() {
  const guarda = await exigirSuperAdmin();
  if (!guarda.ok) return guarda.resposta;

  const status = await prisma.$queryRawUnsafe<LinhaStatus[]>(
    `SHOW GLOBAL STATUS WHERE Variable_name IN
     ('Bytes_sent','Bytes_received','Uptime','Com_select','Questions','Connections',
      'Threads_connected','Aborted_connects','Innodb_buffer_pool_bytes_data')`,
  );
  const s = Object.fromEntries(status.map((l) => [l.Variable_name, Number(l.Value)]));

  const variaveis = await prisma.$queryRawUnsafe<LinhaStatus[]>(
    `SHOW GLOBAL VARIABLES WHERE Variable_name IN ('innodb_buffer_pool_size','max_connections','version')`,
  );
  const v = Object.fromEntries(variaveis.map((l) => [l.Variable_name, l.Value]));

  // As dez maiores tabelas do banco atual. `DATABASE()` em vez de nome fixo: o mesmo código roda
  // em produção e no banco local de teste sem depender de como cada um se chama.
  const tabelas = await prisma.$queryRawUnsafe<LinhaTabela[]>(
    `SELECT TABLE_NAME AS tabela, TABLE_ROWS AS linhas,
            (DATA_LENGTH + INDEX_LENGTH) AS bytes
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
      LIMIT 10`,
  );

  const uptime = numero(s.Uptime) || 1;
  const enviados = numero(s.Bytes_sent);
  const consultas = numero(s.Com_select) || 1;
  const porDia = (enviados / uptime) * 86_400;

  return NextResponse.json(
    {
      ligadoHa: `${(uptime / 86_400).toFixed(2)} dias`,

      // O número que o Railway cobra. `porDia` é o que dá pra comparar direto com a fatura.
      saida: {
        total: legivel(enviados),
        porDia: legivel(porDia),
        // A $0,05/GB, que é o preço do Railway.
        custoMensalEstimadoUSD: Number(((porDia / 1024 ** 3) * 30 * 0.05).toFixed(2)),
      },

      // A divisão que decide o conserto: payload gordo ou frequência alta.
      consultas: {
        selects: consultas,
        porMinuto: Number((consultas / (uptime / 60)).toFixed(1)),
        bytesPorSelect: legivel(enviados / consultas),
      },

      conexoes: {
        abertas: numero(s.Threads_connected),
        totalDesdeQueSubiu: numero(s.Connections),
        recusadas: numero(s.Aborted_connects),
        maximo: v.max_connections,
      },

      // A outra metade da fatura: RAM ocupada, cobrada por GB no Railway.
      memoria: {
        bufferPoolConfigurado: legivel(Number(v.innodb_buffer_pool_size ?? 0)),
        bufferPoolEmUso: legivel(numero(s.Innodb_buffer_pool_bytes_data)),
      },

      // Teto de sanidade: nenhuma consulta devolve mais do que a tabela inteira ocupa.
      maioresTabelas: tabelas.map((t) => ({
        tabela: t.tabela,
        linhas: numero(t.linhas),
        tamanho: legivel(numero(t.bytes)),
      })),

      versao: v.version,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
