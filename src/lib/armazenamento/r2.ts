import { createHash, createHmac } from "node:crypto";

/**
 * Cloudflare R2 — onde os arquivos do CRM passam a morar.
 *
 * Por que sair do banco: até aqui todo anexo era gravado como base64 dentro do MySQL. Base64 infla
 * o arquivo em ~33%, e cada leitura de conversa carregava esse peso pelo mesmo caminho das
 * consultas de texto. Um banco gerenciado é o lugar mais caro por gigabyte que existe pra guardar
 * foto — e é o único que, quando enche, derruba o CRM inteiro junto.
 *
 * Por que R2 e não S3: a conta de armazenamento em nuvem que dói não é o disco, é o EGRESSO — o
 * que se paga cada vez que alguém ABRE o arquivo. Num CRM as mesmas fotos são abertas o dia
 * inteiro por vários vendedores. O R2 cobra armazenamento e não cobra egresso, e fala o mesmo
 * protocolo do S3 — então se um dia valer a pena migrar pra AWS, o código abaixo continua servindo.
 *
 * Por que não usamos o SDK da AWS: pra ler, gravar e apagar um objeto por vez, o que se precisa é
 * assinar a requisição (SigV4). O SDK resolveria isso trazendo dezenas de megabytes de dependência
 * pra dentro de cada build do Railway. A assinatura está implementada aqui embaixo, num arquivo só.
 */

const SERVICO = "s3";
// O R2 não tem regiões como a AWS: a assinatura sempre usa "auto".
const REGIAO = "auto";

