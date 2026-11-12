import { describe, expect, it } from "vitest";

import {
  ESCOPOS,
  MARCA_DE_VERSAO,
  PERMISSOES_POR_MODULO,
  escopoDeixaVer,
  escopoPermitido,
  idDeEscopo,
  permissoesEfetivas,
} from "@/lib/configuracoes/permissoes";

/**
 * "WhatsApp, Instagram, funil, formulário, equipe, contato, inteligência comercial, automações,
 * social seller, AZUZ IA e configurações. Só esses módulos."
 */
describe("os módulos", () => {
  it("são exatamente os pedidos, nessa ordem", () => {
    expect(PERMISSOES_POR_MODULO.map((m) => m.modulo)).toEqual([
      "WhatsApp",
      "Instagram",
      "Funil",
      "Formulário",
      "Equipe",
      "Contatos",
      "Inteligência comercial",
      "Automações",
      "Social Seller",
      "AZUZ IA",
      "Configurações",
    ]);
  });

  it("os ids que o proxy bloqueia continuam existindo", () => {
    // Renomear id é tirar acesso de quem tem, em silêncio: estes estão gravados na coluna
    // `permissoes` de quem já existe e são lidos por `ROTA_PERMISSAO` em `src/proxy.ts`.
    const ids = PERMISSOES_POR_MODULO.flatMap((m) => m.permissoes.map((p) => p.id));
    for (const id of [
      "contatos_visualizar",
      "wa_visualizar",
      "funil_visualizar",
      "form_visualizar",
      "auto_visualizar",
      "config_visualizar",
      "rel_visualizar",
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  it("nenhum id repetido entre módulos", () => {
    const ids = PERMISSOES_POR_MODULO.flatMap((m) => m.permissoes.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("só WhatsApp e Funil têm recorte: são os que a pessoa pediu pra separar", () => {
    expect(PERMISSOES_POR_MODULO.filter((m) => m.escopos?.length).map((m) => m.modulo)).toEqual([
      "WhatsApp",
      "Funil",
    ]);
  });

  it("o Funil tem DOIS recortes: quais quadros, e quais colunas dentro deles", () => {
    /*
     * "Eu não quero que ele veja todo o processo do funil — novo, qualificado, proposta, fechado.
     * Eu quero que ele tenha a visão apenas de proposta." São duas perguntas diferentes, e um
     * campo só obrigaria a escolher entre elas.
     */
    const funil = PERMISSOES_POR_MODULO.find((m) => m.modulo === "Funil");
    expect(funil?.escopos?.map((e) => e.prefixo)).toEqual(["funil_id", "funil_etapa"]);
  });

  it("os prefixos de recorte não se confundem entre si", () => {
    // `funil_id` e `funil_etapa` começam igual. Se a leitura fosse por `startsWith("funil_")`, uma
    // etapa marcada entraria na lista de funis permitidos e abriria um quadro inteiro por engano.
    const prefixos = Object.values(ESCOPOS).map((e) => e.prefixo);
    for (const a of prefixos) {
      for (const b of prefixos) {
        if (a !== b) expect(`${a}:`.startsWith(`${b}:`)).toBe(false);
      }
    }
  });
});

/**
 * "Às vezes eu quero que esse funcionário veja apenas o funil dele. Eu não quero que ele veja os
 * outros funis, porque ele pode cometer algum erro."
 *
 * NADA MARCADO QUER DIZER TODOS: é o comportamento de hoje, então ninguém perde acesso no dia em
 * que isto entra, e é o que uma lista de caixas vazias promete.
 */
describe("o recorte dentro do módulo", () => {
  const escopo = ESCOPOS.funis;

  it("sem nada marcado, não restringe", () => {
    expect(escopoPermitido([], escopo)).toBeNull();
    expect(escopoDeixaVer([], escopo, "funil-1")).toBe(true);
  });

  it("com um marcado, só ele passa", () => {
    const p = [idDeEscopo(escopo, "funil-1")];
    expect(escopoPermitido(p, escopo)).toEqual(["funil-1"]);
    expect(escopoDeixaVer(p, escopo, "funil-1")).toBe(true);
    expect(escopoDeixaVer(p, escopo, "funil-2")).toBe(false);
  });

  it("o recorte de um módulo não afeta o do outro", () => {
    const p = [idDeEscopo(ESCOPOS.funis, "funil-1")];
    expect(escopoPermitido(p, ESCOPOS.numerosDeWhatsApp)).toBeNull();
  });

  it("item sem identificação continua visível", () => {
    // Conversa antiga sem número gravado, card sem funil: não pertencem a recorte nenhum, e
    // escondê-los seria sumir com dado vivo por causa de uma coluna que não existia.
    const p = [idDeEscopo(escopo, "funil-1")];
    expect(escopoDeixaVer(p, escopo, null)).toBe(true);
    expect(escopoDeixaVer(p, escopo, "")).toBe(true);
  });

  it("o valor pode ter dois-pontos dentro: `contaCanal` tem", () => {
    const e = ESCOPOS.numerosDeWhatsApp;
    const p = [idDeEscopo(e, "meta_whatsapp:143588938831846")];
    expect(escopoPermitido(p, e)).toEqual(["meta_whatsapp:143588938831846"]);
    expect(escopoDeixaVer(p, e, "meta_whatsapp:143588938831846")).toBe(true);
    expect(escopoDeixaVer(p, e, "whatsapp_nao_oficial:5562963404")).toBe(false);
  });
});

/**
 * Instagram, Equipe, Social Seller e AZUZ IA ganharam permissão própria depois que já havia gente
 * usando o CRM. Passar a bloquear por eles tiraria acesso que ninguém nunca negou.
 */
describe("permissoesEfetivas", () => {
  const dosModulosNovos = ["insta_visualizar", "equipe_visualizar", "social_visualizar", "ia_visualizar"];

  it("sem a marca de versão, os módulos novos ficam abertos", () => {
    const efetivas = permissoesEfetivas(["wa_visualizar", "funil_visualizar"]);
    for (const id of dosModulosNovos) expect(efetivas, id).toContain(id);
    expect(efetivas).toContain("wa_visualizar");
  });

  it("com a marca, vale exatamente o que está marcado", () => {
    const efetivas = permissoesEfetivas([MARCA_DE_VERSAO, "wa_visualizar"]);
    expect(efetivas).toEqual([MARCA_DE_VERSAO, "wa_visualizar"]);
    for (const id of dosModulosNovos) expect(efetivas, id).not.toContain(id);
  });

  it("com a marca e nada mais, a pessoa não pode nada", () => {
    expect(permissoesEfetivas([MARCA_DE_VERSAO])).toEqual([MARCA_DE_VERSAO]);
  });

  it("lista vazia ou ausente é tratada como antiga", () => {
    expect(permissoesEfetivas([])).toContain("insta_visualizar");
    expect(permissoesEfetivas(null)).toContain("insta_visualizar");
    expect(permissoesEfetivas(undefined)).toContain("insta_visualizar");
  });

  it("não duplica o que já estava lá", () => {
    const efetivas = permissoesEfetivas(["insta_visualizar"]);
    expect(efetivas.filter((p) => p === "insta_visualizar")).toHaveLength(1);
  });
});
