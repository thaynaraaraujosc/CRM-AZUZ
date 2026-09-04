import { describe, expect, it } from "vitest";
import { cabecalhosComEtag, clienteJaTem, montarEtag, naoModificado } from "@/lib/conversas/assinatura";

describe("assinatura das rotas de conversa", () => {
  it("mesma entrada gera o mesmo etag", () => {
    const a = montarEtag(["ws1", "meta_instagram:1", 42, new Date(1000), null]);
    const b = montarEtag(["ws1", "meta_instagram:1", 42, new Date(1000), null]);
    expect(a).toBe(b);
  });

  it("muda quando chega mensagem nova (contagem)", () => {
    const antes = montarEtag(["ws1", "", 42, new Date(1000), null]);
    const depois = montarEtag(["ws1", "", 43, new Date(1000), null]);
    expect(antes).not.toBe(depois);
  });

  it("muda quando só o status foi reescrito (atualizadoEm)", () => {
    const antes = montarEtag(["ws1", "", 42, new Date(1000), new Date(2000)]);
    const depois = montarEtag(["ws1", "", 42, new Date(1000), new Date(3000)]);
    expect(antes).not.toBe(depois);
  });

  it("muda quando o recorte de conexões muda, sem mexer em mensagem", () => {
    const antes = montarEtag(["ws1", "meta_instagram:1", 42, new Date(1000), null]);
    const depois = montarEtag(["ws1", "", 42, new Date(1000), null]);
    expect(antes).not.toBe(depois);
  });

  it("workspaces diferentes nunca colidem", () => {
    expect(montarEtag(["ws1", "", 1, null, null])).not.toBe(montarEtag(["ws2", "", 1, null, null]));
  });

  it("nao vaza o identificador do workspace no cabecalho", () => {
    expect(montarEtag(["workspace-secreto-123", "", 1, null, null])).not.toContain("workspace-secreto");
  });

  it("reconhece o cliente que ja tem a versao", () => {
    const etag = montarEtag(["ws1", "", 1, null, null]);
    const req = new Request("http://x", { headers: { "if-none-match": etag } });
    expect(clienteJaTem(req, etag)).toBe(true);
    expect(clienteJaTem(new Request("http://x"), etag)).toBe(false);
    expect(clienteJaTem(new Request("http://x", { headers: { "if-none-match": '"velho"' } }), etag)).toBe(false);
  });

  it("304 vai sem corpo e com o etag", async () => {
    const etag = montarEtag(["ws1", "", 1, null, null]);
    const r = naoModificado(etag);
    expect(r.status).toBe(304);
    expect(r.headers.get("etag")).toBe(etag);
    expect(await r.text()).toBe("");
  });

  it("resposta com conteudo nao pode ser guardada por cache compartilhado", () => {
    expect(cabecalhosComEtag('"x"')["cache-control"]).toContain("private");
  });
});
