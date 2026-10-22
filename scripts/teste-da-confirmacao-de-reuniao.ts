/**
 * Prova a confirmação de reunião do Flow contra um banco DE VERDADE, de ponta a ponta.
 *
 * São os nove cenários que a Thaynara pediu, na ordem em que ela pediu:
 *
 *   (i)    lead com reunião + consentimento + só QR conectado → conversa em `whatsapp_nao_oficial:`
 *          e UM envio;
 *   (ii)   sem consentimento, e consentimento ausente → nenhum envio, e o motivo registrado;
 *   (iii)  o mesmo lead 3 vezes e 3 chamadas simultâneas → uma linha na fila, um envio;
 *   (iv)   `link` nulo → mensagem sem a linha do link;
 *   (v)    número sem WhatsApp → não envia, e diz por quê;
 *   (vi)   fora da janela → fica na fila, e sai quando a janela abre;
 *   (vii)  teto diário e disjuntor;
 *   (viii) com o oficial conectado, o caminho de hoje continua igual;
 *   (ix)   23h30 em Brasília é o dia de Brasília, não o de Londres.
 *
 * POR QUE ELE EXISTE, mesmo havendo teste automatizado: o teste em memória usa um banco de mentira,
 * e as duas garantias centrais daqui são do BANCO, não do código — a chave única que faz "uma vez
 * por número e horário" e a ordem em que um pool de verdade intercala leitura e gravação entre
 * conexões diferentes. Foi um teste como este, em 14/10/2026, que achou o card duplicado que
 * nenhum teste de unidade tinha pegado.
 *
 * NADA SAI PRA NINGUÉM. O envio e a consulta "esse número tem WhatsApp?" entram por parâmetro
 * (`DependenciasDoEnvio`), e aqui são dublês que só anotam o que teria saído. Um script de teste
 * que manda WhatsApp de verdade é um script que ninguém roda.
 *
 * ---
 *
 * NUNCA RODE ISTO CONTRA PRODUÇÃO. Ele cria e apaga workspace, contatos, conversas e cards.
 *
 * Por isso ele NÃO lê `DATABASE_URL`: se lesse, um `.env` de produção na raiz faria o script
 * apontar pro banco dos clientes sem ninguém notar. Ele exige `DATABASE_URL_CONFIRMACAO`, que só
 * existe se alguém a tiver definido de propósito, e ainda pede confirmação explícita.
 *
 * Rode com:
 *   DATABASE_URL_CONFIRMACAO="mysql://..." npx tsx scripts/teste-da-confirmacao-de-reuniao.ts --confirmo
 *
 * Tudo que ele cria fica sob o prefixo `zz-confirmacao-<momento>` e é apagado no fim. Nenhum
 * `deleteMany` daqui alcança linha que ele não tenha criado: todos são filtrados pelo workspace de
 * teste, que nasce e morre aqui dentro.
 */
import { setDefaultResultOrder } from "node:dns";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";

import { PrismaClient } from "../src/generated/prisma/client";
// `import type` é apagado na compilação: não carrega o módulo, então não toca no Prisma antes de a
// `DATABASE_URL` abaixo ser apontada pro banco de teste.
import type { DependenciasDoEnvio } from "../src/lib/integracoes/azuz-flow-confirmacao-envio";

setDefaultResultOrder("ipv4first");

const URL_DO_TESTE = process.env.DATABASE_URL_CONFIRMACAO;
const CONFIRMADO = process.argv.includes("--confirmo");

if (!URL_DO_TESTE) {
  console.error(
    [
      "Falta DATABASE_URL_CONFIRMACAO.",
      "",
      "Este script grava e apaga dados e NÃO usa a DATABASE_URL do .env de propósito, pra não haver",
      "como apontá-lo pro banco de produção sem perceber. Aponte-a pra um banco de teste.",
    ].join("\n"),
  );
  process.exit(1);
}

