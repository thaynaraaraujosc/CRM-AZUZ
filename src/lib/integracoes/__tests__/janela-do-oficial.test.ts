import { describe, expect, it } from "vitest";

import {
  JANELA_DO_OFICIAL_MS,
  chegouPeloOficial,
  janelaAbertaPelasMensagens,
} from "@/lib/integracoes/janela-do-oficial";
import { CANAL_NAO_OFICIAL, CANAL_OFICIAL } from "@/lib/integracoes/conta-canal";

const AGORA = new Date("2026-11-12T18:00:00.000Z").getTime();
const haMinutos = (m: number) => new Date(AGORA - m * 60_000);

describe("os nomes dos canais continuam iguais aos de verdade", () => {
  /*
   * `janela-do-oficial.ts` escreve os nomes dos canais em vez de importá-los, porque a regra roda
   * também no NAVEGADOR e `conta-canal.ts` puxa o banco junto — importá-lo derruba o build. Este
   * teste é o que transforma a cópia numa cópia VIGIADA: renomear um canal lá e esquecer aqui
   * faria a janela do oficial voltar a contar mensagem do QR Code, em silêncio.
   */
  it("batem com `conta-canal.ts`", () => {
    expect(chegouPeloOficial({ canal: CANAL_OFICIAL })).toBe(true);
    expect(chegouPeloOficial({ canal: CANAL_NAO_OFICIAL })).toBe(false);
  });
});

describe("chegouPeloOficial", () => {
  it("mensagem do QR Code NÃO abre a janela do oficial", () => {
    /*
     * O defeito inteiro em uma linha. Pro número oficial, aquela pessoa nunca escreveu — a
     * conversa toda aconteceu pelo aparelho. Contar essas mensagens fazia o CRM mandar texto
     * livre pela Cloud API e a Meta recusar.
     */
    expect(chegouPeloOficial({ canal: "whatsapp_nao_oficial" })).toBe(false);
  });

  it("o nome antigo da conexão não oficial também não abre", () => {
    expect(chegouPeloOficial({ canal: "whatsapp_baileys" })).toBe(false);
  });

  it("mensagem do oficial abre", () => {
    expect(chegouPeloOficial({ canal: "meta_whatsapp" })).toBe(true);
  });

  it("canal nulo conta como oficial — é o que a coluna significa", () => {
    // Está escrito no schema: nulo = comportamento antigo, implicitamente Meta oficial. Tratar
    // como não-oficial pediria modelo aprovado em toda conversa anterior ao QR Code.
    expect(chegouPeloOficial({ canal: null })).toBe(true);
    expect(chegouPeloOficial({})).toBe(true);
  });
});

describe("janelaAbertaPelasMensagens", () => {
  it("conversa inteira no QR Code: a janela do oficial está FECHADA", () => {
    const recebidas = [
      { canal: "whatsapp_nao_oficial", criadoEm: haMinutos(5) },
      { canal: "whatsapp_nao_oficial", criadoEm: haMinutos(60) },
    ];
    expect(janelaAbertaPelasMensagens(recebidas, AGORA)).toBe(false);
  });

  it("uma mensagem recente pelo oficial abre, mesmo no meio de muitas do QR Code", () => {
    const recebidas = [
      { canal: "whatsapp_nao_oficial", criadoEm: haMinutos(5) },
      { canal: "meta_whatsapp", criadoEm: haMinutos(120) },
    ];
    expect(janelaAbertaPelasMensagens(recebidas, AGORA)).toBe(true);
  });

  it("mensagem do oficial de mais de 24h não abre", () => {
    const recebidas = [{ canal: "meta_whatsapp", criadoEm: new Date(AGORA - JANELA_DO_OFICIAL_MS - 1) }];
    expect(janelaAbertaPelasMensagens(recebidas, AGORA)).toBe(false);
  });

  it("no limite exato de 24h está fechada", () => {
    const recebidas = [{ canal: null, criadoEm: new Date(AGORA - JANELA_DO_OFICIAL_MS) }];
    expect(janelaAbertaPelasMensagens(recebidas, AGORA)).toBe(false);
  });

  it("sem mensagem nenhuma, fechada — é a primeira conversa com aquela pessoa", () => {
    expect(janelaAbertaPelasMensagens([], AGORA)).toBe(false);
  });

  it("mensagem sem data é ignorada em vez de abrir a janela por engano", () => {
    expect(janelaAbertaPelasMensagens([{ canal: null, criadoEm: null }], AGORA)).toBe(false);
  });

  it("aceita a data como número, que é como ela chega no navegador", () => {
    // A mesma regra roda nos dois lados: o servidor recusa o envio e a TELA oferece o modelo antes
    // de a pessoa digitar. Uma cópia em cada lugar é como os dois passam a discordar.
    expect(janelaAbertaPelasMensagens([{ canal: null, criadoEm: AGORA - 60_000 }], AGORA)).toBe(true);
    expect(janelaAbertaPelasMensagens([{ canal: null, criadoEm: Number.NaN }], AGORA)).toBe(false);
  });
});
