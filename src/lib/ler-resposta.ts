/**
 * Lê o JSON de uma resposta sem nunca estourar, e devolve uma frase quando não há JSON.
 *
 * O defeito que isto corrige chegou na tela em produção: `await r.json()` num corpo VAZIO lança
 * `Failed to execute 'json' on 'Response': Unexpected end of JSON input`. Esse texto viajou do
 * navegador até o `catch` e foi mostrado como se fosse a explicação do problema — a pessoa lia um
 * erro de JavaScript em inglês sobre um problema que era de banco de dados.
 *
 * O servidor agora responde JSON em toda saída (ver `comRespostaEmJson`), mas isto continua
 * valendo: resposta vazia também vem de proxy, de tempo esgotado e de erro do próprio Next antes de
 * a rota rodar. Quem está na tela nunca deve ver o nome de um método do navegador.
 */
export type RespostaLida<T> = { ok: true; dados: T } | { ok: false; erro: string };

export async function lerJson<T>(resposta: Response, erroPadrao: string): Promise<RespostaLida<T>> {
  const texto = await resposta.text().catch(() => "");

  let corpo: unknown = null;
  if (texto.trim()) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = null;
    }
  }

  const doServidor = (corpo as { erro?: unknown } | null)?.erro;
  const mensagem = typeof doServidor === "string" && doServidor.trim() ? doServidor : erroPadrao;

  if (!resposta.ok) return { ok: false, erro: mensagem };
  // Respondeu 2xx com corpo que não é JSON: também não dá pra seguir, e o motivo não é da pessoa.
  if (corpo === null) return { ok: false, erro: erroPadrao };
  return { ok: true, dados: corpo as T };
}
