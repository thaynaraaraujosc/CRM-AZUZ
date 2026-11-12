import { describe, expect, it } from "vitest";
import {
  API_PERMISSAO,
  API_SEMPRE_LIBERADA,
  ROTA_PERMISSAO,
  permissaoDoEndereco,
} from "@/lib/permissao-da-rota";

/**
 * A TRANCA, E POR QUE ELA PRECISA DE TESTE.
 *
 * "Fiz um acesso pra um funcionário, coloquei que ele não podia ficar com os dois WhatsApp, e ele
 * me mandou o print: tá com acesso do WhatsApp, do Insta, de coisas que eu tinha tirado."
 *
 * O bloqueio por permissão pulava `/api` — a tela era barrada e os dados não. Estes testes
 * existem pra que ninguém volte a abrir essa porta sem perceber: um `/api` novo que esqueça de
 * entrar no mapa continua liberado, e isso é uma decisão que tem que ser consciente.
 */
describe("permissaoDoEndereco", () => {
  it("exige a permissão do módulo nas telas", () => {
    expect(permissaoDoEndereco("/instagram")).toBe("insta_visualizar");
    expect(permissaoDoEndereco("/conversas")).toBe("wa_visualizar");
    expect(permissaoDoEndereco("/funil/qualquer-coisa")).toBe("funil_visualizar");
  });

  it("exige a MESMA permissão na API do módulo — era aqui que passava tudo", () => {
    expect(permissaoDoEndereco("/api/instagram")).toBe("insta_visualizar");
    expect(permissaoDoEndereco("/api/instagram/conversas")).toBe("insta_visualizar");
    expect(permissaoDoEndereco("/api/conversas")).toBe("wa_visualizar");
    expect(permissaoDoEndereco("/api/mensagens-extra?contato=x")).toBe("wa_visualizar");
  });

  it("casa pelo prefixo MAIS LONGO, não pelo primeiro que aparecer", () => {
    // Sem isso, qual regra vale depende da ordem em que o objeto foi escrito.
    expect(permissaoDoEndereco("/api/integracoes/numeros")).toBe("config_visualizar");
  });

  it("deixa passar o que toda pessoa logada precisa", () => {
    for (const livre of API_SEMPRE_LIBERADA) {
      expect(permissaoDoEndereco(livre), livre).toBeNull();
      expect(permissaoDoEndereco(`${livre}/algo`), livre).toBeNull();
    }
  });

  it("não confunde um prefixo com um endereço que só começa igual", () => {
    // `/api/contatos-publicos` não é `/api/contatos`: casar por texto solto pegaria os dois.
    expect(permissaoDoEndereco("/api/contatos")).toBe("contatos_visualizar");
    expect(permissaoDoEndereco("/api/contatos-publicos")).toBeNull();
  });

  it("endereço fora do mapa fica livre, e isso é deliberado", () => {
    // Bloquear por padrão quebraria o CRM a cada rota nova; o teste acima é que obriga a pensar.
    expect(permissaoDoEndereco("/api/alguma-coisa-nova")).toBeNull();
  });

  it("toda permissão citada existe de verdade nos dois mapas", () => {
    const todas = new Set([...Object.values(ROTA_PERMISSAO), ...Object.values(API_PERMISSAO)]);
    for (const p of todas) {
      expect(p, p).toMatch(/_visualizar$/);
    }
  });

  it("todo módulo com tela restringível tem a API dele restringida também", () => {
    // É a regra que fecha o buraco: tela barrada com API aberta não protege nada.
    const naTela = new Set(Object.values(ROTA_PERMISSAO));
    const naApi = new Set(Object.values(API_PERMISSAO));
    for (const permissao of naTela) {
      expect(naApi.has(permissao), `${permissao} não tem nenhuma API protegida`).toBe(true);
    }
  });
});
