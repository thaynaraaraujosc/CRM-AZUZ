import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POR ONDE A MENSAGEM SAI.
 *
 * O defeito de 21/10/2026: uma conversa de WhatsApp SEM dono (`contaCanal` nulo) caía no caminho
 * da API oficial e voltava "WhatsApp não conectado" — num workspace com o WhatsApp funcionando o
 * dia inteiro pelo QR Code.
 *
 * E conversa sem dono não é exceção: é todo o histórico anterior a essa coluna existir. O produto
 * já diz em `contasCanalVisiveis` que esse histórico é do QR Code (é por isso que ele aparece na
 * caixa de entrada quando o QR está ligado) — só o envio não sabia disso.
 */

type Conversa = {
  contato: string | null;
  canal: string;
  contaCanal: string | null;
  ehGrupo: boolean;
};

let conversa: Conversa | null = null;
let statusDoQr = "conectado";

/** Os números de QR Code ligados nesta empresa. Um só é a conta de hoje; dois é o caso novo. */
let conexoes: { slot: number; status: string; erroMensagem: null; atualizadoEm: null; metadados: unknown }[] = [];

function conexao(slot: number, numero: string | null, status = "conectado") {
  return { slot, status, erroMensagem: null, atualizadoEm: null, metadados: { numero } };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversa: { findUnique: async () => conversa },
    integracao: {
      findUnique: async () => ({ status: statusDoQr }),
      findMany: async () => conexoes,
      // "Tem algum número de QR Code ligado?" virou uma contagem: com o primeiro caído e o
      // segundo de pé, ler a posição 1 respondia "não tem".
      count: async () => (statusDoQr === "conectado" ? conexoes.length : 0),
    },
  },
}));

/** O `slot` é o que prova POR QUAL número a mensagem saiu. */
const enviadosPeloQr: { numero: string; texto: string; slot: number }[] = [];
vi.mock("@/lib/integracoes/evolution", () => ({
  enviarMensagemWhatsAppNaoOficial: async (_w: string, numero: string, texto: string, slot = 1) => {
    enviadosPeloQr.push({ numero, texto, slot });
  },
}));

/** O oficial NÃO está conectado — é o estado da conta onde o defeito apareceu. */
const enviadosPeloOficial: unknown[] = [];
vi.mock("@/lib/integracoes/whatsapp-oficial", () => ({
  contaConectada: async () => null,
  janelaDeAtendimentoAberta: async () => true,
  enviarPelaCloudApi: async (...args: unknown[]) => {
    enviadosPeloOficial.push(args);
    return "wamid.1";
  },
}));

vi.mock("@/lib/integracoes/crypto", () => ({ decriptar: (v: string) => v }));
vi.mock("@/lib/integracoes/instagram-login", () => ({ enviarDirectInstagram: async () => "mid.1" }));
vi.mock("@/lib/integracoes/erro-instagram", () => ({ explicarErroDoInstagram: (e: string) => e }));
vi.mock("@/lib/social/janela-direct", () => ({ dentroDaJanelaDirect: async () => true }));
vi.mock("../retomada-envio", () => ({ enviarModeloDeRetomada: async () => null }));

const { enviarTextoPeloCanal } = await import("../enviar-pelo-canal");

function conversaDe(ajustes: Partial<Conversa> = {}): Conversa {
  return { contato: "5562996340438", canal: "WhatsApp", contaCanal: null, ehGrupo: false, ...ajustes };
}

beforeEach(() => {
  enviadosPeloQr.length = 0;
  enviadosPeloOficial.length = 0;
  statusDoQr = "conectado";
  conversa = conversaDe();
  conexoes = [conexao(1, "5562988887777")];
});

