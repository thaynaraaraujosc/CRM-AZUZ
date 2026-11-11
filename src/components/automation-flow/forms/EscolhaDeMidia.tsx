"use client";

import { useMemo, useState } from "react";

import { IconCheck, IconSearch } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";

export type ItemDeMidia = {
  id: string;
  tipo: string;
  legenda?: string;
  miniatura: string | null;
  permalink: string | null;
  publicadoEm: string | null;
};

/** Onde a automação vale. `qualquer` é o padrão; `proxima` só existe pra publicação. */
export type Escopo = "especifico" | "qualquer" | "proxima";

export type DadosDeEscopo = {
  /** Escolhidos, quando o escopo é `especifico`. Vários, como na referência. */
  ids?: string[];
  escopo?: Escopo;
  /**
   * Os ids que existiam quando "Meu próximo post" foi escolhido.
   *
   * É o que permite responder "esta publicação é nova?" sem perguntar nada à Meta no momento do
   * comentário: o que não estava na lista daquele dia foi publicado depois. Guardar a DATA não
   * resolveria — o evento de comentário traz o id da publicação, não a data dela, e descobrir a
   * data exigiria uma chamada à Graph por comentário recebido.
   */
  conhecidos?: string[];
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "26 out" — como a referência escreve a data na miniatura. */
function dataCurta(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** Quantas miniaturas aparecem antes do "Mostrar mais". Três por linha, duas linhas. */
const POR_PAGINA = 6;

/**
 * EM QUAIS PUBLICAÇÕES (OU STORIES) A AUTOMAÇÃO VALE.
 *
 * O desenho é o da referência que a Thaynara mandou, linha por linha: a opção escolhida é um
 * cartão com borda azul que ABRE o conteúdo dentro dele, e as outras ficam como linhas fechadas
 * embaixo. Dentro do cartão: a busca e o "Recentes" na mesma linha, a grade de miniaturas com a
 * data por cima e a legenda embaixo, o "Mostrar mais" à esquerda e o aviso de que falta escolher
 * à direita.
 *
 * VÁRIOS DE UMA VEZ. Era um só (`publicacaoId`), e a referência mostra uma marca de seleção em
 * cada miniatura e escreve "Selecione ao menos 1 post" — plural assumido. Uma automação que vale
 * pra três posts de uma campanha era, antes, três automações iguais.
 *
 * O componente não conhece Instagram: recebe a lista pronta e devolve a escolha. É o que permite
 * a mesma tela servir publicação e story, que só diferem no texto e em ter ou não busca.
 */
export function EscolhaDeMidia({
  tipo,
  itens,
  carregando,
  erro,
  dados,
  onChange,
  somenteGrade,
}: {
  tipo: "post" | "story";
  itens: ItemDeMidia[];
  carregando: boolean;
  erro: string | null;
  dados: DadosDeEscopo;
  onChange: (novo: DadosDeEscopo) => void;
  /**
   * SÓ A GRADE, sem as três opções em cartão.
   *
   * No painel de gatilhos quem escolhe o escopo é um seletor na linha "Onde vale" — um clique, as
   * opções embaixo. Repetir os mesmos três cartões logo abaixo dele seria perguntar duas vezes a
   * mesma coisa, com dois jeitos diferentes de responder, na mesma tela.
   */
  somenteGrade?: boolean;
}) {
  const { t: traduzir } = useIdioma();
  const [busca, setBusca] = useState("");
  const [mostrando, setMostrando] = useState(POR_PAGINA);

  const escolhidos = useMemo(() => dados.ids ?? [], [dados.ids]);
  const escopo: Escopo = dados.escopo ?? (escolhidos.length ? "especifico" : "qualquer");

  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? itens.filter((i) => (i.legenda ?? "").toLowerCase().includes(termo))
    : itens;
  const visiveis = filtrados.slice(0, mostrando);

  const ehPost = tipo === "post";
  const rotuloEspecifico = ehPost ? "Post específico" : "Story específico";
  const rotuloQualquer = ehPost ? "Qualquer post" : "Qualquer story";
  const aviso = ehPost ? "Selecione ao menos 1 post" : "Selecione ao menos 1 story";

  function alternar(id: string) {
    const novo = escolhidos.includes(id) ? escolhidos.filter((x) => x !== id) : [...escolhidos, id];
    onChange({ ...dados, escopo: "especifico", ids: novo });
  }

  return (
    <div className={`esc-escopo${somenteGrade ? " esc-so-grade" : ""}`}>
      <div className={`esc-cartao${escopo === "especifico" ? " on" : ""}`}>
        {somenteGrade ? null : (
          <button
            type="button"
            className="esc-opcao"
            role="radio"
            aria-checked={escopo === "especifico"}
            onClick={() => onChange({ ...dados, escopo: "especifico" })}
          >
            <span className="esc-radio" aria-hidden="true" />
            <strong>{traduzir(rotuloEspecifico)}</strong>
          </button>
        )}

        {escopo === "especifico" ? (
          <div className="esc-corpo">
            <div className="esc-barra">
              {ehPost ? (
                <span className="esc-busca">
                  <IconSearch width={14} height={14} aria-hidden="true" />
                  <input
                    className="input"
                    placeholder={traduzir("Buscar")}
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      // A paginação volta ao começo junto com a busca: sem isto, "Mostrar mais"
                      // já vinha apertado pra uma lista que acabou de encolher.
                      setMostrando(POR_PAGINA);
                    }}
                  />
                </span>
              ) : (
                <span />
              )}
              {/* A ordem já vem da Meta, do mais novo pro mais velho. O botão diz qual é, como na
                  referência — e não promete uma segunda ordem que não existe. */}
              <span className="esc-ordem">
                <span aria-hidden="true">⇅</span> {traduzir("Recentes")}
              </span>
            </div>

            {erro ? (
              <p className="hint">{erro}</p>
            ) : carregando ? (
              <p className="hint">{traduzir(ehPost ? "Carregando suas publicações…" : "Carregando seus stories…")}</p>
            ) : !itens.length ? (
              <p className="hint">
                {traduzir(
                  ehPost
                    ? "Nenhuma publicação encontrada nesta conta."
                    : "Nenhum story no ar agora. Story dura 24 horas.",
                )}
              </p>
            ) : (
              <>
                <div className="esc-grade">
                  {visiveis.map((item) => {
                    const marcado = escolhidos.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`esc-item${marcado ? " on" : ""}`}
                        aria-pressed={marcado}
                        title={item.legenda || undefined}
                        onClick={() => alternar(item.id)}
                      >
                        <span className="esc-capa">
                          {item.miniatura ? (
                            /* eslint-disable-next-line @next/next/no-img-element -- CDN da Meta,
                               com endereço assinado e de vida curta: não há o que otimizar. */
                            <img src={item.miniatura} alt="" />
                          ) : (
                            <span className="esc-sem-capa">{traduzir("sem capa")}</span>
                          )}
                          <span className="esc-marca" aria-hidden="true">
                            {marcado ? <IconCheck width={11} height={11} /> : null}
                          </span>
                          {item.publicadoEm ? (
                            <span className="esc-data">{dataCurta(item.publicadoEm)}</span>
                          ) : null}
                        </span>
                        {item.legenda ? <span className="esc-legenda">{item.legenda}</span> : null}
                      </button>
                    );
                  })}
                </div>

                <div className="esc-rodape">
                  {filtrados.length > visiveis.length ? (
                    <button
                      type="button"
                      className="btn pequeno"
                      onClick={() => setMostrando((n) => n + POR_PAGINA)}
                    >
                      {traduzir("Mostrar mais")}
                    </button>
                  ) : (
                    <span />
                  )}
                  {!escolhidos.length ? <span className="esc-aviso">{traduzir(aviso)}</span> : null}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className={`esc-cartao${escopo === "qualquer" ? " on" : ""}`} hidden={somenteGrade}>
        <button
          type="button"
          className="esc-opcao"
          role="radio"
          aria-checked={escopo === "qualquer"}
          onClick={() => onChange({ ...dados, escopo: "qualquer", ids: [] })}
        >
          <span className="esc-radio" aria-hidden="true" />
          <strong>{traduzir(rotuloQualquer)}</strong>
        </button>
      </div>

      {ehPost && !somenteGrade ? (
        <div className={`esc-cartao${escopo === "proxima" ? " on" : ""}`}>
          <button
            type="button"
            className="esc-opcao"
            role="radio"
            aria-checked={escopo === "proxima"}
            onClick={() =>
              onChange({
                ...dados,
                escopo: "proxima",
                ids: [],
                // A foto do momento: o que já existe HOJE não é "o próximo post".
                conhecidos: itens.map((i) => i.id),
              })
            }
          >
            <span className="esc-radio" aria-hidden="true" />
            <strong>{traduzir("Meu próximo post")}</strong>
          </button>
        </div>
      ) : null}
    </div>
  );
}
