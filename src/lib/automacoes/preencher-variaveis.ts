/**
 * AS VARIÁVEIS DE UM TEXTO, trocadas pelos dados do contato: `{primeiro_nome}`, `{etapa_funil}`…
 *
 * Mora fora do motor porque não é execução: é leitura pura de um contato, e quem precisa dela não
 * é só quem manda mensagem. A condição também precisa — "a última mensagem contém o nome do
 * responsável" compara um campo com OUTRO campo do mesmo lead, e sem isso só dava pra comparar com
 * texto digitado. Duas listas de variáveis, uma pra mensagem e outra pra condição, divergiriam no
 * primeiro campo que alguém acrescentasse de um lado só.
 *
 * Puro: sem banco, sem rede, sem React.
 */

import { dataCurta, dataPorExtenso } from "@/lib/agenda/fuso";
import type { ReuniaoParaVariaveis } from "@/lib/agenda/reuniao-tipos";

/**
 * Troca `{{nome}}`, `{{origem}}`, `{{responsavel}}` e afins pelo valor do contato.
 *
 * O motor não fazia isso: quem escrevia "Oi {{nome}}" no bloco via a mensagem sair com as chaves
 * literais pro cliente. Variável sem valor vira texto vazio. Melhor uma frase com um buraco do que
 * uma frase com `{{primeiro_nome}}` no meio dela.
 */
/** Chave dupla e chave simples. Ver o porquê no comentário de `preencher`. */
const CHAVE_DUPLA = /\{\{\s*([\w.]+)\s*\}\}/g;
const CHAVE_SIMPLES = /\{\s*([\w.]+)\s*\}/g;

/**
 * Troca as variáveis do texto pelos dados do contato.
 *
 * Aceita as DUAS formas, `{primeiro_nome}` e `{{primeiro_nome}}`, e isso é a correção de um bug
 * que chegava no cliente: o botão "Inserir variável" da tela de automações escreve chave SIMPLES
 * (ver `VARIAVEIS_MENSAGEM`), e esta função só trocava chave DUPLA. Quem usava o botão, que é o
 * caminho certo, recebia o token cru no WhatsApp: "Olá {primeiro_nome} , tudo bem?".
 *
 * A dupla continua valendo porque é o formato dos modelos oficiais da Meta, usado no módulo de
 * campanhas, e porque fluxos já salvos podem tê-la. Trocar um formato pelo outro quebraria um dos
 * dois lados; aceitar ambos não quebra nenhum.
 *
 * Variável que não resolve vira texto vazio, e não fica como estava: mandar `{empresa}` cru pra um
 * cliente é pior do que mandar a frase sem aquele pedaço. Quem escreve a mensagem vê as variáveis
 * reconhecidas na própria tela antes de publicar.
 */
export function preencher(texto: string, contato: Record<string, unknown>, agora: Date = new Date()): string {
  if (!texto.includes("{")) return texto;
  const trocar = (_todo: string, chave: string) => valorDoContato(contato, chave, agora) ?? "";
  return texto.replace(CHAVE_DUPLA, trocar).replace(CHAVE_SIMPLES, trocar);
}

/**
 * Nomes que a tela oferece e que NÃO são o nome do campo no contato.
 *
 * A lista de variáveis foi escrita pensando em quem lê ("atendente", "telefone"), e os campos do
 * contato têm outros nomes ("responsavel", "whatsapp"). Sem essa tradução, metade das variáveis
 * oferecidas no menu virava texto vazio: a pessoa escolhia na lista, publicava, e a mensagem saía
 * com um buraco no lugar.
 */
const APELIDOS: Record<string, string[]> = {
  nome_completo: ["nome"],
  telefone: ["whatsapp", "telefoneFixo"],
  atendente: ["responsavel"],
  valor_negocio: ["valor"],
  etapa_funil: ["etapa"],
};

export function valorDoContato(contato: Record<string, unknown>, chave: string, agora: Date): string | null {
  const direto = contato[chave];
  if (typeof direto === "string" || typeof direto === "number") return String(direto);

  if (chave === "primeiro_nome") {
    const nome = typeof contato.nome === "string" ? contato.nome : "";
    return nome.trim().split(/\s+/)[0] || null;
  }

  // Data e hora do ENVIO, não de quando o fluxo foi montado: uma automação publicada em janeiro e
  // disparada em março precisa dizer março.
  if (chave === "data") return agora.toLocaleDateString("pt-BR");
  if (chave === "horario") return agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  /*
   * A próxima reunião do contato, sempre com o prefixo `reuniao.`.
   *
   * O prefixo não é enfeite: `{data}` já quer dizer "a data de hoje" nos blocos de texto, há
   * fluxos publicados contando com isso, e trocar o significado mandaria a data errada pra cliente
   * de quem nunca pediu mudança nenhuma. `{reuniao.data}` é novo e não colide com nada.
   */
  if (chave.startsWith("reuniao.")) {
    const reuniao = contato.reuniao as ReuniaoParaVariaveis | null | undefined;
    if (!reuniao) return null;
    if (chave === "reuniao.data") return dataPorExtenso(reuniao.dataIso);
    if (chave === "reuniao.data_curta") return dataCurta(reuniao.dataIso);
    if (chave === "reuniao.hora") return reuniao.hora;
    if (chave === "reuniao.link") return reuniao.link;
    return null;
  }

  for (const campo of APELIDOS[chave] ?? []) {
    const valor = contato[campo];
    if (typeof valor === "string" && valor.trim()) return valor;
    if (typeof valor === "number") return String(valor);
  }

  const personalizados = contato.camposPersonalizados as Record<string, string> | undefined;
  const doCampo = personalizados?.[chave];
  return typeof doCampo === "string" ? doCampo : null;
}
