import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONFIG_PADRAO, type ConfigDoFlow } from "../azuz-flow-config";

/**
 * A fila que manda mensagem pra gente de verdade.
 *
 * Cada caso aqui é uma proteção do número da agência, e o que está sendo provado é sempre a mesma
 * coisa: o que NÃO sai, e se o motivo ficou escrito onde quem atende vai procurar. Uma confirmação
 * que não saiu em silêncio é uma pessoa esperando uma mensagem que ninguém sabe que não foi
 * mandada.
 */

type Linha = {
  id: string;
  workspaceId: string;
  telefone: string;
  inicio: Date;
  contatoNome: string;
  conversaNome: string | null;
  situacao: string;
  motivo: string | null;
  enviarApos: Date;
  enviadaEm: Date | null;
  texto: string | null;
  canal: string | null;
  tentativas: number;
};

/** O que o banco de mentira tem na fila. */
let fila: Linha[] = [];
/** As contagens que o processador consulta: enviadas no dia e enviadas pro número. */
let enviadasNoDia = 0;
let enviadasParaONumero = 0;
const atualizacoes: { id: string; data: Record<string, unknown> }[] = [];

/** O filtro que o processador manda pro banco. Guardado porque é ele que faz a janela de horário
 *  funcionar: linha com `enviarApos` no futuro não pode ser tocada nesta batida. */
let filtroDaBusca: Record<string, unknown> | null = null;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    confirmacaoDeReuniao: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        filtroDaBusca = where;
        return fila.filter((l) => l.situacao === "na_fila" && l.enviarApos <= new Date());
      },
      count: async ({ where }: { where: { telefone?: string } }) =>
        // O processador faz duas contagens; o que as separa é o `telefone` no filtro.
        where.telefone ? enviadasParaONumero : enviadasNoDia,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        atualizacoes.push({ id: where.id, data });
        const linha = fila.find((l) => l.id === where.id);
        if (linha) Object.assign(linha, data);
        return linha;
      },
    },
  },
}));

let config: ConfigDoFlow = CONFIG_PADRAO;
vi.mock("../azuz-flow-config", async (original) => ({
  ...(await original<typeof import("../azuz-flow-config")>()),
  configDoFlow: async () => config,
}));

/** `true` tem WhatsApp, `false` não tem, `null` não deu pra saber. */
let temWhatsapp: boolean | null = true;
vi.mock("@/lib/integracoes/evolution", () => ({ numeroTemWhatsapp: async () => temWhatsapp }));

let envio: { enviado: boolean; motivo?: string } = { enviado: true };
const enviados: { conversaNome: string; texto: string }[] = [];
vi.mock("@/lib/conversas/enviar-pelo-canal", () => ({
  enviarTextoPeloCanal: async (p: { conversaNome: string; texto: string }) => {
    enviados.push(p);
    return envio;
  },
}));

const bolhas: { marca: string; texto: string }[] = [];
vi.mock("../azuz-flow-confirmacao-fila", () => ({
  anotarNaConversa: async (p: { marca: string; texto: string }) => {
    bolhas.push(p);
  },
}));

/** As mensagens que entraram NA CONVERSA — o texto que o cliente recebeu, não um aviso sobre ele. */
const naConversa: { texto: string; wamid?: string | null }[] = [];
vi.mock("@/lib/conversas/registrar-saida", () => ({
  registrarMensagemEnviada: async (p: { texto: string; wamid?: string | null }) => {
    naConversa.push(p);
  },
}));

let pausadoEm: string | null = null;
const falhasRegistradas: string[] = [];
let sucessos = 0;
vi.mock("../azuz-flow-disjuntor", () => ({
  lerDisjuntor: async () => ({ falhasSeguidas: 0, pausadoEm, ultimoMotivo: null }),
  registrarFalha: async ({ motivo }: { motivo: string }) => {
    falhasRegistradas.push(motivo);
    return false;
  },
  registrarSucesso: async () => {
    sucessos += 1;
  },
}));

const { processarConfirmacoesDeReuniao } = await import("../azuz-flow-confirmacao-envio");

const DAQUI_A_DIAS = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

function linha(ajustes: Partial<Linha> = {}): Linha {
  return {
    id: "conf-w1-5562999990001-1",
    workspaceId: "w1",
    telefone: "5562999990001",
    inicio: DAQUI_A_DIAS,
    contatoNome: "Ana Souza",
    conversaNome: "Ana Souza",
    situacao: "na_fila",
    motivo: null,
    enviarApos: new Date(Date.now() - 60_000),
    enviadaEm: null,
    texto: "Oi, Ana! Sua reunião está confirmada.",
    canal: null,
    tentativas: 0,
    ...ajustes,
  };
}

