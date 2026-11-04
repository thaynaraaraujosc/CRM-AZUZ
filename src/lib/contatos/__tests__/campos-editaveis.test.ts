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

/**
 * `camposExtras` é a única coluna da lista em que o NAVEGADOR escolhe as chaves, e não só os
 * valores. Sem corte, uma coluna JSON de configuração vira depósito.
 */
describe("somenteCamposDeContato e os campos que a empresa criou", () => {
  it("deixa passar os pares de texto", () => {
    const limpo = somenteCamposDeContato({ camposExtras: { c1: "Novo", c2: "Indicação" } });
    expect(limpo.camposExtras).toEqual({ c1: "Novo", c2: "Indicação" });
  });

  it("corta o objeto gigante", () => {
    const cru: Record<string, string> = {};
    for (let i = 0; i < 500; i += 1) cru[`c${i}`] = "x";
    const limpo = somenteCamposDeContato({ camposExtras: cru });
    expect(Object.keys(limpo.camposExtras as Record<string, string>).length).toBeLessThanOrEqual(30);
  });

  it("`null` esvazia em vez de gravar nulo", () => {
    // Diferente de `etiquetas`: aqui esvaziar é uma ação de verdade na tela ("apaguei o valor").
    expect(somenteCamposDeContato({ camposExtras: null }).camposExtras).toEqual({});
  });

  it("não inventa a coluna quando ela não foi mandada", () => {
    expect("camposExtras" in somenteCamposDeContato({ nome: "Ana" })).toBe(false);
  });
});