if (!CONFIRMADO) {
  const host = (() => {
    try {
      return new URL(URL_DO_TESTE.replace(/^mysql:\/\//, "http://")).host;
    } catch {
      return "(não deu pra ler o endereço)";
    }
  })();
  console.error(
    [
      `Este script vai GRAVAR E APAGAR em: ${host}`,
      "",
      "Se esse for o banco de produção, pare agora.",
      "Pra seguir, repita o comando com --confirmo.",
    ].join("\n"),
  );
  process.exit(1);
}

/*
 * O MESMO banco pros dois lados.
 *
 * Os módulos sob teste falam com o banco pelo cliente compartilhado (`@/lib/prisma`), que lê
 * `DATABASE_URL`. Apontá-la pro banco de teste ANTES de qualquer `import` dinâmico é o que impede o
 * script de montar os dados num banco e exercer o código em outro — que passaria achando que a
 * tabela não existe.
 */
process.env.DATABASE_URL = URL_DO_TESTE;
// A chave serve pra criptografar um token de mentira no cenário (viii). É descartável por
// definição: nasce aqui e morre com o processo.
process.env.INTEGRACAO_ENCRYPTION_KEY ??= "teste-da-confirmacao-de-reuniao-0000000000";

const PREFIXO = `zz-confirmacao-${Date.now()}`;
const NUMERO_DO_QR = "5562988887777";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(URL_DO_TESTE.replace(/^mysql:\/\//, "mariadb://")),
});

const falhas: string[] = [];
let cenarioAtual = "";

function conferir(condicao: boolean, oQueSeEsperava: string) {
  if (!condicao) falhas.push(`${cenarioAtual}: ${oQueSeEsperava}`);
}

/** O que o dublê de envio registrou. Nada vai pra rede. */
type Tentativa = { conversaNome: string; texto: string };

async function montarWorkspace(): Promise<string> {
  const id = PREFIXO;
  await prisma.workspace.create({ data: { id, nome: "Confirmação (teste)", slug: id } });
  await prisma.funil.create({ data: { id: `${id}-funil`, workspaceId: id, nome: "Comercial" } });
  await prisma.funilEtapa.create({
    data: { id: `${id}-etapa`, funilId: `${id}-funil`, workspaceId: id, titulo: "Novo", ordem: 0 },
  });
  await prisma.integracao.create({
    data: {
      id: `${id}-qr`,
      workspaceId: id,
      provedor: "whatsapp_nao_oficial",
      status: "conectado",
      metadados: { numero: NUMERO_DO_QR },
    },
  });
  return id;
}

/** Apaga só o que este script criou, de dentro pra fora. */
async function limpar(workspaceId: string) {
  await prisma.confirmacaoDeReuniao.deleteMany({ where: { workspaceId } }).catch(() => {});
  await prisma.negocioCard.deleteMany({ where: { workspaceId } });
  await prisma.funilEtapa.deleteMany({ where: { workspaceId } });
  await prisma.funil.deleteMany({ where: { workspaceId } });
  await prisma.leadRecebido.deleteMany({ where: { workspaceId } });
  await prisma.mensagemExtra.deleteMany({ where: { workspaceId } });
  await prisma.conversa.deleteMany({ where: { workspaceId } });
  await prisma.compromisso.deleteMany({ where: { workspaceId } });
  await prisma.contato.deleteMany({ where: { workspaceId } });
  await prisma.preferencia.deleteMany({ where: { workspaceId } });
  await prisma.integracao.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
}

/** Entre cenários: zera o que cada um grava, deixando o workspace e a conexão de pé. */
async function zerar(workspaceId: string) {
  await prisma.confirmacaoDeReuniao.deleteMany({ where: { workspaceId } });
  await prisma.negocioCard.deleteMany({ where: { workspaceId } });
  await prisma.leadRecebido.deleteMany({ where: { workspaceId } });
  await prisma.mensagemExtra.deleteMany({ where: { workspaceId } });
  await prisma.conversa.deleteMany({ where: { workspaceId } });
  await prisma.compromisso.deleteMany({ where: { workspaceId } });
  await prisma.contato.deleteMany({ where: { workspaceId } });
}

async function main() {
  const { receberLeadDoFlow, dependenciasReais } = await import("../src/lib/integracoes/azuz-flow-lead");
  const { validarPayloadDoFlow } = await import("../src/lib/integracoes/azuz-flow-payload");
  const { salvarConfigDoFlow } = await import("../src/lib/integracoes/azuz-flow-config");
  const { processarConfirmacoesDeReuniao } = await import("../src/lib/integracoes/azuz-flow-confirmacao-envio");
  const { religarDisjuntor, lerDisjuntor } = await import("../src/lib/integracoes/azuz-flow-disjuntor");
  const { situacaoDasConfirmacoes } = await import("../src/lib/integracoes/azuz-flow-confirmacoes-consulta");
  const { encriptar } = await import("../src/lib/integracoes/crypto");

  const workspaceId = await montarWorkspace();

  /** Daqui a três dias, 14:30 em Brasília (17:30 UTC). */
  /** Um texto simples pro cenário que não está provando o texto. */
  const TEXTO_DE_TESTE = "Oi, {{primeiroNome}}! Reunião em {{dataCurta}} às {{hora}}.";

  const REUNIAO_FUTURA = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  REUNIAO_FUTURA.setUTCHours(17, 30, 0, 0);

  function montarLead(
    respostaId: string,
    opcoes: {
      whatsapp?: string;
      aceitou?: boolean | undefined;
      reuniao?: { inicio: string; fim: string | null; link: string | null } | null;
      nome?: string;
    } = {},
  ) {
    const consentimento =
      opcoes.aceitou === undefined ? {} : { whatsapp: { aceitou: opcoes.aceitou, texto: null, em: null } };
    const r = validarPayloadDoFlow({
      origem: { formularioId: "f1", formularioNome: "Diagnóstico", respostaId },
      lead: {
        nome: opcoes.nome ?? "Ana",
        sobrenome: "Souza",
        whatsapp: opcoes.whatsapp ?? "5562996340438",
        email: null,
      },
      respostas: [],
      consentimento,
      reuniao:
        opcoes.reuniao === null
          ? undefined
          : (opcoes.reuniao ?? {
              inicio: REUNIAO_FUTURA.toISOString(),
              fim: null,
              link: "https://meet.google.com/abc-defg-hij",
            }),
    });
    return r;
  }

  async function entregar(respostaId: string, opcoes: Parameters<typeof montarLead>[1] = {}) {
    const validado = montarLead(respostaId, opcoes);
    if (!validado.ok) throw new Error(`payload inválido: ${validado.erro}`);
    return receberLeadDoFlow({ workspaceId, lead: validado.lead, deps: dependenciasReais(workspaceId) });
  }

  /** O dublê do envio. `temWhatsapp` e `falhar` são o que cada cenário quer provar. */
  function envio(opcoes: { temWhatsapp?: boolean | null; falhar?: boolean } = {}) {
    const tentativas: Tentativa[] = [];
    const deps: DependenciasDoEnvio = {
      conferirNumero: async () => opcoes.temWhatsapp ?? true,
      enviar: async ({ conversaNome, texto }) => {
        tentativas.push({ conversaNome, texto });
        return opcoes.falhar
          ? { enviado: false, motivo: "a conexão do WhatsApp está desconectada" }
          : { enviado: true };
      },
    };
    return { tentativas, deps };
  }

  function filaDo(workspaceId: string) {
    return prisma.confirmacaoDeReuniao.findMany({ where: { workspaceId }, orderBy: { criadoEm: "asc" } });
  }

  /** As bolhas de sistema da conversa: é onde quem atende lê o que aconteceu. */
  async function bolhasDe(nome: string) {
    const linhas = await prisma.mensagemExtra.findMany({
      where: { workspaceId, contato: nome, tipo: "system" },
      select: { texto: true },
    });
    return linhas.map((l) => l.texto ?? "").join(" | ");
  }

  try {
    // ---------------------------------------------------------------- (i)
    cenarioAtual = "(i) QR conectado, com consentimento";
    await salvarConfigDoFlow(workspaceId, {
      canal: "qrcode",
      confirmacao: { ativa: true, pausada: false, tetoDiario: 30, tetoPorNumero: 3, falhasParaPausar: 5 },
    });

    const r1 = await entregar("resp-1");
    const conversa = await prisma.conversa.findFirst({ where: { workspaceId }, select: { contaCanal: true, nome: true } });
    conferir(conversa?.contaCanal === `whatsapp_nao_oficial:${NUMERO_DO_QR}`, `a conversa tinha que ser do QR, veio "${conversa?.contaCanal}"`);
    conferir(r1.avisos.join(" ").includes("na fila para envio"), "o aviso da fila tinha que voltar pro Flow");

    let fila = await filaDo(workspaceId);
    conferir(fila.length === 1, `uma linha na fila, veio ${fila.length}`);
    conferir(fila[0]?.situacao === "na_fila", `situação "na_fila", veio "${fila[0]?.situacao}"`);

    // A fila respeita o `enviarApos` sorteado: o envio imediato precisa que ele já tenha vencido.
    await prisma.confirmacaoDeReuniao.updateMany({ where: { workspaceId }, data: { enviarApos: new Date(Date.now() - 1000) } });

    const e1 = envio();
    const rodada = await processarConfirmacoesDeReuniao(30, e1.deps);
    conferir(rodada.enviadas === 1, `um envio, veio ${rodada.enviadas}`);
    conferir(e1.tentativas.length === 1, `uma tentativa de envio, veio ${e1.tentativas.length}`);

    fila = await filaDo(workspaceId);
    conferir(fila[0]?.situacao === "enviada", `situação "enviada" depois da rodada, veio "${fila[0]?.situacao}"`);
    conferir((await bolhasDe(conversa?.nome ?? "")).includes("enviada"), "a bolha de 'enviada' tinha que estar na conversa");

    // ---------------------------------------------------------------- (ii)
    await zerar(workspaceId);
    cenarioAtual = "(ii) consentimento recusado";
    const r2 = await entregar("resp-sem-consentimento", { aceitou: false });
    conferir((await filaDo(workspaceId)).length === 0, "nada podia ir pra fila");
    conferir(r2.avisos.join(" ").includes("sem consentimento"), `o motivo tinha que voltar nos avisos, veio "${r2.avisos.join(" ")}"`);
    conferir((await bolhasDe("Ana Souza")).includes("sem consentimento"), "o motivo tinha que estar na conversa também");

    cenarioAtual = "(ii) consentimento ausente";
    /*
     * AUSENTE É RECUSADO NA PORTA, e isso é melhor do que entrar e não mandar.
     *
     * O contrato exige `consentimento.whatsapp.aceitou` como booleano de verdade. Um corpo sem o
     * campo volta 400 com a frase inteira, dizendo o que falta — em vez de entrar como "não se
     * sabe" e produzir silêncio que quem integra teria que adivinhar. O efeito pedido continua
     * valendo: nenhuma mensagem sai.
     */
    const semCampo = montarLead("resp-consentimento-ausente", { aceitou: undefined });
    conferir(!semCampo.ok, "corpo sem o campo de consentimento tinha que ser recusado");
    conferir(
      !semCampo.ok && semCampo.erro.includes("consentimento.whatsapp.aceitou"),
      `o erro tinha que nomear o campo, veio "${!semCampo.ok ? semCampo.erro : ""}"`,
    );

    // ---------------------------------------------------------------- (iii)
    await zerar(workspaceId);
    cenarioAtual = "(iii) a mesma entrega repetida e simultânea";
    await entregar("resp-3");
    await entregar("resp-3");
    await entregar("resp-3");
    // Entregas DIFERENTES da mesma pessoa pra mesma reunião, ao mesmo tempo: a idempotência da
    // entrega não ajuda aqui, quem segura é a chave única (workspace + telefone + início).
    await Promise.all([entregar("resp-3-a"), entregar("resp-3-b"), entregar("resp-3-c")]);
    fila = await filaDo(workspaceId);
    conferir(fila.length === 1, `uma linha na fila depois de 6 entregas, veio ${fila.length}`);

    await prisma.confirmacaoDeReuniao.updateMany({ where: { workspaceId }, data: { enviarApos: new Date(Date.now() - 1000) } });
    const e3 = envio();
    await processarConfirmacoesDeReuniao(30, e3.deps);
    conferir(e3.tentativas.length === 1, `um envio só, veio ${e3.tentativas.length}`);

    // ---------------------------------------------------------------- (iv)
    await zerar(workspaceId);
    cenarioAtual = "(iv) reunião sem link";
    await entregar("resp-4", { reuniao: { inicio: REUNIAO_FUTURA.toISOString(), fim: null, link: null } });
    fila = await filaDo(workspaceId);
    const texto = fila[0]?.texto ?? "";
    conferir(!texto.includes("{{"), `nenhuma variável podia sobrar: "${texto}"`);
    conferir(!/\n\s*\n\s*\n/.test(texto), "a linha do link tinha que sair inteira, sem deixar buraco");
    conferir(texto.includes("SAIR"), "a mensagem tinha que dizer como parar");
    conferir(texto.includes("Confirmação (teste)"), "a mensagem tinha que dizer de onde a pessoa veio");

    // ---------------------------------------------------------------- (v)
    await zerar(workspaceId);
    cenarioAtual = "(v) número sem WhatsApp";
    await entregar("resp-5");
    await prisma.confirmacaoDeReuniao.updateMany({ where: { workspaceId }, data: { enviarApos: new Date(Date.now() - 1000) } });
    const e5 = envio({ temWhatsapp: false });
    const r5 = await processarConfirmacoesDeReuniao(30, e5.deps);
    conferir(e5.tentativas.length === 0, "não podia tentar mandar");
    conferir(r5.recusadas === 1, `uma recusa, veio ${r5.recusadas}`);
    fila = await filaDo(workspaceId);
    conferir(fila[0]?.situacao === "nao_enviada", `situação "nao_enviada", veio "${fila[0]?.situacao}"`);
    conferir((fila[0]?.motivo ?? "").includes("não tem WhatsApp"), `o motivo tinha que dizer isso, veio "${fila[0]?.motivo}"`);

    // ---------------------------------------------------------------- (vi)
    await zerar(workspaceId);
    cenarioAtual = "(vi) fora da janela";
    // Uma janela que já fechou: o envio tem que esperar ela abrir, não sair agora.
    const agoraEmBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const horaFechada = String((agoraEmBrasilia.getUTCHours() + 2) % 24).padStart(2, "0");
    await salvarConfigDoFlow(workspaceId, {
      confirmacao: { janela: { inicio: `${horaFechada}:00`, fim: `${horaFechada}:30` } },
    });
    await entregar("resp-6");
    fila = await filaDo(workspaceId);
    conferir(fila.length === 1, `a linha tinha que ficar na fila, veio ${fila.length}`);
    conferir((fila[0]?.enviarApos.getTime() ?? 0) > Date.now(), "o envio tinha que ser marcado pra depois");

    const e6 = envio();
    conferir((await processarConfirmacoesDeReuniao(30, e6.deps)).enviadas === 0, "nada podia sair fora da janela");
    conferir(e6.tentativas.length === 0, "nem tentar");

    // A janela abriu (é o que o cron encontra no minuto certo).
    await prisma.confirmacaoDeReuniao.updateMany({ where: { workspaceId }, data: { enviarApos: new Date(Date.now() - 1000) } });
    const e6b = envio();
    conferir((await processarConfirmacoesDeReuniao(30, e6b.deps)).enviadas === 1, "na abertura, tinha que sair");
    await salvarConfigDoFlow(workspaceId, { confirmacao: { janela: { inicio: "00:00", fim: "23:59" } } });

    // ---------------------------------------------------------------- (vii) teto diário
    await zerar(workspaceId);
    cenarioAtual = "(vii-a) teto diário";
    await salvarConfigDoFlow(workspaceId, { confirmacao: { tetoDiario: 1 } });
    await entregar("resp-7a", { nome: "Bruno", whatsapp: "5562996340401" });
    await entregar("resp-7b", { nome: "Carla", whatsapp: "5562996340402" });
    await prisma.confirmacaoDeReuniao.updateMany({ where: { workspaceId }, data: { enviarApos: new Date(Date.now() - 1000) } });

    const e7 = envio();
    const r7 = await processarConfirmacoesDeReuniao(30, e7.deps);
    conferir(r7.enviadas === 1, `com teto 1, um envio, veio ${r7.enviadas}`);
    conferir(r7.adiadas === 1, `a outra tinha que ficar na fila, veio ${r7.adiadas} adiada(s)`);
    conferir(
      (await prisma.confirmacaoDeReuniao.count({ where: { workspaceId, situacao: "na_fila" } })) === 1,
      "a adiada continua na fila, não vira recusa",
    );

    // ---------------------------------------------------------------- (vii) disjuntor
    await zerar(workspaceId);
    await religarDisjuntor(workspaceId);
    cenarioAtual = "(vii-b) disjuntor";
    await salvarConfigDoFlow(workspaceId, { confirmacao: { tetoDiario: 30, falhasParaPausar: 2 } });
    await entregar("resp-7c", { nome: "Diego", whatsapp: "5562996340403" });
    await entregar("resp-7d", { nome: "Elisa", whatsapp: "5562996340404" });
    await prisma.confirmacaoDeReuniao.updateMany({ where: { workspaceId }, data: { enviarApos: new Date(Date.now() - 1000) } });

    const e7b = envio({ falhar: true });
    await processarConfirmacoesDeReuniao(30, e7b.deps);
    conferir(e7b.tentativas.length === 2, `as duas tinham que ser tentadas, veio ${e7b.tentativas.length}`);
    conferir((await lerDisjuntor(workspaceId)).pausadoEm !== null, "duas falhas seguidas tinham que pausar o canal");

    // Pausado: a batida seguinte não tenta mais nada — é o que impede a insistência de banir o
    // número. E nada foi descartado: as duas continuam na fila.
    await prisma.confirmacaoDeReuniao.updateMany({ where: { workspaceId }, data: { enviarApos: new Date(Date.now() - 1000) } });
    const e7c = envio({ falhar: true });
    await processarConfirmacoesDeReuniao(30, e7c.deps);
    conferir(e7c.tentativas.length === 0, `pausado, não podia tentar, veio ${e7c.tentativas.length}`);
    conferir(
      (await prisma.confirmacaoDeReuniao.count({ where: { workspaceId, situacao: "na_fila" } })) === 2,
      "as duas continuam na fila esperando alguém religar",
    );

    await religarDisjuntor(workspaceId);
    const e7d = envio();
    conferir((await processarConfirmacoesDeReuniao(30, e7d.deps)).enviadas === 2, "religado, as duas saem");

    // ---------------------------------------------------------------- (viii)
    await zerar(workspaceId);
    cenarioAtual = "(viii) com o oficial conectado, o caminho de hoje";
    await prisma.integracao.create({
      data: {
        id: `${workspaceId}-oficial`,
        workspaceId,
        provedor: "meta_whatsapp",
        status: "conectado",
        accessTokenCriptografado: encriptar("token-de-mentira"),
        metadados: { phoneNumberId: "111222333", wabaId: "444" },
      },
    });
    await salvarConfigDoFlow(workspaceId, { canal: "oficial" });

    const r8 = await entregar("resp-8");
    const conversa8 = await prisma.conversa.findFirst({ where: { workspaceId }, select: { contaCanal: true } });
    conferir(conversa8?.contaCanal === "meta_whatsapp:111222333", `a conversa tinha que ser do oficial, veio "${conversa8?.contaCanal}"`);
    conferir((await filaDo(workspaceId)).length === 0, "pelo oficial, texto livre não vai pra fila");
    conferir(
      r8.avisos.join(" ").includes("modelo aprovado pela Meta"),
      `o motivo tinha que ser dito, veio "${r8.avisos.join(" ")}"`,
    );
    await prisma.integracao.delete({ where: { id: `${workspaceId}-oficial` } });
    await salvarConfigDoFlow(workspaceId, { canal: "qrcode" });

    // ---------------------------------------------------------------- (ix)
    await zerar(workspaceId);
    cenarioAtual = "(ix) 23h30 em Brasília, na virada do dia";
    // 20/10 às 23h30 em Brasília é 21/10 às 02h30 em UTC. Formatar pelo instante cru mandaria o
    // dia 21 — a pessoa chegaria um dia depois da reunião.
    const viradaDoDia = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    viradaDoDia.setUTCHours(2, 30, 0, 0);
    const diaEmBrasilia = new Date(viradaDoDia.getTime() - 3 * 60 * 60 * 1000);
    const esperado = `${String(diaEmBrasilia.getUTCDate()).padStart(2, "0")}/${String(diaEmBrasilia.getUTCMonth() + 1).padStart(2, "0")}`;

    await salvarConfigDoFlow(workspaceId, {
      confirmacao: { texto: "Reunião em {{dataCurta}} às {{hora}}." },
    });
    await entregar("resp-9", {
      reuniao: { inicio: viradaDoDia.toISOString(), fim: null, link: null },
    });
    fila = await filaDo(workspaceId);
    conferir(
      (fila[0]?.texto ?? "").includes(`${esperado}`),
      `a data tinha que ser ${esperado} (Brasília), veio "${fila[0]?.texto}"`,
    );
    conferir((fila[0]?.texto ?? "").includes("23:30"), `a hora tinha que ser 23:30, veio "${fila[0]?.texto}"`);
    // ---------------------------------------------------------------- (x)
    await zerar(workspaceId);
    cenarioAtual = "(x) a pergunta do Flow sobre o que aconteceu";
    await salvarConfigDoFlow(workspaceId, { confirmacao: { texto: TEXTO_DE_TESTE } });

    await entregar("resp-x1");
    // A MESMA pessoa preenchendo de novo, mesma reunião: entrega nova, confirmação nenhuma —
    // a trava de telefone + início recusa, e isso é o certo.
    await entregar("resp-x2");
    conferir((await filaDo(workspaceId)).length === 1, "uma confirmação só pras duas entregas");

    const perguntado = await situacaoDasConfirmacoes(workspaceId, ["resp-x1", "resp-x2", "resp-que-nao-existe"]);
    conferir(perguntado["resp-x1"]?.situacao === "na_fila", `resp-x1 devia estar na fila, veio "${perguntado["resp-x1"]?.situacao}"`);
    conferir(
      perguntado["resp-x2"]?.situacao === "na_fila",
      "a SEGUNDA entrega precisa achar a confirmação que já existia — sem isso o Flow mostra 'na fila' pra sempre",
    );
    conferir(!("resp-que-nao-existe" in perguntado), "id desconhecido fica de fora, e isso não é erro");

    // Depois de sair, a pergunta devolve "enviada" e a hora: é o que destrava a tela do Flow.
    await prisma.confirmacaoDeReuniao.updateMany({ where: { workspaceId }, data: { enviarApos: new Date(Date.now() - 1000) } });
    const ex = envio();
    await processarConfirmacoesDeReuniao(30, ex.deps);

    const depois = await situacaoDasConfirmacoes(workspaceId, ["resp-x1", "resp-x2"]);
    conferir(depois["resp-x1"]?.situacao === "enviada", `depois do envio devia ser "enviada", veio "${depois["resp-x1"]?.situacao}"`);
    conferir(Boolean(depois["resp-x1"]?.enviadaEm), "a hora do envio precisa voltar");
    conferir(depois["resp-x2"]?.situacao === "enviada", "as duas entregas respondem a mesma coisa: é a mesma confirmação");
  } finally {
    await limpar(workspaceId).catch((erro) => console.error("não deu pra limpar tudo:", erro));
    await prisma.$disconnect().catch(() => {});
  }

  if (falhas.length) {
    console.error(`\n${falhas.length} conferência(s) falharam:`);
    for (const f of falhas) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  console.log("\nOs dez cenários passaram contra banco de verdade. Nenhuma mensagem saiu pra ninguém.");
}

main().catch(async (erro) => {
  console.error("O teste da confirmação parou:", erro);
  await limpar(PREFIXO).catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