type Configuracao = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function configuracao(): Configuracao | null {
  const endpoint = (process.env.R2_ENDPOINT ?? "").replace(/\/+$/, "");
  const bucket = process.env.R2_BUCKET ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

/**
 * Se as quatro variáveis estão no ambiente.
 *
 * Existe pra que o CRM continue funcionando sem elas: quem ainda não configurou o R2 segue
 * gravando no banco, como antes. Nada quebra no dia do deploy — a troca acontece quando as chaves
 * chegam.
 */
export function r2Configurado(): boolean {
  return configuracao() !== null;
}

function exigirConfiguracao(): Configuracao {
  const conf = configuracao();
  if (!conf) throw new Error("R2 não configurado (R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).");
  return conf;
}

function sha256(dado: Buffer | string): string {
  return createHash("sha256").update(dado).digest("hex");
}

function hmac(chave: Buffer | string, dado: string): Buffer {
  return createHmac("sha256", chave).update(dado).digest();
}

/**
 * Monta o cabeçalho `Authorization` no formato AWS Signature V4.
 *
 * A assinatura cobre método, caminho, cabeçalhos e o hash do corpo. Qualquer byte diferente do que
 * foi assinado faz o R2 recusar — é isso que impede alguém que intercepte a requisição de trocar o
 * arquivo no meio do caminho.
 */
function assinar(params: {
  conf: Configuracao;
  metodo: string;
  caminho: string;
  hashDoCorpo: string;
  cabecalhos: Record<string, string>;
}): Record<string, string> {
  const { conf, metodo, caminho, hashDoCorpo } = params;

  const agora = new Date();
  const dataHora = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dia = dataHora.slice(0, 8);
  const host = new URL(conf.endpoint).host;

  const cabecalhos: Record<string, string> = {
    ...params.cabecalhos,
    host,
    "x-amz-content-sha256": hashDoCorpo,
    "x-amz-date": dataHora,
  };

  // Os cabeçalhos entram na assinatura em ordem alfabética e com o nome em minúsculas — o R2
  // recalcula exatamente a mesma string do lado dele, então a ordem não é cosmética.
  const nomes = Object.keys(cabecalhos)
    .map((nome) => nome.toLowerCase())
    .sort();
  const cabecalhosCanonicos = nomes
    .map((nome) => {
      const valor = Object.entries(cabecalhos).find(([n]) => n.toLowerCase() === nome)?.[1] ?? "";
      return `${nome}:${valor.trim()}\n`;
    })
    .join("");
  const nomesAssinados = nomes.join(";");

  const requisicaoCanonica = [
    metodo,
    caminho,
    "",
    cabecalhosCanonicos,
    nomesAssinados,
    hashDoCorpo,
  ].join("\n");

  const escopo = `${dia}/${REGIAO}/${SERVICO}/aws4_request`;
  const aAssinar = ["AWS4-HMAC-SHA256", dataHora, escopo, sha256(requisicaoCanonica)].join("\n");

  const chaveData = hmac(`AWS4${conf.secretAccessKey}`, dia);
  const chaveRegiao = hmac(chaveData, REGIAO);
  const chaveServico = hmac(chaveRegiao, SERVICO);
  const chaveAssinatura = hmac(chaveServico, "aws4_request");
  const assinatura = createHmac("sha256", chaveAssinatura).update(aAssinar).digest("hex");

  return {
    ...cabecalhos,
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${conf.accessKeyId}/${escopo}, ` +
      `SignedHeaders=${nomesAssinados}, Signature=${assinatura}`,
  };
}

/** Codifica cada trecho do caminho sem escapar as barras que separam as pastas. */
function caminhoDoObjeto(bucket: string, chave: string): string {
  const partes = chave.split("/").map((parte) => encodeURIComponent(parte));
  return `/${encodeURIComponent(bucket)}/${partes.join("/")}`;
}

async function chamar(params: {
  metodo: string;
  chave: string;
  corpo?: Buffer;
  cabecalhos?: Record<string, string>;
}): Promise<Response> {
  const conf = exigirConfiguracao();
  const caminho = caminhoDoObjeto(conf.bucket, params.chave);
  const corpo = params.corpo ?? Buffer.alloc(0);

  const cabecalhos = assinar({
    conf,
    metodo: params.metodo,
    caminho,
    hashDoCorpo: sha256(corpo),
    cabecalhos: params.cabecalhos ?? {},
  });

  return fetch(`${conf.endpoint}${caminho}`, {
    method: params.metodo,
    headers: cabecalhos,
    // O fetch do Node aceita `Buffer` como corpo; o tipo `BodyInit` das libs do DOM é que não o
    // descreve. A conversão é só de tipo — nenhum byte é copiado nem reinterpretado.
    body:
      params.metodo === "GET" || params.metodo === "HEAD" || params.metodo === "DELETE"
        ? undefined
        : (corpo as unknown as BodyInit),
    // Arquivo é conteúdo imutável identificado por chave única — cache de camada intermediária
    // aqui só serviria pra devolver versão velha.
    cache: "no-store",
  });
}

/** Grava o arquivo e devolve a chave usada. A chave é o que fica guardado no banco no lugar do base64. */
export async function guardarNoR2(params: {
  chave: string;
  conteudo: Buffer;
  mimeType: string;
}): Promise<string> {
  const resposta = await chamar({
    metodo: "PUT",
    chave: params.chave,
    corpo: params.conteudo,
    cabecalhos: { "content-type": params.mimeType || "application/octet-stream" },
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`R2 recusou a gravação (${resposta.status}): ${detalhe.slice(0, 300)}`);
  }
  return params.chave;
}

/** Lê o arquivo. Devolve `null` quando a chave não existe mais — apagado, ou de um workspace já removido. */
export async function lerDoR2(chave: string): Promise<{ conteudo: Buffer; mimeType: string } | null> {
  const resposta = await chamar({ metodo: "GET", chave });
  if (resposta.status === 404) return null;
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`R2 recusou a leitura (${resposta.status}): ${detalhe.slice(0, 300)}`);
  }
  return {
    conteudo: Buffer.from(await resposta.arrayBuffer()),
    mimeType: resposta.headers.get("content-type") ?? "application/octet-stream",
  };
}

/** Apaga o arquivo. Um 404 aqui é sucesso: o objetivo era não existir mais. */
export async function apagarDoR2(chave: string): Promise<void> {
  const resposta = await chamar({ metodo: "DELETE", chave });
  if (!resposta.ok && resposta.status !== 404) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`R2 recusou a exclusão (${resposta.status}): ${detalhe.slice(0, 300)}`);
  }
}

/**
 * Chave do arquivo dentro do bucket.
 *
 * Começa sempre pelo workspace: é isso que permite somar o espaço usado por cliente sem varrer o
 * bucket inteiro, e apagar tudo de um cliente que sai sem tocar no arquivo de ninguém.
 */
export function chaveDeArquivo(params: { workspaceId: string; id: string; extensao?: string }): string {
  const agora = new Date();
  const ano = agora.getUTCFullYear();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  const extensao = params.extensao?.replace(/^\.*/, "") ?? "";
  return `${params.workspaceId}/${ano}/${mes}/${params.id}${extensao ? `.${extensao}` : ""}`;
}