/** A configuração com a confirmação LIGADA. O padrão nasce desligado, de propósito. */
function ligada(ajustes: Partial<ConfigDoFlow["confirmacao"]> = {}): ConfigDoFlow {
  return { ...CONFIG_PADRAO, confirmacao: { ...CONFIG_PADRAO.confirmacao, ativa: true, ...ajustes } };
}

beforeEach(() => {
  fila = [];
  enviadasNoDia = 0;
  enviadasParaONumero = 0;
  atualizacoes.length = 0;
  enviados.length = 0;
  bolhas.length = 0;
  naConversa.length = 0;
  falhasRegistradas.length = 0;
  sucessos = 0;
  pausadoEm = null;
  filtroDaBusca = null;
  temWhatsapp = true;
  envio = { enviado: true };
  config = ligada();
});

describe("o caminho que funciona", () => {
  it("manda, marca como enviada e escreve a bolha", async () => {
    fila = [linha()];

    const r = await processarConfirmacoesDeReuniao();

    expect(r).toEqual({ enviadas: 1, recusadas: 0, adiadas: 0 });
    expect(enviados).toEqual([{ workspaceId: "w1", conversaNome: "Ana Souza", texto: "Oi, Ana! Sua reunião está confirmada." }]);
    expect(atualizacoes[0].data.situacao).toBe("enviada");
    /*
     * O TEXTO QUE SAIU entra na conversa, não um aviso sobre ele.
     *
     * Antes a conversa ficava com duas bolhas de sistema ("na fila", "enviada") e NENHUMA
     * mensagem: o CRM mandava um WhatsApp em nome da agência e não guardava o que tinha escrito.
     */
    expect(naConversa).toEqual([
      { workspaceId: "w1", contatoNome: "Ana Souza", texto: "Oi, Ana! Sua reunião está confirmada.", wamid: undefined, origem: "confirmacao-do-flow" },
    ]);
    // E nenhuma bolha de sistema a mais: a mensagem com hora e tiquinho já diz que foi enviada.
    expect(bolhas).toHaveLength(0);
    // Envio bom zera o contador de falhas seguidas do disjuntor.
    expect(sucessos).toBe(1);
  });

  it("fila vazia não consulta nada", async () => {
    const r = await processarConfirmacoesDeReuniao();
    expect(r).toEqual({ enviadas: 0, recusadas: 0, adiadas: 0 });
    expect(enviados).toHaveLength(0);
  });
});

describe("o que segura o envio sem descartar", () => {
  it("desligada: fica na fila", async () => {
    config = { ...CONFIG_PADRAO, confirmacao: { ...CONFIG_PADRAO.confirmacao, ativa: false } };
    fila = [linha()];

    const r = await processarConfirmacoesDeReuniao();

    expect(r.adiadas).toBe(1);
    expect(enviados).toHaveLength(0);
    // Nada foi gravado: adiar não é um fato, é a ausência de um.
    expect(atualizacoes).toHaveLength(0);
  });

  it("pausada pela empresa: fica na fila", async () => {
    config = ligada({ pausada: true });
    fila = [linha()];

    expect((await processarConfirmacoesDeReuniao()).adiadas).toBe(1);
    expect(enviados).toHaveLength(0);
  });

  it("disjuntor pausado: fica na fila", async () => {
    pausadoEm = new Date().toISOString();
    fila = [linha()];

    expect((await processarConfirmacoesDeReuniao()).adiadas).toBe(1);
    expect(enviados).toHaveLength(0);
  });

  it("teto do dia estourado: fica na fila, porque amanhã cabe", async () => {
    enviadasNoDia = 30;
    fila = [linha()];

    expect((await processarConfirmacoesDeReuniao()).adiadas).toBe(1);
    expect(enviados).toHaveLength(0);
  });

  it("linha com hora futura não é tocada nesta batida", async () => {
    /*
     * É ASSIM que a janela de horário vira comportamento.
     *
     * Quem decide a hora é `quandoEnviar`, na entrada do lead: fora da janela ela grava um
     * `enviarApos` na abertura da janela. Daí pra frente a única coisa que faz a mensagem esperar é
     * ESTE filtro. Sem o `lte`, a fila sairia na mesma batida e a janela não existiria.
     */
    fila = [linha({ enviarApos: new Date(Date.now() + 6 * 60 * 60 * 1000) })];

    const r = await processarConfirmacoesDeReuniao();

    expect(r).toEqual({ enviadas: 0, recusadas: 0, adiadas: 0 });
    expect(enviados).toHaveLength(0);
    expect(filtroDaBusca).toMatchObject({ situacao: "na_fila" });
    expect((filtroDaBusca?.enviarApos as { lte: Date }).lte).toBeInstanceOf(Date);
  });

  it("mais do que o ritmo do canal numa rodada: o excedente espera a próxima batida", async () => {
    // O gotejamento. O ritmo do canal não oficial são 3 por minuto, e o cron bate uma vez por
    // minuto: 5 vencidas na mesma batida não podem sair juntas.
    fila = [1, 2, 3, 4, 5].map((n) =>
      linha({ id: `conf-w1-556299999000${n}-1`, telefone: `556299999000${n}` }),
    );

    const r = await processarConfirmacoesDeReuniao();

    expect(r.enviadas).toBe(3);
    expect(r.adiadas).toBe(2);
  });
});

