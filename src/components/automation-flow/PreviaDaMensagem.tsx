"use client";

import type { FlowNode } from "@/lib/automation-flow/types";
import { pedacosDoTexto } from "@/lib/automation-flow/variaveis-no-texto";
import { CAPACIDADES } from "@/lib/canais/capacidades";
import {
  formatoDaPergunta,
  rotuloCurto,
  textoNumerado,
  type OpcaoPergunta,
} from "@/lib/conversas/formato-pergunta";
import { useIdioma } from "@/lib/idioma-context";
import { VARIAVEIS_MENSAGEM } from "./forms/variaveis";

/**
 * COMO O CLIENTE VÊ A MENSAGEM.
 *
 * "Quando eu clico ali para ver o texto que ele vai enviar, eu queria que aparecesse na lateral
 * como que vai aparecer para o cliente. Se eu colocar um botão ali de ação, o que vai aparecer?"
 *
 * A pergunta não é de gosto: o editor escreve o texto num campo e o cliente recebe uma bolha, e no
 * meio há regras que ninguém decora. Três botões no Instagram não são botões — são respostas
 * rápidas, cortadas em 20 caracteres, que aparecem acima do teclado e somem depois de usadas.
 * Quatro opções no WhatsApp oficial não cabem em botão e saem como lista. Onze não cabem em nada e
 * saem como "1 - …", "2 - …" dentro do próprio texto.
 *
 * Tudo isso só aparecia DEPOIS, no celular de quem recebeu. Aqui aparece enquanto se escreve, e a
 * decisão do formato é lida de `formatoDaPergunta` — a MESMA função que o envio chama. Uma prévia
 * que calcula o formato por conta própria é uma prévia que mente no dia em que o teto da Meta
 * mudar.
 *
 * A VARIÁVEL NÃO É PREENCHIDA COM NOME DE MENTIRA. Ela aparece como etiqueta ("Primeiro nome"):
 * inventar "Maria" aqui ensinaria a ler a prévia como se fosse uma mensagem real, e o buraco de uma
 * variável que o contato não tem ficaria escondido justamente na tela feita pra mostrá-lo.
 */

/** O nome bonito da variável, ou a chave crua quando é campo personalizado do contato. */
function nomeDaVariavel(chave: string): string {
  const conhecida = VARIAVEIS_MENSAGEM.find((v) => v.token === `{${chave}}`);
  return conhecida?.label ?? chave;
}

function TextoComVariaveis({ texto }: { texto: string }) {
  const { t: traduzir } = useIdioma();
  return (
    <>
      {pedacosDoTexto(texto).map((p, i) =>
        p.tipo === "texto" ? (
          <span key={i}>{p.valor}</span>
        ) : (
          <span className="prev-variavel" key={i} title={traduzir("Isto é trocado pelo dado do contato no envio.")}>
            {traduzir(nomeDaVariavel(p.valor))}
          </span>
        ),
      )}
    </>
  );
}

/** As chaves de texto que cada formato de mensagem usa. A primeira que existir é a da bolha. */
const CHAVES_DE_TEXTO = ["texto", "legenda", "mensagem", "corpo"] as const;

const NOME_DA_MIDIA: Record<string, string> = {
  mensagem_imagem: "Imagem",
  mensagem_video: "Vídeo",
  mensagem_audio: "Áudio",
  mensagem_documento: "Documento",
};

