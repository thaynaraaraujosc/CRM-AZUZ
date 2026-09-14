import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { urlAssinadaDoR2 } from "../r2";

/**
 * A URL que tira a mídia da conta cara.
 *
 * O que ela substitui: a rota carregava o arquivo do R2 pra dentro da função e devolvia os bytes,
 * fazendo cada byte atravessar a Vercel duas vezes. Em setembro de 2026 isso deu 142 GB e quase
 * quinze dólares com UMA pessoa usando o CRM. Agora a função devolve um redirecionamento e o
 * navegador baixa direto da Cloudflare, que não cobra saída.
 *
 * POR QUE TESTAR ISTO COM CUIDADO: a assinatura SigV4 é tudo ou nada. Um caractere diferente na
 * ordem, na codificação ou no formato da data e o R2 responde `SignatureDoesNotMatch` — sem dizer
 * qual pedaço está errado. E a falha não aparece em desenvolvimento, onde não há R2 configurado:
 * aparece em produção, com toda foto e todo áudio das conversas parando de abrir de uma vez.
 */

const AMBIENTE = { ...process.env };

beforeEach(() => {
  process.env.R2_ENDPOINT = "https://conta.r2.cloudflarestorage.com";
  process.env.R2_BUCKET = "azuz";
  process.env.R2_ACCESS_KEY_ID = "chave-de-teste";
  process.env.R2_SECRET_ACCESS_KEY = "segredo-de-teste";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  process.env = { ...AMBIENTE };
});

describe("urlAssinadaDoR2", () => {
  it("aponta pro arquivo certo no bucket certo", () => {
    const url = new URL(urlAssinadaDoR2("workspace-1/abc.jpg"));
    expect(url.host).toBe("conta.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/azuz/workspace-1/abc.jpg");
  });

  it("leva os cinco parâmetros que o R2 exige, mais a assinatura", () => {
    const url = new URL(urlAssinadaDoR2("workspace-1/abc.jpg"));
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260914T120000Z");
    expect(url.searchParams.get("X-Amz-Credential")).toBe(
      "chave-de-teste/20260914/auto/s3/aws4_request",
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  /**
   * O prazo é o que torna o endereço descartável. Sem ele seria um link eterno pra um arquivo de
   * cliente, sobrevivendo em histórico de navegação e em print de tela.
   */
  it("vence, e o prazo é curto por padrão", () => {
    expect(new URL(urlAssinadaDoR2("a/b.jpg")).searchParams.get("X-Amz-Expires")).toBe("600");
    expect(
      new URL(urlAssinadaDoR2("a/b.jpg", { validadeSegundos: 60 })).searchParams.get("X-Amz-Expires"),
    ).toBe("60");
  });

  // A assinatura tem que cobrir o que ela promete cobrir: arquivo diferente, assinatura diferente.
  it("assina o arquivo, e não qualquer arquivo", () => {
    const a = new URL(urlAssinadaDoR2("workspace-1/abc.jpg")).searchParams.get("X-Amz-Signature");
    const b = new URL(urlAssinadaDoR2("workspace-2/abc.jpg")).searchParams.get("X-Amz-Signature");
    expect(a).not.toBe(b);
  });

  it("muda a assinatura quando o prazo muda", () => {
    const a = new URL(urlAssinadaDoR2("a/b.jpg", { validadeSegundos: 60 })).searchParams.get("X-Amz-Signature");
    const b = new URL(urlAssinadaDoR2("a/b.jpg", { validadeSegundos: 600 })).searchParams.get("X-Amz-Signature");
    expect(a).not.toBe(b);
  });

  /**
   * O que faz o PDF baixar em vez de abrir numa aba.
   *
   * O atributo `download` de um link só vale pra arquivo do mesmo domínio, e o arquivo agora vem
   * da Cloudflare. Sem este parâmetro, clicar em "baixar" abriria o documento e perderia o nome —
   * economizar na conta piorando o produto, que é o que não pode acontecer.
   */
  it("pede download com o nome original quando é documento", () => {
    const url = new URL(urlAssinadaDoR2("a/b.pdf", { nomeParaBaixar: "Contrato final.pdf" }));
    expect(url.searchParams.get("response-content-disposition")).toBe(
      'attachment; filename="Contrato final.pdf"',
    );
  });

  it("não pede download nenhum pra imagem e áudio, que abrem na própria tela", () => {
    const url = new URL(urlAssinadaDoR2("a/b.jpg"));
    expect(url.searchParams.has("response-content-disposition")).toBe(false);
  });

  /**
   * O nome do arquivo vem de fora: é o nome que alguém deu ao documento antes de mandar pelo
   * WhatsApp. Aspas e quebra de linha ali dentro sairiam do valor e virariam outro cabeçalho.
   */
  it("limpa aspas e quebra de linha do nome antes de assinar", () => {
    const url = new URL(
      urlAssinadaDoR2("a/b.pdf", { nomeParaBaixar: 'nota"\r\nX-Coisa: injetada.pdf' }),
    );
    const disposicao = url.searchParams.get("response-content-disposition") ?? "";
    expect(disposicao).not.toContain('"nota"');
    expect(disposicao).not.toContain("\n");
    expect(disposicao).toBe('attachment; filename="notaX-Coisa: injetada.pdf"');
  });

  it("não deixa o nome vazio derrubar o cabeçalho", () => {
    const url = new URL(urlAssinadaDoR2("a/b.pdf", { nomeParaBaixar: '""' }));
    expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="arquivo"');
  });

  // Espaço e acento no nome da chave são comuns (arquivo vindo do WhatsApp) e são exatamente o
  // tipo de caractere que quebra assinatura quando a codificação diverge.
  it("aguenta chave com espaço e acento", () => {
    const url = new URL(urlAssinadaDoR2("workspace-1/Proposta comercial ação.pdf"));
    expect(url.pathname).toBe("/azuz/workspace-1/Proposta%20comercial%20a%C3%A7%C3%A3o.pdf");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("recusa quando o R2 não está configurado, em vez de assinar com chave vazia", () => {
    delete process.env.R2_SECRET_ACCESS_KEY;
    expect(() => urlAssinadaDoR2("a/b.jpg")).toThrow(/R2 não configurado/);
  });
});
