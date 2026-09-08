import { createHash } from "node:crypto";

/**
 * "Mudou alguma coisa desde a última vez?" respondido com uma consulta barata.
 *
 * POR QUE ISTO EXISTE: a conta de $123 do Railway.
 *
 * As telas de Conversas perguntam ao servidor a cada 5 segundos. Cada pergunta puxava do banco as
 * 3.000 mensagens mais recentes do workspace COM o texto e os anexos: ~4,2 MB por chamada. Em um
 * mês isso somou ~1,9 TB saindo do banco, $101 só de tráfego, mais $22 de memória porque o banco
 * inflou pra aguentar a martelada. O processamento em si custou 15 centavos. Não era carga real,
 * era dado indo e voltando à toa.
 *
 * A correção é a pergunta antes da pergunta: um `COUNT` e dois `MAX` sobre índice, que respondem em
 * bytes. Se a resposta for igual à da última vez, a tela recebe `304 Not Modified` e a consulta
 * pesada nunca acontece: nem o tráfego, nem a memória. Num CRM de verdade, a esmagadora maioria
 * das batidas de 5 segundos cai nesse caminho: quase nunca chegou mensagem nova nos últimos 5s.
 *
 * A assinatura combina TRÊS coisas de propósito:
 * - a contagem, que pega linha criada e linha apagada;
 * - o maior `criadoEm`, que pega mensagem nova;
 * - o maior `atualizadoEm`, que pega mudança de status (entregue/lido). Reescrita que não cria
 *   linha nova e que os outros dois não enxergariam.
 *
 * Mais o recorte da consulta (workspace e conexões visíveis): conectar ou desconectar um canal muda
 * o que a tela deve ver sem mudar nada nas mensagens, e sem isso a tela ficaria mostrando a lista
 * antiga achando que nada mudou.
 */
export function montarEtag(partes: (string | number | Date | null | undefined)[]): string {
  const texto = partes
    .map((p) => (p instanceof Date ? p.getTime() : (p ?? "")))
    .join("|");
  // Hash em vez dos valores crus: o ETag viaja em cabeçalho HTTP, e o recorte inclui identificador
  // de workspace e de conexão. Não é segredo grave, mas cabeçalho vaza em log de proxy e de CDN com
  // muito mais facilidade do que corpo de resposta. Não custa nada não expor.
  return `"${createHash("sha1").update(texto).digest("base64url")}"`;
}

/**
 * Resposta pronta de "nada mudou". Corpo vazio de propósito: `304` não pode ter corpo, e é
 * justamente isso que economiza.
 *
 * `Cache-Control: private, no-cache` é a combinação certa aqui e vale explicar, porque `no-cache`
 * engana pelo nome: ele NÃO proíbe guardar, ele obriga a REVALIDAR antes de usar. Que é
 * exatamente o que se quer. `private` impede que qualquer cache compartilhado no caminho guarde
 * resposta com dado de um workspace e sirva pra outro.
 */
export function naoModificado(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: { etag, "cache-control": "private, no-cache" },
  });
}

/** Cabeçalhos da resposta com conteúdo. Mesma política de cache, mais o ETag desta versão. */
export function cabecalhosComEtag(etag: string): Record<string, string> {
  return { etag, "cache-control": "private, no-cache" };
}

/**
 * `true` quando o cliente já tem esta versão.
 *
 * A comparação NÃO pode ser de string crua, e essa foi a razão de a correção não ter surtido o
 * efeito esperado em produção. Duas coisas acontecem no caminho entre o servidor e o navegador:
 *
 * 1. Quando a resposta é comprimida (gzip/brotli, que é o padrão), a camada de borda transforma o
 *    ETag forte `"abc"` no ETag FRACO `W/"abc"`. Porque o corpo entregue não é byte a byte o que
 *    saiu daqui. O navegador devolve `W/"abc"`, a comparação crua falhava, e TODA batida de 5
 *    segundos voltava a ser um `200` com a consulta pesada inteira. O silêncio é o pior desse bug:
 *    tudo continua funcionando, só que caro.
 *
 * 2. O `If-None-Match` pode trazer VÁRIOS valores separados por vírgula (o padrão HTTP permite).
 *
 * Então: separa a lista, tira o prefixo `W/` dos dois lados e compara. `*` significa "qualquer
 * versão serve", conforme o padrão.
 */
export function clienteJaTem(request: Request, etag: string): boolean {
  const cabecalho = request.headers.get("if-none-match");
  if (!cabecalho) return false;
  const semPeso = (v: string) => v.trim().replace(/^W\//, "");
  const alvo = semPeso(etag);
  return cabecalho.split(",").some((v) => {
    const limpo = semPeso(v);
    return limpo === "*" || limpo === alvo;
  });
}

