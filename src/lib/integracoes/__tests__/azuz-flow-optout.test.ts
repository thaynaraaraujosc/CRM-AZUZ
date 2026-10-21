import { beforeEach, describe, expect, it, vi } from "vitest";

type Contato = { id: string; consentimentoWhatsApp: boolean | null };

let contato: Contato | null = { id: "w1-ana-souza", consentimentoWhatsApp: true };
const atualizacoesDoContato: Record<string, unknown>[] = [];
/** Quantas linhas da fila o `updateMany` encontra pra cancelar. */
let naFila = 0;
const cancelamentos: Record<string, unknown>[] = [];
const bolhas: { id: string; texto: string }[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contato: {
      findUnique: async () => contato,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        atualizacoesDoContato.push(data);
        return { ...contato, ...data };
      },
    },
    confirmacaoDeReuniao: {
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        cancelamentos.push(data);
        return { count: naFila };
      },
    },
    mensagemExtra: {
      create: async ({ data }: { data: { id: string; texto: string } }) => {
        bolhas.push(data);
        return data;
      },
    },
  },
}));

const { ehPedidoDeParar, registrarPedidoDeParar } = await import("../azuz-flow-optout");

/**
 * Esta função decide se o CRM para de mandar mensagem pra uma pessoa. Errar pra cada lado tem um
 * custo diferente, e os dois estão provados aqui:
 *
 *   - errar pra MENOS é continuar mandando mensagem pra quem pediu pra parar, que é exatamente a
 *     reclamação que faz um número de WhatsApp ser bloqueado;
 *   - errar pra MAIS é desligar o WhatsApp de um cliente que escreveu "vou sair mais cedo hoje".
 */

describe("é pedido pra parar", () => {
  it("a palavra sozinha, em qualquer caixa", () => {
    expect(ehPedidoDeParar("SAIR")).toBe(true);
    expect(ehPedidoDeParar("sair")).toBe(true);
    expect(ehPedidoDeParar("Parar")).toBe(true);
    expect(ehPedidoDeParar("PARE")).toBe(true);
    expect(ehPedidoDeParar("stop")).toBe(true);
  });

  it("com pontuação, emoji e espaço sobrando", () => {
    // Ninguém responde a um aviso de rodapé com precisão de comando de terminal.
    expect(ehPedidoDeParar("  SAIR.  ")).toBe(true);
    expect(ehPedidoDeParar("parar!")).toBe(true);
    expect(ehPedidoDeParar("sair 🙏")).toBe(true);
  });

  it("com palavras que não mudam o pedido", () => {
    expect(ehPedidoDeParar("parar por favor")).toBe(true);
    expect(ehPedidoDeParar("quero sair")).toBe(true);
    expect(ehPedidoDeParar("não quero mais receber mensagens, parar")).toBe(true);
    expect(ehPedidoDeParar("descadastrar pf")).toBe(true);
  });
});

describe("NÃO é pedido pra parar", () => {
  it("a palavra dentro de uma frase que fala de outra coisa", () => {
    // O caso que justifica a regra ser sobre a mensagem inteira.
    expect(ehPedidoDeParar("vou sair mais cedo hoje, pode ser amanhã?")).toBe(false);
    expect(ehPedidoDeParar("pode parar o projeto por enquanto, depois retomamos")).toBe(false);
    expect(ehPedidoDeParar("consegui cancelar a outra reunião")).toBe(false);
  });

  it("mensagem vazia ou só pontuação", () => {
    expect(ehPedidoDeParar("")).toBe(false);
    expect(ehPedidoDeParar("   ")).toBe(false);
    expect(ehPedidoDeParar("?!")).toBe(false);
  });

  it("confirmação de presença, que é o oposto", () => {
    expect(ehPedidoDeParar("confirmado")).toBe(false);
    expect(ehPedidoDeParar("ok")).toBe(false);
    expect(ehPedidoDeParar("obrigada, até amanhã")).toBe(false);
  });

  it("texto longo, mesmo contendo a palavra sozinha em algum ponto", () => {
    const longo = "oi tudo bem? queria confirmar o horario da reuniao de amanha com voces, pode ser? sair";
    expect(ehPedidoDeParar(longo)).toBe(false);
  });
});

describe("registrar o pedido", () => {
  beforeEach(() => {
    contato = { id: "w1-ana-souza", consentimentoWhatsApp: true };
    atualizacoesDoContato.length = 0;
    cancelamentos.length = 0;
    bolhas.length = 0;
    naFila = 0;
  });

  function registrar() {
    return registrarPedidoDeParar({
      workspaceId: "w1",
      telefone: "62999990001",
      contatoId: "w1-ana-souza",
      conversaNome: "Ana Souza",
      contaCanal: "WhatsApp:5562988887777",
      mensagemId: "ABC123",
    });
  }

  it("desmarca o consentimento e escreve a bolha", async () => {
    const r = await registrar();

    expect(r.desmarcado).toBe(true);
    expect(atualizacoesDoContato[0]).toMatchObject({
      consentimentoWhatsApp: false,
      consentimentoWhatsAppOrigem: "revogado-no-whatsapp",
    });
    // O texto que a pessoa ACEITOU um dia não é apagado: a recusa está no booleano e na origem.
    expect(atualizacoesDoContato[0]).not.toHaveProperty("consentimentoWhatsAppTexto");
    expect(bolhas[0].texto).toContain("pediu para parar");
  });

  it("cancela o que estava na fila e diz quantas, na mesma bolha", async () => {
    naFila = 2;

    const r = await registrar();

    expect(r.canceladas).toBe(2);
    expect(cancelamentos[0]).toMatchObject({ situacao: "cancelada" });
    expect(bolhas[0].texto).toContain("2 confirmações de reunião foram canceladas");
  });

  it("pedido repetido não reescreve a data do primeiro", async () => {
    // A data que vale é a do PRIMEIRO pedido: é ela que responde "desde quando esta pessoa pediu
    // pra parar". E sem nada pra mudar, não há bolha nova.
    contato = { id: "w1-ana-souza", consentimentoWhatsApp: false };

    const r = await registrar();

    expect(r).toEqual({ desmarcado: false, canceladas: 0 });
    expect(atualizacoesDoContato).toHaveLength(0);
    expect(bolhas).toHaveLength(0);
  });

  it("a bolha tem id derivado da mensagem, pra não duplicar", async () => {
    await registrar();
    expect(bolhas[0].id).toBe("optout-ABC123");
  });

  it("sem contato no CRM, a fila ainda é cancelada", async () => {
    naFila = 1;

    const r = await registrarPedidoDeParar({
      workspaceId: "w1",
      telefone: "62999990001",
      contatoId: null,
      conversaNome: "Ana Souza",
      contaCanal: null,
      mensagemId: "XYZ",
    });

    expect(r).toEqual({ desmarcado: false, canceladas: 1 });
    expect(bolhas).toHaveLength(1);
  });
});