describe("conversa marcada", () => {
  it("do QR Code sai pelo QR Code", async () => {
    conversa = conversaDe({ contaCanal: "whatsapp_nao_oficial:5562988887777" });

    const r = await enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Ana", texto: "oi" });

    expect(r.enviado).toBe(true);
    expect(enviadosPeloQr).toHaveLength(1);
    expect(enviadosPeloOficial).toHaveLength(0);
  });

  it("o nome antigo da conexão continua valendo", async () => {
    // `whatsapp_baileys:` é como o canal se chamava antes. Histórico gravado com ele não pode
    // virar mensagem pelo canal errado.
    conversa = conversaDe({ contaCanal: "whatsapp_baileys:5562988887777" });

    expect((await enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Ana", texto: "oi" })).enviado).toBe(true);
    expect(enviadosPeloQr).toHaveLength(1);
  });
});

describe("conversa SEM dono", () => {
  it("com o QR ligado, sai pelo QR", async () => {
    // O caso do defeito: aqui voltava "WhatsApp não conectado".
    const r = await enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Ana", texto: "oi" });

    expect(r.enviado).toBe(true);
    expect(enviadosPeloQr).toEqual([{ numero: "5562996340438", texto: "oi", slot: 1 }]);
  });

  it("com o QR desligado, segue pro caminho do oficial", async () => {
    // Sem QR e sem oficial não há por onde mandar — e o motivo tem que dizer isso, não inventar
    // um envio que não aconteceu.
    statusDoQr = "desconectado";

    const r = await enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Ana", texto: "oi" });

    expect(r.enviado).toBe(false);
    expect(r.motivo).toBe("WhatsApp não conectado");
    expect(enviadosPeloQr).toHaveLength(0);
  });
});

/**
 * VÁRIOS NÚMEROS NA MESMA EMPRESA.
 *
 * O defeito que estes casos impedem é o pior possível nesta tela: a resposta sair pelo número
 * errado. Do lado do cliente, a conversa que ele começou com a vendedora continua com o número do
 * closer, do nada, no meio da negociação.
 */
describe("com vendedora e closer conectados", () => {
  beforeEach(() => {
    conexoes = [conexao(1, "5562988887777"), conexao(2, "5511977776666")];
  });

  it("responde pelo número que recebeu", () => {
    conversa = conversaDe({ contaCanal: "whatsapp_nao_oficial:5511977776666" });
    return enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Ana", texto: "oi" }).then((r) => {
      expect(r.enviado).toBe(true);
      expect(enviadosPeloQr).toEqual([{ numero: "5562996340438", texto: "oi", slot: 2 }]);
    });
  });

  it("número desconectado: não manda por outro, e diz por quê", async () => {
    // O closer saiu do CRM e alguém responde a conversa dele. Mandar pela vendedora chegaria —
    // e seria pior do que não chegar.
    conversa = conversaDe({ contaCanal: "whatsapp_nao_oficial:5531900000000" });

    const r = await enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Ana", texto: "oi" });

    expect(r.enviado).toBe(false);
    expect(r.motivo).toContain("não está conectado");
    expect(enviadosPeloQr).toHaveLength(0);
  });

  it("com um número só, conversa sem marca continua saindo normalmente", async () => {
    // A conta de hoje. Nada do que está acima pode mudar o que já funcionava.
    conexoes = [conexao(1, null)];
    conversa = conversaDe({ contaCanal: "whatsapp_nao_oficial:5562988887777" });

    expect((await enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Ana", texto: "oi" })).enviado).toBe(true);
    expect(enviadosPeloQr[0].slot).toBe(1);
  });
});

describe("o que nunca sai", () => {
  it("conversa sem destinatário", async () => {
    conversa = conversaDe({ contato: null });
    const r = await enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Ana", texto: "oi" });
    expect(r).toEqual({ enviado: false, motivo: "conversa sem destinatário" });
  });

  it("grupo: uma automação escreveria pra dezenas de pessoas de uma vez", async () => {
    conversa = conversaDe({ ehGrupo: true });
    const r = await enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Grupo", texto: "oi" });
    expect(r).toEqual({ enviado: false, motivo: "conversa de grupo" });
  });

  it("texto vazio", async () => {
    const r = await enviarTextoPeloCanal({ workspaceId: "w1", conversaNome: "Ana", texto: "   " });
    expect(r).toEqual({ enviado: false, motivo: "mensagem vazia" });
  });
});
