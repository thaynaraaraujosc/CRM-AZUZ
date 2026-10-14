import { describe, expect, it } from "vitest";

import { lerJson } from "../ler-resposta";

/**
 * O erro que chegou à tela em produção: `Unexpected end of JSON input`.
 *
 * `await r.json()` num corpo vazio LANÇA, e a mensagem lançada é sobre um método do navegador —
 * não sobre o problema. Ela viajou até o `catch` e foi mostrada como se fosse a explicação.
 */
describe("lerJson", () => {
  function resposta(corpo: string, status = 200, tipo = "application/json") {
    return new Response(corpo, { status, headers: { "content-type": tipo } });
  }

  it("lê o JSON quando ele está lá", async () => {
    const r = await lerJson<{ chave: string }>(resposta('{"chave":"azflow_abc"}'), "padrão");
    expect(r).toEqual({ ok: true, dados: { chave: "azflow_abc" } });
  });

  it("corpo VAZIO com 500 vira a frase padrão, não exceção", async () => {
    const r = await lerJson(resposta("", 500), "Não deu pra gerar a chave.");
    expect(r).toEqual({ ok: false, erro: "Não deu pra gerar a chave." });
  });

  it("usa a mensagem do servidor quando ela existe", async () => {
    const r = await lerJson(resposta('{"ok":false,"erro":"O banco está sem a estrutura."}', 503), "padrão");
    expect(r).toEqual({ ok: false, erro: "O banco está sem a estrutura." });
  });

  it("corpo que não é JSON (página de erro em HTML) vira a frase padrão", async () => {
    const r = await lerJson(resposta("<html>500</html>", 500, "text/html"), "padrão");
    expect(r).toEqual({ ok: false, erro: "padrão" });
  });

  it("2xx com corpo vazio também não passa como sucesso", async () => {
    // Senão quem chamou segue com `dados` indefinido e quebra uma linha depois, longe da causa.
    const r = await lerJson(resposta("", 200), "padrão");
    expect(r).toEqual({ ok: false, erro: "padrão" });
  });

  it("erro que não é string no campo `erro` não vaza pra tela", async () => {
    const r = await lerJson(resposta('{"erro":{"codigo":500}}', 500), "padrão");
    expect(r).toEqual({ ok: false, erro: "padrão" });
  });
});
