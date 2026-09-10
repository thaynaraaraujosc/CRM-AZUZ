import { describe, expect, it } from "vitest";

import { filtroContaCanal, type ContasVisiveis } from "../conta-canal";

/**
 * O defeito que estes testes prendem: negócio novo aparecendo no funil e a conversa dele em lugar
 * nenhum no WhatsApp.
 *
 * As duas telas respondiam à mesma pergunta com regras diferentes. O funil aceitava qualquer
 * conversa do PROVEDOR ligado; a caixa de entrada exigia o identificador EXATO gravado nos
 * metadados da integração. Quando esse identificador falta (conexão de pé, metadados escritos por
 * um caminho antigo, ou a chamada que preenche o número falhou), o card aparecia e a conversa
 * sumia, sem erro em lugar nenhum.
 */
function visiveis(parcial: Partial<ContasVisiveis>): ContasVisiveis {
  return { contas: [], prefixosSemIdentificador: [], ...parcial };
}

const ramos = (f: ReturnType<typeof filtroContaCanal>) =>
  JSON.stringify("OR" in f ? f.OR : f);

describe("o que a caixa de entrada mostra", () => {
  it("com o identificador conhecido, casa o número exato", () => {
    const f = filtroContaCanal(visiveis({ contas: ["meta_whatsapp:111"] }));
    expect(ramos(f)).toContain("meta_whatsapp:111");
    expect(ramos(f)).not.toContain("startsWith");
  });

  it("conexão ligada SEM identificador mostra o provedor inteiro, em vez de esconder tudo", () => {
    const f = filtroContaCanal(visiveis({ prefixosSemIdentificador: ["meta_whatsapp"] }));
    expect(ramos(f)).toContain("meta_whatsapp:");
    expect(ramos(f)).toContain("startsWith");
  });

  it("nada conectado continua devolvendo caixa de entrada vazia", () => {
    const f = filtroContaCanal(visiveis({}));
    expect(JSON.stringify(f)).toContain("__nenhuma-conexao-ativa__");
  });

  it("o histórico sem marca entra quando o QR Code está ligado", () => {
    const f = filtroContaCanal(visiveis({ contas: ["whatsapp_nao_oficial:5562", null] }));
    expect(ramos(f)).toContain('"contaCanal":null');
  });
});
