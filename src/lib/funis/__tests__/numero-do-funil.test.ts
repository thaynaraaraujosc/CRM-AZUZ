import { describe, expect, it } from "vitest";

import {
  PREFIXO_DO_NOME,
  funilDoNumero,
  nomeDoFunil,
  numeroDoFunil,
  numerosDisponiveis,
  numerosNaOrdemDosFunis,
  sufixoSugerido,
  type FunilComNumero,
  type NumeroParaFunil,
} from "@/lib/funis/numero-do-funil";

const OFICIAL: NumeroParaFunil = {
  chave: "meta_whatsapp:143588938831846",
  nome: "API oficial",
  provedor: "meta_whatsapp",
  status: "conectado",
};

const QR: NumeroParaFunil = {
  chave: "whatsapp_nao_oficial:5562963404 38".replace(" ", ""),
  nome: "+55 (62) 9634-0438",
  provedor: "whatsapp_nao_oficial",
  status: "conectado",
};

const SEM_CHAVE: NumeroParaFunil = { chave: "", nome: "QR Code", provedor: "whatsapp_nao_oficial", status: "aguardando_qr" };
const CAIU: NumeroParaFunil = { ...QR, chave: "whatsapp_nao_oficial:5562999990000", nome: "Vendas 2", status: "desconectado" };

const FUNIL_DO_QR: FunilComNumero = { id: "f1", nome: "Funil - Emilly", contaCanal: QR.chave };
const FUNIL_ANTIGO: FunilComNumero = { id: "f0", nome: "Funil comercial", contaCanal: null };

/**
 * "Nenhum funil pode ter mais do que um número. Não pode receber mensagens de WhatsApps
 * diferentes." A regra dupla: um funil tem um número, e um número tem um funil.
 */
describe("funilDoNumero", () => {
  it("acha o funil que já é daquele número", () => {
    expect(funilDoNumero([FUNIL_ANTIGO, FUNIL_DO_QR], QR.chave)?.id).toBe("f1");
  });

  it("número sem funil devolve nulo", () => {
    expect(funilDoNumero([FUNIL_ANTIGO, FUNIL_DO_QR], OFICIAL.chave)).toBeNull();
  });

  it("chave vazia não casa com funil sem número", () => {
    // `contaCanal: null` quer dizer "funil antigo, sem número", não "funil do número vazio". Sem a
    // guarda, uma conexão de QR Code que o CRM ainda não endereçou pareceria dona dele.
    expect(funilDoNumero([FUNIL_ANTIGO], "")).toBeNull();
  });
});

describe("numerosDisponiveis", () => {
  it("tira o número que já tem funil", () => {
    expect(numerosDisponiveis([OFICIAL, QR], [FUNIL_DO_QR]).map((n) => n.chave)).toEqual([OFICIAL.chave]);
  });

  it("tira o desconectado e o que não tem chave", () => {
    // Escolher um número que o CRM não sabe endereçar criaria um quadro que não recebe nada e não
    // diz por quê.
    expect(numerosDisponiveis([OFICIAL, SEM_CHAVE, CAIU], []).map((n) => n.chave)).toEqual([OFICIAL.chave]);
  });

  it("com todos os números já usados, não sobra nenhum", () => {
    const funis = [FUNIL_DO_QR, { id: "f2", nome: "Funil - oficial", contaCanal: OFICIAL.chave }];
    expect(numerosDisponiveis([OFICIAL, QR], funis)).toEqual([]);
  });
});

describe("numeroDoFunil", () => {
  it("devolve o número do funil", () => {
    expect(numeroDoFunil([OFICIAL, QR], FUNIL_DO_QR)?.nome).toBe(QR.nome);
  });

  it("funil sem número devolve nulo", () => {
    expect(numeroDoFunil([OFICIAL, QR], FUNIL_ANTIGO)).toBeNull();
  });

  it("número que já não está conectado devolve nulo em vez de rótulo inventado", () => {
    expect(numeroDoFunil([OFICIAL], FUNIL_DO_QR)).toBeNull();
  });
});

describe("nomeDoFunil", () => {
  it("junta o prefixo fixo com o que a pessoa escreveu", () => {
    expect(nomeDoFunil("Meta oficial")).toBe("Funil - Meta oficial");
    expect(nomeDoFunil("Meta oficial").startsWith(PREFIXO_DO_NOME)).toBe(true);
  });

  it("arruma espaço sobrando", () => {
    expect(nomeDoFunil("  Número  do  Lucas ")).toBe("Funil - Número do Lucas");
  });

  it("sufixo vazio não vira nome: 'Funil - ' sozinho não é nome de nada", () => {
    expect(nomeDoFunil("")).toBe("");
    expect(nomeDoFunil("   ")).toBe("");
  });
});

describe("sufixoSugerido", () => {
  it("sugere o nome do número escolhido", () => {
    expect(sufixoSugerido(QR)).toBe("+55 (62) 9634-0438");
  });

  it("sem número escolhido, não sugere nada", () => {
    expect(sufixoSugerido(null)).toBe("");
  });
});

describe("numerosNaOrdemDosFunis", () => {
  const funis: FunilComNumero[] = [
    { id: "f-qr", nome: "Funil - Azuz", contaCanal: QR.chave },
    { id: "f-oficial", nome: "Funil - oficial", contaCanal: OFICIAL.chave },
  ];

  it("põe os números na ordem dos funis", () => {
    // Na lista de conexões o oficial vem primeiro; na ordem dos funis, o QR.
    expect(numerosNaOrdemDosFunis([OFICIAL, QR], funis).map((n) => n.chave)).toEqual([
      QR.chave,
      OFICIAL.chave,
    ]);
  });

  it("número sem funil vai pro fim, na ordem que já tinha", () => {
    const outro = { ...CAIU, chave: "whatsapp_nao_oficial:5562911110000", nome: "Vendas 3" };
    const r = numerosNaOrdemDosFunis([OFICIAL, CAIU, outro, QR], funis);
    expect(r.map((n) => n.nome)).toEqual([QR.nome, OFICIAL.nome, CAIU.nome, outro.nome]);
  });

  it("sem funil nenhum, a ordem não muda", () => {
    expect(numerosNaOrdemDosFunis([OFICIAL, QR], []).map((n) => n.chave)).toEqual([
      OFICIAL.chave,
      QR.chave,
    ]);
  });

  it("não altera a lista recebida", () => {
    const lista = [OFICIAL, QR];
    numerosNaOrdemDosFunis(lista, funis);
    expect(lista.map((n) => n.chave)).toEqual([OFICIAL.chave, QR.chave]);
  });
});
