import { describe, expect, it } from "vitest";

import {
  CANAIS_PARA_TESTE,
  canalTemNumero,
  funisDoNumero,
  nomeDoNumeroDeEnvio,
  numerosDeEnvio,
  porQueOCanalNaoServe,
} from "@/lib/campanhas/canais-de-envio";
import { CANAL_NAO_OFICIAL, CANAL_OFICIAL } from "@/lib/integracoes/conta-canal";
import type { NumeroDeWhatsApp } from "@/lib/integracoes/numeros-de-whatsapp";

const numero = (p: Partial<NumeroDeWhatsApp>): NumeroDeWhatsApp => ({
  chave: "",
  provedor: CANAL_NAO_OFICIAL,
  slot: 1,
  nome: "",
  apelido: null,
  numeroLegivel: "",
  status: "conectado",
  erroMensagem: null,
  qrDataUrl: null,
  funilId: null,
  responsavel: null,
  ...p,
});

const OFICIAL = numero({
  chave: `${CANAL_OFICIAL}:109876543210`,
  provedor: CANAL_OFICIAL,
  nome: "Comercial",
  numeroLegivel: "+55 62 9217-5826",
});
const QR = numero({
  chave: `${CANAL_NAO_OFICIAL}:5562994361377`,
  nome: "Thaynara",
  numeroLegivel: "+55 62 99436-1377",
  slot: 2,
});

describe("os nomes dos canais continuam iguais aos de verdade", () => {
  /*
   * `canais-de-envio.ts` escreve os nomes dos provedores em vez de importá-los: a regra roda no
   * navegador e `conta-canal.ts` puxa o banco junto — importá-lo derruba o build. Este teste é o
   * que transforma a cópia numa cópia VIGIADA: renomear um canal lá e esquecer aqui faria o passo
   * do canal etiquetar o número oficial como QR Code, em silêncio.
   */
  it("batem com `conta-canal.ts`", () => {
    expect(CANAIS_PARA_TESTE.CANAL_OFICIAL).toBe(CANAL_OFICIAL);
    expect(CANAIS_PARA_TESTE.CANAL_NAO_OFICIAL).toBe(CANAL_NAO_OFICIAL);
  });
});

describe("numerosDeEnvio", () => {
  it("um item por NÚMERO, com a etiqueta do canal na frente", () => {
    // "Aqui tem que aparecer todos os WhatsApps que estão conectados. E na frente tem que mostrar
    // se ele é uma API oficial ou API não oficial."
    expect(numerosDeEnvio([OFICIAL, QR])).toEqual([
      {
        contaCanal: `${CANAL_OFICIAL}:109876543210`,
        canal: "whatsapp_oficial",
        nome: "Comercial",
        etiqueta: "API oficial",
        numeroLegivel: "+55 62 9217-5826",
      },
      {
        contaCanal: `${CANAL_NAO_OFICIAL}:5562994361377`,
        canal: "whatsapp_nao_oficial",
        nome: "Thaynara",
        etiqueta: "QR Code",
        numeroLegivel: "+55 62 99436-1377",
      },
    ]);
  });

  it("dois números do MESMO canal aparecem os dois", () => {
    /*
     * É o caso de quem vende com equipe: cada vendedor com o seu QR Code. O formato antigo, um
     * item por provedor, mostrava um só — e o disparo saía pelo que o CRM escolhesse sozinho.
     */
    const outro = numero({ chave: `${CANAL_NAO_OFICIAL}:5511999998888`, nome: "Closer", slot: 3 });
    expect(numerosDeEnvio([QR, outro]).map((n) => n.nome)).toEqual(["Thaynara", "Closer"]);
  });

  it("número desconectado não entra: não tem como sair por ele", () => {
    expect(numerosDeEnvio([numero({ ...QR, status: "desconectado" })])).toEqual([]);
  });

  it("conexão ligada SEM número descoberto não entra", () => {
    /*
     * Acontece de verdade: a sessão está de pé, mas os metadados não trouxeram o telefone. Na tela
     * de Configurações ela precisa aparecer (é de lá que sai o reconectar). Aqui não: escolher por
     * onde mandar exige saber qual número é, e um item sem isso vira um disparo que falha depois.
     */
    expect(numerosDeEnvio([numero({ chave: "", status: "conectado" })])).toEqual([]);
  });
});

