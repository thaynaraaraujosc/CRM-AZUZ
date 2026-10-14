import { prisma } from "@/lib/prisma";

/**
 * O banco deste ambiente tem a estrutura que este código espera?
 *
 * Existe por causa de um dia inteiro de produção em 14/10/2026. O código novo subiu, o
 * `prisma db push` do build NÃO rodou, e nada no sistema no ar sabia disso. O sintoma que chegou à
 * pessoa foi um erro de JavaScript no navegador — `Unexpected end of JSON input` — a três camadas de
 * distância da causa, que era uma tabela que não existia. O único registro da verdade era uma linha
 * de aviso num log de build que já tinha rolado pra fora da tela.
 *
 * "Código novo no ar, schema antigo no banco" é um estado NORMAL de um sistema que publica e migra
 * em passos separados. O defeito não foi o estado existir: foi ele ser invisível. Então agora ele
 * tem nome, lugar e resposta.
 *
 * A lista abaixo é um CHECKLIST escrito à mão, não o schema inteiro. É de propósito: conferir as
 * duzentas colunas do schema a cada chamada seria caro e, pior, dependeria de o schema estar
 * disponível em tempo de execução num build empacotado. O que precisa estar aqui é o que mudou
 * RECENTEMENTE — é o que pode faltar. Toda mudança aditiva de banco entra aqui no mesmo commit.
 */
export type EstruturaEsperada = {
  tabela: string;
  /** Colunas que precisam existir nessa tabela. Vazio = basta a tabela existir. */
  colunas?: string[];
  /** Em que entrega isso entrou. Vai na resposta, pra quem lê saber o que publicar. */
  entrega: string;
};

export const ESTRUTURAS_ESPERADAS: EstruturaEsperada[] = [
  { tabela: "ChaveDeIntegracao", entrega: "Leads do AZUZ Flow" },
  { tabela: "LeadRecebido", entrega: "Leads do AZUZ Flow" },
  {
    tabela: "Contato",
    colunas: [
      "consentimentoWhatsApp",
      "consentimentoWhatsAppEm",
      "consentimentoWhatsAppTexto",
      "consentimentoWhatsAppOrigem",
    ],
    entrega: "Leads do AZUZ Flow",
  },
];

export type FaltaNoBanco =
  | { tipo: "tabela"; tabela: string; entrega: string }
  | { tipo: "coluna"; tabela: string; coluna: string; entrega: string };

export type EstadoDoBanco = {
  ok: boolean;
  /** `false` quando nem deu pra conferir (banco fora do ar). Não é o mesmo que "está tudo certo". */
  conferido: boolean;
  faltando: FaltaNoBanco[];
  erro?: string;
};

/**
 * Pergunta ao `information_schema`, que é a única fonte que diz o que o banco REALMENTE tem.
 *
 * Duas consultas, só leitura, e nenhuma delas toca dado de cliente. `DATABASE()` em vez do nome do
 * banco escrito à mão porque o nome vem da `DATABASE_URL` e muda entre ambientes — é justamente
 * esse descasamento que se quer poder diagnosticar.
 */
export async function conferirEstruturaDoBanco(): Promise<EstadoDoBanco> {
  try {
    const tabelas = await prisma.$queryRaw<{ nome: string }[]>`
      SELECT TABLE_NAME AS nome
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
    `;
    const colunas = await prisma.$queryRaw<{ tabela: string; nome: string }[]>`
      SELECT TABLE_NAME AS tabela, COLUMN_NAME AS nome
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
    `;

    // Comparação sem caixa: o MySQL do Linux diferencia maiúsculas em nome de tabela, e um
    // descasamento de caixa é um problema diferente (e mais raro) do que a tabela não existir.
    const temTabela = new Set(tabelas.map((t) => t.nome.toLowerCase()));
    const temColuna = new Set(colunas.map((c) => `${c.tabela.toLowerCase()}.${c.nome.toLowerCase()}`));

    const faltando: FaltaNoBanco[] = [];
    for (const esperada of ESTRUTURAS_ESPERADAS) {
      if (!temTabela.has(esperada.tabela.toLowerCase())) {
        faltando.push({ tipo: "tabela", tabela: esperada.tabela, entrega: esperada.entrega });
        // Sem a tabela, listar cada coluna dela seria repetir a mesma notícia várias vezes.
        continue;
      }
      for (const coluna of esperada.colunas ?? []) {
        if (!temColuna.has(`${esperada.tabela.toLowerCase()}.${coluna.toLowerCase()}`)) {
          faltando.push({ tipo: "coluna", tabela: esperada.tabela, coluna, entrega: esperada.entrega });
        }
      }
    }

    return { ok: faltando.length === 0, conferido: true, faltando };
  } catch (erro) {
    // Não deu pra conferir é DIFERENTE de está tudo certo, e a resposta precisa dizer qual dos dois
    // é: responder `ok: true` com o banco fora do ar esconderia exatamente o que se quer enxergar.
    return {
      ok: false,
      conferido: false,
      faltando: [],
      erro: erro instanceof Error ? erro.message : "não deu pra conferir a estrutura do banco",
    };
  }
}

/** A frase que resume o estado, pra tela e pra log. */
export function resumoDoEstado(estado: EstadoDoBanco): string {
  if (!estado.conferido) return "Não foi possível conferir a estrutura do banco.";
  if (estado.ok) return "O banco tem toda a estrutura que esta versão do CRM espera.";
  const tabelas = estado.faltando.filter((f) => f.tipo === "tabela").length;
  const colunas = estado.faltando.filter((f) => f.tipo === "coluna").length;
  const partes = [
    tabelas ? `${tabelas} tabela(s)` : "",
    colunas ? `${colunas} coluna(s)` : "",
  ].filter(Boolean);
  return `Falta no banco: ${partes.join(" e ")}. O schema desta versão não foi aplicado neste ambiente.`;
}
