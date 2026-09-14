import { createHash, createHmac } from "node:crypto";

/**
 * Cloudflare R2: onde os arquivos do CRM passam a morar.
 *
 * Por que sair do banco: até aqui todo anexo era gravado como base64 dentro do MySQL. Base64 infla
 * o arquivo em ~33%, e cada leitura de conversa carregava esse peso pelo mesmo caminho das
 * consultas de texto. Um banco gerenciado é o lugar mais caro por gigabyte que existe pra guardar
 * foto: e é o único que, quando enche, derruba o CRM inteiro junto.
 *
 * Por que R2 e não S3: a conta de armazenamento em nuvem que dói não é o disco, é o EGRESSO: o
 * que se paga cada vez que alguém ABRE o arquivo. Num CRM as mesmas fotos são abertas o dia
 * inteiro por vários vendedores. O R2 cobra armazenamento e não cobra egresso, e fala o mesmo
 * protocolo do S3: então se um dia valer a pena migrar pra AWS, o código abaixo continua servindo.
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
 * gravando no banco, como antes. Nada quebra no dia do deploy. A troca acontece quando as chaves
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
 * foi assinado faz o R2 recusar. É isso que impede alguém que intercepte a requisição de trocar o
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

  // Os cabeçalhos entram na assinatura em ordem alfabética e com o nome em minúsculas. O R2
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
    // descreve. A conversão é só de tipo. Nenhum byte é copiado nem reinterpretado.
    body:
      params.metodo === "GET" || params.metodo === "HEAD" || params.metodo === "DELETE"
        ? undefined
        : (corpo as unknown as BodyInit),
    // Arquivo é conteúdo imutável identificado por chave única. Cache de camada intermediária
    // aqui só serviria pra devolver versão velha.
    cache: "no-store",
  });
}

/**
 * Codificação de URL do jeito que a AWS exige na assinatura.
 *
 * `encodeURIComponent` deixa passar `!`, `'`, `(`, `)` e `*`, que o SigV4 manda escapar. Um único
 * caractere diferente muda o hash e o R2 recusa com `SignatureDoesNotMatch`, sem dizer qual.
 */
function codificarParaAssinatura(valor: string): string {
  return encodeURIComponent(valor).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Tira do nome do arquivo o que não pode ir num cabeçalho HTTP.
 *
 * O nome vem de um arquivo que alguém de fora mandou pelo WhatsApp. Aspas e quebras de linha ali
 * dentro sairiam do valor e virariam outra coisa no cabeçalho — é o mesmo tipo de brecha de quem
 * monta SQL com texto colado.
 */
function nomeSeguroParaCabecalho(nome: string): string {
  return nome.replace(/[\r\n"\\]/g, "").slice(0, 200) || "arquivo";
}

/**
 * Um endereço temporário que baixa o arquivo DIRETO do R2, sem passar pelo servidor.
 *
 * POR QUE ISTO EXISTE, e é a diferença entre duas contas bem distintas:
 *
 * Servir o arquivo pela função (ler do R2 pra dentro dela e devolver os bytes) faz cada byte
 * atravessar a Vercel duas vezes — entrando e saindo — e a Vercel cobra por isso (Fast Origin
 * Transfer). Na conta de setembro de 2026 foram 142 GB, quase quinze dólares, com UMA pessoa
 * usando o CRM: o custo cresce com o tamanho do arquivo e com quantas vezes ele é aberto, o que é
 * exatamente o padrão de uso de um CRM, onde a mesma foto é vista o dia inteiro.
 *
 * Com a URL assinada, a função devolve um redirecionamento de algumas centenas de bytes e o
 * navegador busca o arquivo na Cloudflare, que NÃO cobra saída de dados. O trabalho sai da conta
 * cara e vai pra conta que é de graça, sem mudar o que a pessoa vê.
 *
 * A SEGURANÇA NÃO AFROUXA, e o ponto é este: o bucket continua fechado. Ninguém baixa nada sem uma
 * assinatura, e a assinatura só é emitida depois que a rota confere a sessão e o dono do arquivo.
 * O endereço é longo, impossível de adivinhar e VENCE — por isso a validade é curta. É autorização
 * com prazo, e não arquivo aberto na internet.
 */
export function urlAssinadaDoR2(
  chave: string,
  opcoes: { validadeSegundos?: number; nomeParaBaixar?: string } = {},
): string {
  const validadeSegundos = opcoes.validadeSegundos ?? 600;
  const conf = exigirConfiguracao();
  const caminho = caminhoDoObjeto(conf.bucket, chave);
  const host = new URL(conf.endpoint).host;

  const agora = new Date();
  const dataHora = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dia = dataHora.slice(0, 8);
  const escopo = `${dia}/${REGIAO}/${SERVICO}/aws4_request`;

  /*
   * Aqui a assinatura vai na QUERY, e não no cabeçalho `Authorization`: é o que permite que um
   * `<img src>` ou um `<audio src>` funcionem sozinhos, sem o navegador precisar mandar cabeçalho
   * nenhum. Os parâmetros entram em ordem alfabética porque o R2 refaz a mesma string do lado
   * dele; a ordem não é cosmética.
   */
  const parametros: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${conf.accessKeyId}/${escopo}`],
    ["X-Amz-Date", dataHora],
    ["X-Amz-Expires", String(validadeSegundos)],
    ["X-Amz-SignedHeaders", "host"],
  ];

  /*
   * O que faz o documento BAIXAR em vez de abrir numa aba.
   *
   * O atributo `download` de um link só vale pra arquivo do mesmo domínio, e depois do
   * redirecionamento o arquivo passa a vir da Cloudflare. Sem isto, clicar em "baixar" num PDF
   * abriria o PDF e ainda perderia o nome original — um jeito discreto de piorar o produto pra
   * economizar na conta.
   *
   * O R2 aceita o cabeçalho pedido pela própria URL, e ele entra na assinatura como qualquer
   * outro parâmetro.
   */
  if (opcoes.nomeParaBaixar) {
    parametros.push([
      "response-content-disposition",
      `attachment; filename="${nomeSeguroParaCabecalho(opcoes.nomeParaBaixar)}"`,
    ]);
  }
  const query = parametros
    .map(([nome, valor]) => `${codificarParaAssinatura(nome)}=${codificarParaAssinatura(valor)}`)
    .sort()
    .join("&");

  // `UNSIGNED-PAYLOAD` porque numa URL assinada não há corpo pra cobrir: quem assina o conteúdo é
  // quem grava, não quem lê.
  const requisicaoCanonica = ["GET", caminho, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const aAssinar = ["AWS4-HMAC-SHA256", dataHora, escopo, sha256(requisicaoCanonica)].join("\n");

  const chaveData = hmac(`AWS4${conf.secretAccessKey}`, dia);
  const chaveRegiao = hmac(chaveData, REGIAO);
  const chaveServico = hmac(chaveRegiao, SERVICO);
  const chaveAssinatura = hmac(chaveServico, "aws4_request");
  const assinatura = createHmac("sha256", chaveAssinatura).update(aAssinar).digest("hex");

  return `${conf.endpoint}${caminho}?${query}&X-Amz-Signature=${assinatura}`;
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

/** Lê o arquivo. Devolve `null` quando a chave não existe mais. Apagado, ou de um workspace já removido. */
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