describe("canalTemNumero", () => {
  it("diz se o canal tem alguém de pé", () => {
    const envio = numerosDeEnvio([QR]);
    expect(canalTemNumero(envio, "whatsapp_nao_oficial")).toBe(true);
    expect(canalTemNumero(envio, "whatsapp_oficial")).toBe(false);
  });
});

describe("porQueOCanalNaoServe", () => {
  it("nunca conectou: manda conectar", () => {
    expect(porQueOCanalNaoServe([], CANAL_NAO_OFICIAL)).toMatch(/Escaneie o QR Code/i);
    expect(porQueOCanalNaoServe([], CANAL_OFICIAL)).toMatch(/Conecte a API oficial/i);
  });

  it("conectou e caiu: a frase é outra, porque o pedido é outro", () => {
    /*
     * "Escaneie o QR Code em Configurações" dito pra quem já escaneou não é só impreciso: manda
     * fazer de novo o que já foi feito, sem dizer que a sessão caiu.
     */
    expect(porQueOCanalNaoServe([numero({ ...QR, status: "desconectado" })], CANAL_NAO_OFICIAL)).toMatch(
      /caiu/i,
    );
  });

  it("de pé mas sem número: diz exatamente isso", () => {
    expect(porQueOCanalNaoServe([numero({ chave: "", status: "conectado" })], CANAL_NAO_OFICIAL)).toMatch(
      /ainda não descobriu o número/i,
    );
  });
});

describe("funisDoNumero", () => {
  const funis = [
    { id: "padrao", nome: "Funil - Comercial" },
    { id: "oficial", nome: "Funil - Meta", contaCanais: [`${CANAL_OFICIAL}:109876543210`] },
    { id: "qr", nome: "Funil - Entrada", contaCanais: [`${CANAL_NAO_OFICIAL}:5562994361377`] },
  ];

  it("escolhido o número oficial, o funil do QR Code sai da lista", () => {
    expect(funisDoNumero(funis, `${CANAL_OFICIAL}:109876543210`).map((f) => f.id)).toEqual([
      "padrao",
      "oficial",
    ]);
  });

  it("o funil SEM número fica — ele é o padrão da empresa", () => {
    /*
     * É onde está quase todo mundo numa conta que nunca separou números por funil. Tirá-lo
     * deixaria a lista correta e vazia, e "filtrei direitinho e sumiu tudo" parece defeito.
     */
    expect(funisDoNumero(funis, `${CANAL_NAO_OFICIAL}:5562994361377`).map((f) => f.id)).toEqual([
      "padrao",
      "qr",
    ]);
  });

  it("sem número escolhido, nada é filtrado", () => {
    expect(funisDoNumero(funis, null)).toHaveLength(3);
  });
});

describe("nomeDoNumeroDeEnvio", () => {
  it("acha o número pelo que está gravado na campanha", () => {
    const envio = numerosDeEnvio([OFICIAL, QR]);
    expect(nomeDoNumeroDeEnvio(envio, `${CANAL_OFICIAL}:109876543210`)?.nome).toBe("Comercial");
  });

  it("disparo sem número gravado, ou por número que saiu do ar, devolve nulo", () => {
    /*
     * São os dois casos reais: a campanha criada antes desta coluna existir, e o número que foi
     * desconectado depois. Inventar um nome pros dois esconderia exatamente o que mudou.
     */
    const envio = numerosDeEnvio([OFICIAL]);
    expect(nomeDoNumeroDeEnvio(envio, null)).toBeNull();
    expect(nomeDoNumeroDeEnvio(envio, `${CANAL_NAO_OFICIAL}:5562994361377`)).toBeNull();
  });
});
