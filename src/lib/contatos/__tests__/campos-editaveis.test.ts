import { describe, expect, it } from "vitest";

import { somenteCamposDeContato } from "../campos-editaveis";

/**
 * A vulnerabilidade que estes testes prendem: escrita cruzando workspaces, sem estar logado.
 *
 * O corpo da requisição ia espalhado direto pro Prisma (`data: { ...dados }`), e o spread vinha
 * DEPOIS de `workspaceId`. Quer dizer que um `workspaceId` mandado de fora vencia. Como a rota
 * pública do formulário (`POST /api/formularios/[id]/contatos`) chega no mesmo caminho, qualquer
 * pessoa com o link de um formulário movia um contato de uma empresa para outra.
 */
describe("somenteCamposDeContato", () => {
  it("deixa passar os campos de verdade", () => {
    const limpo = somenteCamposDeContato({ nome: "Ana", email: "ana@x.com", whatsapp: "5562999", valor: "R$ 100" });
    expect(limpo).toEqual({ nome: "Ana", email: "ana@x.com", whatsapp: "5562999", valor: "R$ 100" });
  });

  // O ataque. Nenhum destes pode chegar ao banco.
  it("barra workspaceId, id e as datas de controle", () => {
    const limpo = somenteCamposDeContato({
      nome: "Ana",
      workspaceId: "workspace-da-vitima",
      id: "outro-id",
      criadoEm: new Date(0),
      atualizadoEm: new Date(0),
    });
    expect(limpo).toEqual({ nome: "Ana" });
    expect(limpo).not.toHaveProperty("workspaceId");
  });

  it("barra qualquer campo inventado", () => {
    expect(somenteCamposDeContato({ nome: "Ana", admin: true, saldo: 999 })).toEqual({ nome: "Ana" });
  });

  it("ignora campo ausente em vez de gravar indefinido", () => {
    expect(somenteCamposDeContato({ nome: "Ana", email: undefined })).toEqual({ nome: "Ana" });
  });

  // `etiquetas: null` chega do front quando não há etiqueta nenhuma. Gravar isso apagaria a lista
  // de quem já tinha etiquetas, numa edição que não falava de etiqueta nenhuma.
  it("não deixa etiquetas nulas apagarem as que existem", () => {
    expect(somenteCamposDeContato({ nome: "Ana", etiquetas: null })).toEqual({ nome: "Ana" });
    expect(somenteCamposDeContato({ etiquetas: ["vip"] })).toEqual({ etiquetas: ["vip"] });
  });

  it("corpo vazio não vira escrita nenhuma", () => {
    expect(somenteCamposDeContato({})).toEqual({});
  });
});
