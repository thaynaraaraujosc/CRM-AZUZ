import { describe, expect, it } from "vitest";

import {
  CANAIS_PARA_TESTE,
  mensagemEhDaConexao,
  quantasDeOutraConexao,
} from "@/lib/conversas/mensagem-da-conexao";
import { CANAL_NAO_OFICIAL, CANAL_OFICIAL } from "@/lib/integracoes/conta-canal";

const OFICIAL = `${CANAL_OFICIAL}:109876543210`;
const QR = `${CANAL_NAO_OFICIAL}:5562994361377`;
const OUTRO_OFICIAL = `${CANAL_OFICIAL}:555000111222`;

describe("os nomes dos canais continuam iguais aos de verdade", () => {
  /*
   * Mesmo motivo de `janela-do-oficial.ts`: esta regra roda no NAVEGADOR e `conta-canal.ts` puxa o
   * banco junto, então os nomes estão escritos lá em vez de importados. Este teste é o que
   * transforma a cópia numa cópia VIGIADA — renomear um canal e esquecer aqui faria a separação
   * parar de separar, em silêncio, que é a pior forma de errar aqui.
   */
  it("batem com `conta-canal.ts`", () => {
    expect(CANAIS_PARA_TESTE.CANAL_OFICIAL).toBe(CANAL_OFICIAL);
    expect(CANAIS_PARA_TESTE.CANAL_NAO_OFICIAL).toBe(CANAL_NAO_OFICIAL);
  });
});

describe("mensagemEhDaConexao", () => {
  it("o defeito: conversa pelo número oficial NÃO mostra o histórico do QR Code", () => {
    /*
     * "Eu nunca tinha mandado mensagem para esse número, e ele está puxando as mensagens do número
     * do QR Code. Está parecendo como se eu já tivesse conversado com esse contato antes."
     *
     * No aparelho dela, o número oficial abriu um chat VAZIO. O CRM mostrava meses de conversa
     * acima da primeira mensagem — histórico que o outro lado não tem na frente dele.
     */
    expect(mensagemEhDaConexao({ canal: CANAL_NAO_OFICIAL, contaCanal: QR }, OFICIAL)).toBe(false);
  });

  it("e o contrário também: a conversa do QR Code não mostra a do oficial", () => {
    expect(mensagemEhDaConexao({ canal: CANAL_OFICIAL, contaCanal: OFICIAL }, QR)).toBe(false);
  });

  it("a mensagem da própria conexão aparece", () => {
    expect(mensagemEhDaConexao({ canal: CANAL_OFICIAL, contaCanal: OFICIAL }, OFICIAL)).toBe(true);
    expect(mensagemEhDaConexao({ canal: CANAL_NAO_OFICIAL, contaCanal: QR }, QR)).toBe(true);
  });

  it("dois números do MESMO canal se separam — é o que só o `contaCanal` resolve", () => {
    /*
     * Com dois números oficiais, `canal` é igual nos dois e não separa nada. A conta é a única
     * identidade que distingue, e é por isso que ela é a primeira camada e não a última.
     */
    expect(mensagemEhDaConexao({ canal: CANAL_OFICIAL, contaCanal: OUTRO_OFICIAL }, OFICIAL)).toBe(
      false,
    );
  });

  it("sem `contaCanal` na mensagem, o canal decide", () => {
    /*
     * Acontece de verdade: `PUT /api/mensagens-extra` grava o `contaCanal` a partir da CONVERSA, e
     * entre o envio e a conversa mudar de casa existe o intervalo do sincronismo. O `canal` é
     * escrito na hora do envio e não depende dessa corrida — por isso ele é a rede de baixo.
     */
    expect(mensagemEhDaConexao({ canal: CANAL_NAO_OFICIAL }, OFICIAL)).toBe(false);
    expect(mensagemEhDaConexao({ canal: CANAL_OFICIAL }, OFICIAL)).toBe(true);
  });

  it("`whatsapp_baileys` é a conexão não oficial com o nome antigo", () => {
    // Os dois nomes convivem no banco. Tratá-los como conexões diferentes esconderia metade do
    // histórico do QR Code da própria conversa do QR Code.
    expect(mensagemEhDaConexao({ canal: "whatsapp_baileys" }, QR)).toBe(true);
    expect(
      mensagemEhDaConexao({ contaCanal: "whatsapp_baileys:5562994361377" }, QR),
    ).toBe(true);
    expect(mensagemEhDaConexao({ canal: "whatsapp_baileys" }, OFICIAL)).toBe(false);
  });

  it("mensagem sem canal e sem conta APARECE — é histórico de antes das colunas existirem", () => {
    /*
     * Esta é a decisão conservadora, e é de propósito. Esconder mensagem antiga de quem nunca
     * mexeu em conexão nenhuma seria apagar a conversa da tela no dia da publicação. "Dado vivo
     * escondido por uma mudança de filtro é a pior forma de perder conversa."
     */
    expect(mensagemEhDaConexao({}, OFICIAL)).toBe(true);
    expect(mensagemEhDaConexao({ canal: null, contaCanal: null }, QR)).toBe(true);
  });

  it("conversa sem conexão definida mostra tudo, como sempre foi", () => {
    expect(mensagemEhDaConexao({ canal: CANAL_NAO_OFICIAL, contaCanal: QR }, null)).toBe(true);
    expect(mensagemEhDaConexao({ canal: CANAL_OFICIAL }, undefined)).toBe(true);
    expect(mensagemEhDaConexao({ canal: CANAL_OFICIAL }, "")).toBe(true);
  });

  it("canal que o CRM não conhece não é escondido", () => {
    // Instagram, ou um canal que entre depois. A regra separa o que ela sabe separar; o resto
    // continua visível em vez de desaparecer sem ninguém entender por quê.
    expect(mensagemEhDaConexao({ canal: "meta_instagram" }, "meta_instagram:17841400000")).toBe(true);
  });
});

describe("quantasDeOutraConexao", () => {
  it("conta o que ficou de fora, pra tela poder oferecer de volta", () => {
    /*
     * O número existe porque a separação precisa ser REVERSÍVEL na tela. Esconder sem dizer
     * quanto foi escondido é a versão silenciosa do mesmo defeito.
     */
    const mensagens = [
      { canal: CANAL_NAO_OFICIAL, contaCanal: QR },
      { canal: CANAL_NAO_OFICIAL, contaCanal: QR },
      { canal: CANAL_OFICIAL, contaCanal: OFICIAL },
      {},
    ];
    expect(quantasDeOutraConexao(mensagens, OFICIAL)).toBe(2);
    expect(quantasDeOutraConexao(mensagens, QR)).toBe(1);
  });

  it("conversa sem conexão não esconde nada, então não tem nada a oferecer", () => {
    expect(quantasDeOutraConexao([{ canal: CANAL_NAO_OFICIAL }], null)).toBe(0);
  });
});
