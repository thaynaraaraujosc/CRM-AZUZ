import type { NumeroDeWhatsApp } from "@/lib/integracoes/numeros-de-whatsapp";

/*
 * Os nomes dos provedores escritos aqui, e não importados de `conta-canal.ts`: aquele módulo puxa
 * o cache de conexões (e o banco) junto, e esta regra roda no NAVEGADOR — é ela que monta o passo
 * do canal. Importá-lo derruba o build com "Can't resolve 'fs'", porque o driver do MariaDB vai
 * junto pro pacote do cliente. Mesmo motivo de `janela-do-oficial.ts`, e com o mesmo teste
 * conferindo que as duas cópias continuam iguais.
 */
const CANAL_OFICIAL = "meta_whatsapp";
const CANAL_NAO_OFICIAL = "whatsapp_nao_oficial";

/**
 * POR ONDE UM DISPARO PODE SAIR — um item por NÚMERO, não por canal.
 *
 * "Aqui tem que aparecer todos os WhatsApps que estão conectados. E na frente tem que mostrar se
 * ele é uma API oficial ou API não oficial."
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * O DEFEITO QUE ISTO CORRIGE, e ele era pior do que feio.
 *
 * A rota de canais respondia com UM item por provedor, escolhido com `.find()` — o primeiro
 * registro daquele provedor, sem olhar status. Quem conecta um número, desconecta e conecta outro
 * fica com a linha velha na frente: o `.find()` pegava a desconectada, e a tela dizia "Escaneie o
 * QR Code em Configurações" sobre um WhatsApp que estava de pé, recebendo mensagem.
 *
 * E o cartão vinha DESABILITADO. Não era um aviso errado a ignorar: era a conexão ligada ficando
 * impossível de escolher. "O WhatsApp não está conectado, mas está conectado, eu estou usando."
 *
 * A lista de números (`numerosDeWhatsApp`) já resolve isso faz tempo, com `semNumerosFantasmas`
 * tirando justamente a linha morta cujo telefone reapareceu noutra posição. O conserto é parar de
 * responder esta pergunta duas vezes, de dois jeitos diferentes, e passar a derivá-la de lá.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * E POR QUE UM ITEM POR NÚMERO. Uma empresa com dez números tem dez caixas de saída, e qual delas
 * manda a campanha muda o que a pessoa vê chegar no aparelho: nome, foto e histórico são do
 * NÚMERO, não do canal. Oferecer "WhatsApp (QR Code)" como se fosse um lugar só é esconder a
 * escolha que mais importa — e deixar o CRM escolher sozinho pela ordem das posições.
 */

/** Como o canal se chama pra quem está montando o disparo. */
export const CANAL_OFICIAL_CAMPANHA = "whatsapp_oficial";
export const CANAL_NAO_OFICIAL_CAMPANHA = "whatsapp_nao_oficial";

export type NumeroDeEnvio = {
  /** `contaCanal` da conexão: é o que a campanha grava pra saber por onde sair. */
  contaCanal: string;
  /** "whatsapp_oficial" | "whatsapp_nao_oficial" — o canal, no vocabulário da campanha. */
  canal: typeof CANAL_OFICIAL_CAMPANHA | typeof CANAL_NAO_OFICIAL_CAMPANHA;
  /** O apelido que a empresa deu, ou o número. É o que a pessoa reconhece. */
  nome: string;
  /** "API oficial" ou "QR Code": a etiqueta que ela pediu na frente de cada número. */
  etiqueta: string;
  numeroLegivel: string;
};

/**
 * Os números que podem disparar agora.
 *
 * SÓ OS CONECTADOS, e só os que têm `contaCanal`. Conexão de QR Code ligada cujo número o CRM
 * ainda não descobriu tem chave vazia: ela aparece na tela de Configurações (é de lá que sai o
 * reconectar), mas não aqui — escolher por onde mandar exige saber qual número é, e um item que
 * não sabe disso só produz um disparo que falha depois.
 */
export function numerosDeEnvio(numeros: NumeroDeWhatsApp[]): NumeroDeEnvio[] {
  return numeros
    .filter((n) => n.status === "conectado" && n.chave)
    .map((n) => ({
      contaCanal: n.chave,
      canal: n.provedor === CANAL_OFICIAL ? CANAL_OFICIAL_CAMPANHA : CANAL_NAO_OFICIAL_CAMPANHA,
      nome: n.nome,
      etiqueta: n.provedor === CANAL_OFICIAL ? "API oficial" : "QR Code",
      numeroLegivel: n.numeroLegivel,
    }));
}

