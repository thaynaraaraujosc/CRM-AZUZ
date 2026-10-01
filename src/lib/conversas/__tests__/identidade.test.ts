import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A REGRESSÃO QUE ESTES TESTES PRENDEM: mensagem aparecendo dentro da conversa de outro cliente,
 * e a conversa do cliente sumindo.
 *
 * A camada de mensagens é indexada por NOME (`MensagemExtra.contato`, e a chave única da `Conversa`
 * é `[workspaceId, nome]`). Então "dois telefones caírem no mesmo nome" não é um detalhe cosmético:
 * é a mesma thread, com as mensagens das duas pessoas misturadas. Os dois caminhos que levavam a
 * isso estão cobertos aqui: o `pushName` de evento `fromMe` (que é o nome do dono da conta, não o
 * de quem recebe) e dois números diferentes com nome de perfil igual.
 */
const contatoFindMany = vi.fn();
const contatoFindUnique = vi.fn();
const conversaFindMany = vi.fn();
const conversaFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contato: {
      findMany: (...a: unknown[]) => contatoFindMany(...a),
      findUnique: (...a: unknown[]) => contatoFindUnique(...a),
    },
    conversa: {
      findMany: (...a: unknown[]) => conversaFindMany(...a),
      findUnique: (...a: unknown[]) => conversaFindUnique(...a),
    },
  },
}));

const { resolverPessoaDoTelefone } = await import("../identidade");

const GABRIELA = "5562999990001";
const LAZARO = "5562999990002";

beforeEach(() => {
  for (const m of [contatoFindMany, contatoFindUnique, conversaFindMany, conversaFindUnique]) m.mockReset();
  contatoFindMany.mockResolvedValue([]);
  contatoFindUnique.mockResolvedValue(null);
  conversaFindMany.mockResolvedValue([]);
  conversaFindUnique.mockResolvedValue(null);
});

describe("resolverPessoaDoTelefone", () => {
  it("usa o nome do Contato já cadastrado com esse telefone", async () => {
    contatoFindMany.mockResolvedValue([{ id: "c1", whatsapp: "(62) 99999-0001" }]);
    contatoFindUnique.mockResolvedValue({ id: "c1", nome: "Gabriela Lima", whatsapp: "(62) 99999-0001" });

    const pessoa = await resolverPessoaDoTelefone({
      workspaceId: "w1",
      telefone: GABRIELA,
      nomeDoPerfil: "Gabi 🌸",
    });

    // O nome do perfil muda quando a pessoa quer; o do cadastro é o que o CRM mostra.
    expect(pessoa.nome).toBe("Gabriela Lima");
    expect(pessoa.contatoExistente?.id).toBe("c1");
  });

  it("reusa a thread que já existe pra esse telefone, mesmo sem Contato", async () => {
    conversaFindMany.mockResolvedValue([{ nome: "Gabriela", contato: GABRIELA }]);

    const pessoa = await resolverPessoaDoTelefone({ workspaceId: "w1", telefone: GABRIELA });

    expect(pessoa.nome).toBe("Gabriela");
  });

  /*
   * O CASO DO PRINT. Ela manda mensagem do celular pra um número novo; a Evolution espelha o envio
   * com `fromMe: true` e `pushName` = "Atendimento Agência Azuz", que é o perfil DELA. Quem chama
   * passa `nomeDoPerfil: null` nesse evento, e aqui o nome não pode em hipótese alguma virar o do
   * próprio negócio: senão todo destinatário novo cai na mesma conversa.
   */
  it("sem nome de perfil (evento fromMe), identifica pelo telefone e não por um nome emprestado", async () => {
    const pessoa = await resolverPessoaDoTelefone({ workspaceId: "w1", telefone: LAZARO, nomeDoPerfil: null });

    expect(pessoa.nome).toBe(LAZARO);
    expect(pessoa.contatoExistente).toBeNull();
  });

  it("não entrega um nome que já é de OUTRO número (dois perfis com o mesmo nome)", async () => {
    // Já existe a conversa "Gabriela", e ela é do número da Gabriela.
    conversaFindUnique.mockResolvedValue({ contato: GABRIELA, ehGrupo: false });

    const pessoa = await resolverPessoaDoTelefone({
      workspaceId: "w1",
      telefone: LAZARO,
      nomeDoPerfil: "Gabriela",
    });

    // Mostrar o número é feio; fundir duas pessoas numa conversa é perda de atendimento.
    expect(pessoa.nome).toBe(LAZARO);
  });

  it("não entrega um nome que já é de outro número por causa do Contato", async () => {
    contatoFindUnique.mockResolvedValue({ whatsapp: "(62) 99999-0001" });

    const pessoa = await resolverPessoaDoTelefone({
      workspaceId: "w1",
      telefone: LAZARO,
      nomeDoPerfil: "Gabriela",
    });

    expect(pessoa.nome).toBe(LAZARO);
  });

  it("nunca joga uma pessoa dentro da thread de um grupo com o mesmo nome", async () => {
    conversaFindUnique.mockResolvedValue({ contato: "120363422457482263@g.us", ehGrupo: true });

    const pessoa = await resolverPessoaDoTelefone({
      workspaceId: "w1",
      telefone: LAZARO,
      nomeDoPerfil: "Equipe Comercial",
    });

    expect(pessoa.nome).toBe(LAZARO);
  });

  it("aceita o nome de perfil quando ele está livre", async () => {
    const pessoa = await resolverPessoaDoTelefone({
      workspaceId: "w1",
      telefone: LAZARO,
      nomeDoPerfil: "  Lázaro Souza  ",
    });

    // E com `trim`: espaço invisível no fim fazia a mesma pessoa virar duas.
    expect(pessoa.nome).toBe("Lázaro Souza");
  });

  it("a conversa antiga sem telefone gravado continua recebendo a mensagem", async () => {
    // Conversa criada antes de a coluna `contato` ser preenchida: o nome está "ocupado", mas não
    // por outro número. Barrar aqui partiria o histórico de quem já conversava.
    conversaFindUnique.mockResolvedValue({ contato: null, ehGrupo: false });

    const pessoa = await resolverPessoaDoTelefone({
      workspaceId: "w1",
      telefone: LAZARO,
      nomeDoPerfil: "Lázaro",
    });

    expect(pessoa.nome).toBe("Lázaro");
  });

  it("o mesmo número com máscara diferente é a mesma pessoa, não um conflito", async () => {
    conversaFindUnique.mockResolvedValue({ contato: "+55 (62) 99999-0002", ehGrupo: false });

    const pessoa = await resolverPessoaDoTelefone({
      workspaceId: "w1",
      telefone: LAZARO,
      nomeDoPerfil: "Lázaro",
    });

    expect(pessoa.nome).toBe("Lázaro");
  });
});
