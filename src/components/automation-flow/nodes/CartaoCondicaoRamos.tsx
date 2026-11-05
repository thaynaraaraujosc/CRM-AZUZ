"use client";

import {
  CAMPOS_CONDICAO,
  CATEGORIAS_CONDICAO,
  OPERADORES_CONDICAO,
} from "@/components/automation-flow/forms/CondicaoForm";
import { IconClose } from "@/components/icons";
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
 * Cada ramo é uma pergunta inteira ("veio do Instagram E falou em consulta") e tem a sua saída;
 * dentro dele as regras valem juntas (E). Vale o primeiro ramo que bater, de cima pra baixo, e
 * quem não bate em nenhum sai por "Nenhuma das condições".
 *
 * Editar aqui, e não só no painel da direita, é o ponto: um roteador de atendimento tem quatro ou
 * cinco perguntas, e ler "4 caminhos" no cartão pra depois abrir o painel e descobrir quais são
 * transforma entender o fluxo numa sequência de cliques. As saídas continuam sendo desenhadas
 * embaixo do cartão, onde todo bloco do CRM desenha as dele.
 *
 * O painel da direita continua existindo e é mais poderoso: lá cabem subgrupos, OU dentro do ramo
 * e NÃO. Aqui ficam as regras simples, que são a maioria.
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

export function CartaoCondicaoRamos({
  data,
  aoMudar,
}: {
  data: CondicaoRamosData;
  aoMudar: (ramos: RamoDeCondicao[]) => void;
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
            <span className="cond-ramo-num">{i + 1}</span>
            <input
              className="cond-ramo-nome"
              value={ramo.rotulo ?? ""}
              placeholder={traduzir("Nome deste caminho (opcional)")}
              onChange={(e) => mudarRamo(ramo.id, (r) => ({ ...r, rotulo: e.target.value }))}
            />
            {/* O último ramo não se apaga: sem nenhum, o bloco vira um desvio com uma saída só. */}
            {ramos.length > 1 ? (
              <button
                type="button"
                className="cond-tirar"
                aria-label={traduzir("Tirar este caminho")}
                onClick={() => aoMudar(ramos.filter((r) => r.id !== ramo.id))}
              >
                <IconClose width={11} height={11} />
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
                <input
                  className="cond-valor"
                  value={regra.valor ?? ""}
                  placeholder={traduzir("valor")}
                  aria-label={traduzir("Valor")}
                  onChange={(e) => mudarRegra(ramo.id, regra.id, { valor: e.target.value })}
                />
              )}
              {regra.operador === "entre" ? (
                <input
                  className="cond-valor"
                  value={regra.valorFim ?? ""}
                  placeholder={traduzir("até")}
                  aria-label={traduzir("Valor final")}
                  onChange={(e) => mudarRegra(ramo.id, regra.id, { valorFim: e.target.value })}
                />
              ) : null}
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
                <IconClose width={10} height={10} />
              </button>
            </div>
          ))}

          {/*
            RAMO SEM REGRA PEGA TODO MUNDO, e isso precisa estar escrito no cartão.
            
            Um grupo "E" vazio é verdadeiro — e um ramo verdadeiro sempre apaga os de baixo, em
            silêncio. A validação cobra isso antes de publicar; aqui a frase aparece na hora.
          */}
          {ramo.grupo.regras.length === 0 ? (
            <p className="cond-vazio">{traduzir("Sem regra, este caminho pega todo mundo.")}</p>
          ) : null}

          <button
            type="button"
            className="cond-add-e"
            onClick={() =>
              mudarRamo(ramo.id, (r) => ({ ...r, grupo: { ...r.grupo, regras: [...r.grupo.regras, novaRegra()] } }))
            }
          >
            {traduzir("Adicionar condição (e)")}
          </button>
        </div>
      ))}

      <button type="button" className="cond-add-ramo" onClick={() => aoMudar([...ramos, novoRamoDeCondicao()])}>
        + {traduzir("Adicionar próxima condição")}
      </button>

      {/* A saída padrão aparece no cartão mesmo não sendo editável: ela é parte da forma do bloco,
          e quem olha precisa saber que ela existe antes de procurar por que um lead sumiu. */}
      <div className="cond-senao">{traduzir("Nenhuma das condições")}</div>
    </div>
  );
}
