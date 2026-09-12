import { describe, expect, it } from "vitest";

import { ehIpInterno, formatoDeDestinoAceito } from "../destino-externo";

/**
 * A vulnerabilidade que estes testes prendem: SSRF pela ação "chamar webhook" das automações.
 *
 * A pessoa digita um endereço e o SERVIDOR faz a chamada, de dentro da infraestrutura, com o
 * acesso de rede que ela tem e o visitante não. Apontando pro serviço de metadados da hospedagem
 * (169.254.169.254), a resposta pode conter credencial da própria máquina. Num SaaS isso não é
 * hipótese: qualquer cliente que assine o produto chega na tela de automações.
 */
describe("ehIpInterno", () => {
  it("barra o serviço de metadados da nuvem, que é o alvo clássico", () => {
    expect(ehIpInterno("169.254.169.254")).toBe(true);
  });

  it("barra laço local e faixas privadas", () => {
    expect(ehIpInterno("127.0.0.1")).toBe(true);
    expect(ehIpInterno("10.0.0.5")).toBe(true);
    expect(ehIpInterno("192.168.1.10")).toBe(true);
    expect(ehIpInterno("172.16.0.1")).toBe(true);
    expect(ehIpInterno("172.31.255.255")).toBe(true);
    expect(ehIpInterno("100.64.0.1")).toBe(true);
    expect(ehIpInterno("0.0.0.0")).toBe(true);
  });

  it("não barra faixa pública vizinha das privadas", () => {
    expect(ehIpInterno("172.32.0.1")).toBe(false);
    expect(ehIpInterno("172.15.0.1")).toBe(false);
    expect(ehIpInterno("8.8.8.8")).toBe(false);
    expect(ehIpInterno("200.150.10.1")).toBe(false);
  });

  it("barra os equivalentes em IPv6, inclusive IPv4 embutido", () => {
    expect(ehIpInterno("::1")).toBe(true);
    expect(ehIpInterno("fd00::1")).toBe(true);
    expect(ehIpInterno("fe80::1")).toBe(true);
    expect(ehIpInterno("::ffff:127.0.0.1")).toBe(true);
    expect(ehIpInterno("2606:4700:4700::1111")).toBe(false);
  });
});

describe("formatoDeDestinoAceito", () => {
  it("aceita um webhook público de verdade", () => {
    expect(formatoDeDestinoAceito("https://hooks.exemplo.com/abc").permitido).toBe(true);
  });

  it("recusa endereço escrito direto como IP interno", () => {
    expect(formatoDeDestinoAceito("http://169.254.169.254/latest/meta-data/").permitido).toBe(false);
    expect(formatoDeDestinoAceito("http://127.0.0.1:3000/admin").permitido).toBe(false);
    expect(formatoDeDestinoAceito("http://[::1]/").permitido).toBe(false);
  });

  // Nome sem ponto é nome de rede interna: `localhost`, ou o nome de um serviço no mesmo cluster.
  it("recusa nome de máquina interna", () => {
    expect(formatoDeDestinoAceito("http://localhost/webhook").permitido).toBe(false);
    expect(formatoDeDestinoAceito("http://banco:5432/").permitido).toBe(false);
  });

  it("recusa esquema que não é web", () => {
    expect(formatoDeDestinoAceito("file:///etc/passwd").permitido).toBe(false);
    expect(formatoDeDestinoAceito("gopher://exemplo.com/").permitido).toBe(false);
    expect(formatoDeDestinoAceito("não é url").permitido).toBe(false);
  });
});
