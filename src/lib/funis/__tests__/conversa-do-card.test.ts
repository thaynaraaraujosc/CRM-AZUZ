import { describe, expect, it } from "vitest";

import {
  contatoDoCard,
  conversaDoCard,
  indicesDeContato,
  indicesDeConversa,
  nomeParaOCartao,
} from "@/lib/funis/conversa-do-card";

const GABRIELA = { nome: "GABRIELA KTM", contato: "556384544268", ehGrupo: false };
const ANA = { nome: "Ana Souza", contato: "5562999990000", ehGrupo: false };
const GRUPO = { nome: "Obra do Lucas", contato: "120363000000000000@g.us", ehGrupo: true };

const indices = indicesDeConversa([GABRIELA, ANA, GRUPO]);

/**
 * O CASO QUE DEU ORIGEM A ISTO.
 *
 * "Estou tentando procurar no meu funil a minha cliente Gabriela. Lá no WhatsApp eu achei (…) só
 * que no funil ela não aparece, o número dela não está sendo encontrado. É como se não houvesse
 * nenhuma conversa."
 *
 * O card nasceu chamado pelo telefone (a primeira mensagem não trouxe o nome de perfil) e a
 * conversa virou "GABRIELA KTM" depois. Os dois lados do CRM passaram a falar de pessoas
 * diferentes, e o cartão abria uma conversa vazia — o pior sintoma possível, porque quem olha
 * conclui que nunca falou com aquela pessoa.
 */
describe("conversaDoCard", () => {
  it("acha pelo nome quando os dois batem", () => {
    expect(conversaDoCard({ nome: "ana souza" }, indices)?.nome).toBe("Ana Souza");
  });

  it("acha pelo TELEFONE quando o card se chama pelo número", () => {
    expect(conversaDoCard({ nome: "556384544268" }, indices)?.nome).toBe("GABRIELA KTM");
  });

  it("acha pelo telefone do CONTATO quando os nomes divergem", () => {
    const achada = conversaDoCard({ nome: "Gabriela" }, indices, { whatsapp: "(63) 8454-4268" });
    expect(achada?.nome).toBe("GABRIELA KTM");
  });

  it("o nome ganha do telefone: é a ligação que o CRM inteiro usa", () => {
    // Card chamado "Ana Souza" com um contato cujo telefone é o da Gabriela (cadastro errado):
    // vale o nome, que é o que o resto do CRM casa.
    const achada = conversaDoCard({ nome: "Ana Souza" }, indices, { whatsapp: "556384544268" });
    expect(achada?.nome).toBe("Ana Souza");
  });

  it("telefone escrito de outro jeito continua achando", () => {
    // O mesmo número chega com e sem DDI, com e sem máscara, conforme o caminho.
    expect(conversaDoCard({ nome: "6384544268" }, indices)?.nome).toBe("GABRIELA KTM");
    expect(conversaDoCard({ nome: "Gabriela" }, indices, { whatsapp: "+55 63 8454-4268" })?.nome).toBe(
      "GABRIELA KTM",
    );
  });

  it("não casa com conversa de GRUPO", () => {
    // Ali `contato` é o JID do grupo, não o telefone de ninguém.
    expect(conversaDoCard({ nome: "120363000000000000" }, indices)).toBeNull();
  });

  it("card sem conversa nenhuma devolve nulo", () => {
    expect(conversaDoCard({ nome: "Quem Nunca Escreveu" }, indices)).toBeNull();
    expect(conversaDoCard({ nome: "5511000000000" }, indices)).toBeNull();
  });

  it("id curto demais não é tratado como telefone", () => {
    // Evita um card chamado "123" casar com qualquer coisa por acidente.
    const curtos = indicesDeConversa([{ nome: "X", contato: "123", ehGrupo: false }]);
    expect(conversaDoCard({ nome: "123" }, curtos)).toBeNull();
  });

  it("o primeiro do índice ganha: conversa repetida não troca a resposta entre renders", () => {
    const repetido = indicesDeConversa([GABRIELA, { ...GABRIELA, nome: "Gabriela (antiga)" }]);
    expect(conversaDoCard({ nome: "556384544268" }, repetido)?.nome).toBe("GABRIELA KTM");
  });
});

describe("contatoDoCard", () => {
  const contatos = indicesDeContato([
    { nome: "GABRIELA KTM", whatsapp: "556384544268" },
    { nome: "Ana Souza", whatsapp: "5562999990000" },
  ]);

  it("acha pelo nome quando os dois batem", () => {
    expect(contatoDoCard({ nome: "ana souza" }, contatos)?.nome).toBe("Ana Souza");
  });

  it("acha pelo telefone da conversa quando o card se chama pelo número", () => {
    // Era o caso da Gabriela: contato já com o nome certo, card ainda com o número. O cartão
    // ficava sem foto e sem a qualificação do lead — dois dados que existem.
    expect(contatoDoCard({ nome: "556384544268" }, contatos, GABRIELA)?.nome).toBe("GABRIELA KTM");
  });

  it("acha pelo próprio nome do card quando ele é um número, sem conversa nenhuma", () => {
    expect(contatoDoCard({ nome: "556384544268" }, contatos)?.nome).toBe("GABRIELA KTM");
  });

  it("não usa o JID de um grupo como telefone", () => {
    expect(contatoDoCard({ nome: "Obra do Lucas" }, contatos, GRUPO)).toBeNull();
  });

  it("sem contato correspondente devolve nulo", () => {
    expect(contatoDoCard({ nome: "Ninguém" }, contatos)).toBeNull();
  });
});

describe("nomeParaOCartao", () => {
  it("card chamado pelo número mostra o nome da conversa", () => {
    expect(nomeParaOCartao({ nome: "556384544268" }, GABRIELA)).toBe("GABRIELA KTM");
  });

  it("nome de verdade nunca é trocado por outro", () => {
    // Quem renomeou um card à mão escolheu aquele nome.
    expect(nomeParaOCartao({ nome: "Gabriela da KTM" }, GABRIELA)).toBe("Gabriela da KTM");
  });

  it("conversa que também se chama pelo número não muda nada", () => {
    const semNome = { nome: "556384544268", contato: "556384544268", ehGrupo: false };
    expect(nomeParaOCartao({ nome: "556384544268" }, semNome)).toBe("556384544268");
  });

  it("sem conversa, fica o nome do card", () => {
    expect(nomeParaOCartao({ nome: "556384544268" }, null)).toBe("556384544268");
  });
});