export function PreviaDaMensagem({ node }: { node: FlowNode }) {
  const { t: traduzir } = useIdioma();
  const dados = (node.data ?? {}) as Record<string, unknown>;

  const canalDoBloco = typeof dados.canal === "string" ? dados.canal : "whatsapp";
  const ehInstagram = canalDoBloco === "instagram";
  /*
   * O WHATSAPP DO BLOCO SÃO DUAS CONEXÕES, e elas entregam coisas diferentes.
   *
   * Quem escolhe entre o oficial e o QR Code é a CONVERSA do contato, na hora do envio — o bloco
   * não sabe. Então a prévia mostra o oficial, que é o que tem botão, e diz embaixo o que muda no
   * QR Code em vez de prometer um botão que metade dos aparelhos não recebe.
   */
  const canalDaPrevia = ehInstagram ? "instagram" : "whatsapp_oficial";
  const capacidade = CAPACIDADES[canalDaPrevia];

  const chave = CHAVES_DE_TEXTO.find((c) => typeof dados[c] === "string");
  const texto = chave ? String(dados[chave]) : "";

  const opcoesCruas = Array.isArray(dados.opcoes) ? (dados.opcoes as { id?: string; rotulo?: string; url?: string }[]) : [];
  const opcoes: OpcaoPergunta[] = opcoesCruas
    .filter((o) => (o.rotulo ?? "").trim())
    .map((o, i) => ({ id: o.id ?? String(i), rotulo: String(o.rotulo), url: o.url }));

  const formato = formatoDaPergunta(canalDaPrevia, opcoes);
  const midia = NOME_DA_MIDIA[node.type];
  const nomeDoArquivo =
    typeof dados.arquivoNomeExibicao === "string" && dados.arquivoNomeExibicao
      ? dados.arquivoNomeExibicao
      : typeof dados.arquivoNome === "string"
        ? dados.arquivoNome
        : "";

  /* No menu numerado as opções entram NO TEXTO, e é assim que a bolha tem que mostrá-las: é uma
     mensagem só, e não um texto com botões embaixo. */
  const textoDaBolha = formato === "numerado" ? textoNumerado(texto, opcoes) : texto;
  const vazia = !textoDaBolha.trim() && !midia;

  return (
    <section className="prev-caixa" aria-label={traduzir("Como o cliente vê")}>
      <header className="prev-topo">
        <strong>{traduzir("Como o cliente vê")}</strong>
        <span className="prev-canal">{traduzir(capacidade.label)}</span>
      </header>

      <div className="prev-tela">
        {midia ? (
          <div className="prev-midia">
            <span className="prev-midia-tipo">{traduzir(midia)}</span>
            <span className="prev-midia-nome">
              {nomeDoArquivo || traduzir("Nenhum arquivo escolhido ainda")}
            </span>
          </div>
        ) : null}

        {vazia ? (
          <p className="prev-vazio">{traduzir("Escreva a mensagem pra ver como ela chega.")}</p>
        ) : textoDaBolha.trim() ? (
          /*
            O BOTÃO DE LINK MORA DENTRO DA BOLHA, e não embaixo dela.
            
            É assim que o Direct desenha: a bolha cinza com o texto e, dentro dela, o botão branco
            quase da largura toda. Desenhado como irmão da bolha, ele ficava com a largura errada e
            parecia uma resposta rápida, que é justamente a outra coisa.
          */
          <div className={`prev-bolha${formato === "botao_link_ig" ? " com-botoes" : ""}`}>
            <span className="prev-bolha-texto">
              <TextoComVariaveis texto={textoDaBolha} />
            </span>
            {formato === "botao_link_ig"
              ? opcoes.map((o) => (
                  <span className="prev-botao-colado" key={o.id}>
                    {rotuloCurto(o.rotulo)}
                  </span>
                ))
              : null}
          </div>
        ) : null}

        {/*
          OS BOTÕES, DO JEITO DAQUELE CANAL.
          
          No oficial eles ficam DENTRO da bolha, empilhados, com a borda separando do texto. No
          Direct são pílulas acima do teclado. Em lista é um botão só — "Ver opções" — que abre um
          menu. Desenhar os três iguais seria a mesma mentira de antes, só mais bonita.
        */}
        {formato === "botoes" ? (
          <div className="prev-botoes">
            {opcoes.map((o) => (
              <span className="prev-botao" key={o.id}>
                {rotuloCurto(o.rotulo)}
              </span>
            ))}
          </div>
        ) : null}

        {formato === "lista" ? (
          <div className="prev-botoes">
            <span className="prev-botao">{traduzir("Ver opções")}</span>
          </div>
        ) : null}

        {formato === "respostas_rapidas" ? (
          <div className="prev-rapidas">
            {opcoes.map((o) => (
              <span className="prev-rapida" key={o.id}>
                {rotuloCurto(o.rotulo)}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/*
        A NOTA DO FORMATO: por que ficou assim, numa frase.
        
        Sem ela a prévia mostra lista onde a pessoa pediu botão e não diz o motivo — e quem não
        souber vai apagar e escrever de novo achando que errou em algo.
      */}
      <p className="prev-nota">
        {formato === "botao_link_ig"
          ? traduzir(
              "São botões de link: ficam na mensagem, não somem depois do toque, e cabem até {n} por mensagem.",
              { n: String(3) },
            )
          : formato === "respostas_rapidas"
            ? traduzir(
                "No Direct são respostas rápidas: aparecem acima do teclado, cortadas em {n} caracteres, e somem depois de usadas.",
                { n: String(20) },
              )
            : formato === "botoes"
              ? traduzir(
                  "Na conexão oficial são botões de resposta. Na conexão por QR Code o WhatsApp não entrega botão: a pergunta sai como menu numerado.",
                )
              : formato === "lista"
                ? traduzir(
                    "São mais de {n} opções: no WhatsApp oficial elas não cabem em botão e chegam como lista, atrás do \"Ver opções\".",
                    { n: String(capacidade.botoes) },
                  )
                : opcoes.length
                  ? traduzir(
                      "As opções chegam numeradas dentro do próprio texto, e a pessoa responde com o número.",
                    )
                  : traduzir("O texto chega como está aqui, sem botão nenhum.")}
      </p>
    </section>
  );
}