describe("o que NÃO vai sair, com o motivo escrito", () => {
  it("a reunião já começou", async () => {
    fila = [linha({ inicio: new Date(Date.now() - 60_000) })];

    const r = await processarConfirmacoesDeReuniao();

    expect(r.recusadas).toBe(1);
    expect(atualizacoes[0].data.situacao).toBe("nao_enviada");
    expect(atualizacoes[0].data.motivo).toBe("Confirmação não enviada: a reunião já havia começado.");
    expect(bolhas[0].texto).toContain("já havia começado");
  });

  it("o número já recebeu o máximo em 24h", async () => {
    enviadasParaONumero = 3;
    fila = [linha()];

    const r = await processarConfirmacoesDeReuniao();

    expect(r.recusadas).toBe(1);
    expect(String(atualizacoes[0].data.motivo)).toContain("já recebeu 3 confirmações");
    expect(enviados).toHaveLength(0);
  });

  it("o número não tem WhatsApp", async () => {
    temWhatsapp = false;
    fila = [linha()];

    const r = await processarConfirmacoesDeReuniao();

    expect(r.recusadas).toBe(1);
    expect(atualizacoes[0].data.motivo).toBe("Confirmação não enviada: este número não tem WhatsApp.");
    expect(enviados).toHaveLength(0);
  });

  it("a conversa não existe mais", async () => {
    fila = [linha({ conversaNome: null })];

    const r = await processarConfirmacoesDeReuniao();

    expect(r.recusadas).toBe(1);
    // Sem conversa não há onde escrever a bolha — e é por isso que o motivo vai pra linha.
    expect(atualizacoes[0].data.motivo).toContain("a conversa não existe mais");
    expect(bolhas).toHaveLength(0);
  });
});

describe("insistir, e saber quando parar", () => {
  it("não deu pra conferir o número: tenta de novo mais tarde", async () => {
    temWhatsapp = null;
    fila = [linha()];

    const r = await processarConfirmacoesDeReuniao();

    expect(r.adiadas).toBe(1);
    expect(atualizacoes[0].data.tentativas).toBe(1);
    // A espera cresce: insistir de minuto em minuto é a própria insistência que o disjuntor
    // existe pra impedir, em menor escala.
    expect((atualizacoes[0].data.enviarApos as Date).getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    expect(enviados).toHaveLength(0);
  });

  it("na terceira tentativa, desiste e grava o motivo", async () => {
    temWhatsapp = null;
    fila = [linha({ tentativas: 2 })];

    const r = await processarConfirmacoesDeReuniao();

    expect(r.recusadas).toBe(1);
    expect(atualizacoes[0].data.situacao).toBe("nao_enviada");
    expect(atualizacoes[0].data.tentativas).toBe(3);
  });

  it("envio que falha conta pro disjuntor e volta pra fila", async () => {
    envio = { enviado: false, motivo: "a conexão do WhatsApp está desconectada" };
    fila = [linha()];

    const r = await processarConfirmacoesDeReuniao();

    expect(r.adiadas).toBe(1);
    expect(falhasRegistradas).toEqual(["a conexão do WhatsApp está desconectada"]);
    expect(atualizacoes[0].data.tentativas).toBe(1);
    expect(String(atualizacoes[0].data.motivo)).toContain("desconectada");
  });
});