/** Este canal tem pelo menos um número de pé? É o que decide se o cartão fica clicável. */
export function canalTemNumero(numeros: NumeroDeEnvio[], canal: string): boolean {
  return numeros.some((n) => n.canal === canal);
}

/**
 * O MOTIVO DE UM CANAL NÃO ESTAR DISPONÍVEL, escrito a partir do que existe de verdade.
 *
 * Antes era uma frase fixa ("Escaneie o QR Code em Configurações") dita sempre que o `.find()`
 * falhava, inclusive quando a conexão estava ligada. Agora a frase diferencia os dois casos que a
 * pessoa vive: nunca conectou, ou conectou e caiu — que pedem coisas diferentes dela.
 */
export function porQueOCanalNaoServe(
  numeros: NumeroDeWhatsApp[],
  provedor: typeof CANAL_OFICIAL | typeof CANAL_NAO_OFICIAL,
): string {
  const doCanal = numeros.filter((n) => n.provedor === provedor);
  if (doCanal.length === 0) {
    return provedor === CANAL_OFICIAL
      ? "Conecte a API oficial em Configurações → Outras integrações."
      : "Escaneie o QR Code em Configurações → Outras integrações.";
  }
  const semNumero = doCanal.some((n) => n.status === "conectado" && !n.chave);
  if (semNumero) return "A conexão está de pé, mas o CRM ainda não descobriu o número dela.";
  return provedor === CANAL_OFICIAL
    ? "A conexão com a Meta caiu. Reconecte em Configurações → Outras integrações."
    : "O número caiu. Leia o QR Code de novo em Configurações → Outras integrações.";
}

export type FunilComNumeros = { id: string; nome: string; contaCanais?: string[] };

/**
 * OS FUNIS QUE FAZEM SENTIDO PARA O NÚMERO ESCOLHIDO.
 *
 * "Se eu escolhi meta, tem que aparecer só os funis da meta. Se eu escolhi QR Code, tem que
 * aparecer só o QR Code. Essas coisas são detalhes, pra não dar erro lá na hora de finalizar."
 *
 * Não é detalhe. Escolher o funil do QR Code num disparo pela API oficial monta um público inteiro
 * que aquele canal não alcança — e a conta só fecha no fim, com a lista montada e a mensagem
 * escrita.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * O FUNIL SEM NÚMERO CONTINUA NA LISTA, e isso é de propósito.
 *
 * Funil sem número é o funil PADRÃO da empresa: ele recebe o que chega por qualquer lugar, e é
 * onde está quase todo mundo numa conta que nunca separou números por funil. Tirá-lo daqui
 * deixaria a lista tecnicamente correta e praticamente vazia — "filtrei direitinho e sumiu tudo"
 * é o jeito mais rápido de um filtro bom parecer um defeito.
 */
export function funisDoNumero<T extends FunilComNumeros>(funis: T[], contaCanal: string | null | undefined): T[] {
  if (!contaCanal) return funis;
  return funis.filter((f) => {
    const numeros = f.contaCanais ?? [];
    return numeros.length === 0 || numeros.includes(contaCanal);
  });
}

export const CANAIS_PARA_TESTE = { CANAL_OFICIAL, CANAL_NAO_OFICIAL };

/**
 * O nome do número por onde um disparo saiu. `null` quando não dá pra saber.
 *
 * O que está gravado na campanha é a chave (`meta_whatsapp:109876543210`). Mostrar isso na tela
 * seria mostrar um identificador de banco pra quem quer ler "Comercial". E `null` é resposta
 * honesta: disparo antigo (de antes da coluna) e número desconectado desde então caem aqui, e
 * inventar um nome pros dois esconderia justamente o que mudou.
 */
export function nomeDoNumeroDeEnvio(
  numeros: NumeroDeEnvio[],
  contaCanal: string | null | undefined,
): NumeroDeEnvio | null {
  if (!contaCanal) return null;
  return numeros.find((n) => n.contaCanal === contaCanal) ?? null;
}
