"use client";

import { Handle, Position } from "@xyflow/react";

import {
  CAMPOS_CONDICAO,
  CATEGORIAS_CONDICAO,
  OPERADORES_CONDICAO,
} from "@/components/automation-flow/forms/CondicaoForm";
import { IconFiltro, IconLixeira } from "@/components/icons";
import type {
  CampoCondicao,
  CondicaoRamosData,
  OperadorCondicao,
  RamoDeCondicao,
  RegraCondicao,
} from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

/**
 * O BLOCO "CONDIÇÃO" EDITÁVEL NO PRÓPRIO CARTÃO.
 *
 * Cada condição é um cartão INDEPENDENTE, com a sua própria saída na borda direita — é isso que a
 * referência faz e é o que faltava aqui: as regras moravam dentro do bloco e as ligações ficavam
 * todas empilhadas embaixo dele, numa lista de rótulos ("1 · mensagem contém oi", "2 · …"). Pra
 * saber qual linha saía de qual condição era preciso contar de cima pra baixo nos dois lugares.
 * Com a saída grudada no cartão da condição, cada uma é uma peça inteira: a pergunta e o que
 * acontece quando ela bate, no mesmo lugar.
 *
 * Dentro de um cartão as regras valem juntas (E). Vale o primeiro cartão que bater, de cima pra
 * baixo, e quem não bate em nenhum sai por "Nenhuma das condições", que também é um cartão com
 * saída própria.
 *
 * O painel da direita continua existindo e é mais poderoso: lá cabem subgrupos, OU dentro da
 * mesma condição e NÃO. Aqui ficam as regras simples, que são a maioria.
 */
let contador = 0;
function novoId(prefixo: string): string {
  contador += 1;
  return `${prefixo}-${Date.now()}-${contador}`;
}

export function novoRamoDeCondicao(): RamoDeCondicao {
  return {
    id: novoId("ramo"),
    grupo: { id: novoId("grupo"), tipo: "E", regras: [], subgrupos: [] },
  };
}

function novaRegra(): RegraCondicao {
  // "A última mensagem do contato contém …" é a regra que quase todo roteador de atendimento
  // começa escrevendo. Nascer nela economiza dois cliques na maioria das vezes.
  return { id: novoId("regra"), campo: "mensagem", operador: "contem", valor: "" };
}

/** Operadores que não comparam valor nenhum: o campo de texto some com eles. */
const SEM_VALOR: OperadorCondicao[] = ["existe", "nao_existe"];

/** O que a condição liga: o "+" que abre o próximo passo, o "×" que desfaz, e o ponto da linha. */
function SaidaDaCondicao({
  handleId,
  titulo,
  conectada,
  onAdicionarApos,
  aoDesligarSaida,
}: {
  handleId: string;
  titulo: string;
  conectada: boolean;
  onAdicionarApos?: (handleId: string | undefined, ancora?: DOMRect) => void;
  aoDesligarSaida?: (handleId: string | undefined) => void;
}) {
  const { t: traduzir } = useIdioma();
  return (
    <>
      {!conectada && onAdicionarApos ? (
        <button
          type="button"
          className="cond-saida"
          title={titulo}
          aria-label={titulo}
          onClick={(e) => {
            e.stopPropagation();
            onAdicionarApos(handleId, e.currentTarget.getBoundingClientRect());
          }}
        >
          +
        </button>
      ) : null}
      {/* Já ligada: o "+" vira "×", que desfaz só a ligação desta condição. Achar a linha certa no
          meio de cinco que se cruzam pra apertar Delete era sorte. */}
      {conectada && aoDesligarSaida ? (
        <button
          type="button"
          className="cond-saida cond-saida-tirar"
          title={traduzir("Tirar a ligação desta condição")}
          aria-label={traduzir("Tirar a ligação desta condição")}
          onClick={(e) => {
            e.stopPropagation();
            aoDesligarSaida(handleId);
          }}
        >
          ×
        </button>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        id={handleId}
        className="flow-handle flow-handle-inline cond-handle"
      />
    </>
  );
}

export function CartaoCondicaoRamos({
  data,
  aoMudar,
  saidasConectadas,
  onAdicionarApos,
  aoDesligarSaida,
}: {
  data: CondicaoRamosData;
  aoMudar: (ramos: RamoDeCondicao[]) => void;
  saidasConectadas?: Set<string>;
  onAdicionarApos?: (handleId: string | undefined, ancora?: DOMRect) => void;
  aoDesligarSaida?: (handleId: string | undefined) => void;
}) {
  const { t: traduzir } = useIdioma();
  const ramos = data.ramos ?? [];

  function mudarRamo(ramoId: string, mudanca: (r: RamoDeCondicao) => RamoDeCondicao) {
    aoMudar(ramos.map((r) => (r.id === ramoId ? mudanca(r) : r)));
  }

  function mudarRegra(ramoId: string, regraId: string, patch: Partial<RegraCondicao>) {
    mudarRamo(ramoId, (r) => ({
      ...r,
      grupo: {
        ...r.grupo,
        regras: r.grupo.regras.map((regra) => (regra.id === regraId ? { ...regra, ...patch } : regra)),
      },
    }));
  }

  return (
    <div className="cond-ramos nodrag" onClick={(e) => e.stopPropagation()}>
      {ramos.map((ramo, i) => (
        <div className="cond-ramo" key={ramo.id}>
          <div className="cond-ramo-topo">
            <IconFiltro width={12} height={12} className="cond-ramo-icone" aria-hidden="true" />
            <span className="cond-ramo-num">{i + 1}</span>
            <input
              className="cond-ramo-nome"
              value={ramo.rotulo ?? ""}
              placeholder={`${traduzir("Condição")} ${i + 1}`}
              aria-label={traduzir("Nome desta condição")}
              onChange={(e) => mudarRamo(ramo.id, (r) => ({ ...r, rotulo: e.target.value }))}
            />
            {/* A última condição não se apaga: sem nenhuma, o bloco vira um desvio com uma saída só. */}
            {ramos.length > 1 ? (
              <button
                type="button"
                className="cond-tirar"
                aria-label={traduzir("Tirar esta condição")}
                title={traduzir("Tirar esta condição")}
                onClick={() => aoMudar(ramos.filter((r) => r.id !== ramo.id))}
              >
                <IconLixeira width={11} height={11} />
              </button>
            ) : null}
          </div>

          {ramo.grupo.regras.map((regra, j) => (
            <div className="cond-regra" key={regra.id}>
              <span className="cond-regra-e">{j === 0 ? traduzir("Se") : traduzir("e")}</span>
              <select
                className="cond-campo"
                value={regra.campo}
                aria-label={traduzir("Campo")}
                onChange={(e) =>
                  // Trocar o campo zera o valor: "origem é INSTAGRAM" com o campo trocado pra
                  // "valor do negócio" viraria "valor é INSTAGRAM", que nunca bate e ninguém vê.
                  mudarRegra(ramo.id, regra.id, { campo: e.target.value as CampoCondicao, valor: "" })
                }
              >
                {CATEGORIAS_CONDICAO.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {CAMPOS_CONDICAO.filter((c) => c.categoria === cat).map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {traduzir(c.label)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {/* Comparação e valor andam JUNTOS quando a linha não cabe: "contém: orçamento"
                  desce inteiro pra segunda linha, em vez de o valor descer sozinho e virar um
                  campo solto embaixo, sem dizer do que ele é o valor. */}
              <span className="cond-comp">
                <select
                  className="cond-operador"
                  value={regra.operador}
                  aria-label={traduzir("Comparação")}
                  onChange={(e) => mudarRegra(ramo.id, regra.id, { operador: e.target.value as OperadorCondicao })}
                >
                  {OPERADORES_CONDICAO.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {traduzir(o.label)}
                    </option>
                  ))}
                </select>
                {SEM_VALOR.includes(regra.operador) ? null : (
                  <>
                    <span className="cond-dois-pontos" aria-hidden="true">
                      :
                    </span>
                    <input
                      className="cond-valor"
                      value={regra.valor ?? ""}
                      placeholder={traduzir("valor")}
                      aria-label={traduzir("Valor")}
                      onChange={(e) => mudarRegra(ramo.id, regra.id, { valor: e.target.value })}
                    />
                    {regra.operador === "entre" ? (
                      <input
                        className="cond-valor"
                        value={regra.valorFim ?? ""}
                        placeholder={traduzir("até")}
                        aria-label={traduzir("Valor final")}
                        onChange={(e) => mudarRegra(ramo.id, regra.id, { valorFim: e.target.value })}
                      />
                    ) : null}
                  </>
                )}
              </span>
              <button
                type="button"
                className="cond-tirar"
                aria-label={traduzir("Tirar esta regra")}
                onClick={() =>
                  mudarRamo(ramo.id, (r) => ({
                    ...r,
                    grupo: { ...r.grupo, regras: r.grupo.regras.filter((x) => x.id !== regra.id) },
                  }))
                }
              >
                <IconLixeira width={10} height={10} />
              </button>
            </div>
          ))}

          {/*
            CONDIÇÃO SEM REGRA PEGA TODO MUNDO, e isso precisa estar escrito no cartão.

            Um grupo "E" vazio é verdadeiro — e uma condição verdadeira sempre apaga as de baixo,
            em silêncio. A validação cobra isso antes de publicar; aqui a frase aparece na hora.
          */}
          {ramo.grupo.regras.length === 0 ? (
            <p className="cond-vazio">{traduzir("Sem regra, esta condição pega todo mundo.")}</p>
          ) : null}

          <button
            type="button"
            className="cond-add-e"
            onClick={() =>
              mudarRamo(ramo.id, (r) => ({ ...r, grupo: { ...r.grupo, regras: [...r.grupo.regras, novaRegra()] } }))
            }
          >
            + {traduzir("Adicionar condição (e)")}
          </button>

          <SaidaDaCondicao
            handleId={ramo.id}
            titulo={traduzir("O que acontece quando esta condição bate?")}
            conectada={saidasConectadas?.has(ramo.id) ?? false}
            onAdicionarApos={onAdicionarApos}
            aoDesligarSaida={aoDesligarSaida}
          />
        </div>
      ))}

      <button type="button" className="cond-add-ramo" onClick={() => aoMudar([...ramos, novoRamoDeCondicao()])}>
        + {traduzir("Adicionar próxima condição")}
      </button>

      {/* A saída padrão não se edita, mas é um cartão como os outros: quem olha precisa saber que
          ela existe — e poder ligar nela — antes de procurar por que um lead sumiu no meio. */}
      <div className="cond-ramo cond-senao">
        <div className="cond-ramo-topo">
          <span className="cond-ramo-num cond-num-senao" aria-hidden="true">
            ·
          </span>
          <span className="cond-senao-texto">{traduzir("Nenhuma das condições")}</span>
        </div>
        <SaidaDaCondicao
          handleId="senao"
          titulo={traduzir("O que acontece com quem não bate em nenhuma?")}
          conectada={saidasConectadas?.has("senao") ?? false}
          onAdicionarApos={onAdicionarApos}
          aoDesligarSaida={aoDesligarSaida}
        />
      </div>
    </div>
  );
}
