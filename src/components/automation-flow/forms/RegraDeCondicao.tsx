"use client";

import { SeletorDeData } from "@/components/seletor-de-data";
import {
  FONTES_DE_VALOR,
  fontePedeTexto,
  operadoresDoCampo,
  pedeValor,
  rotuloDaFonte,
  tipoDoCampo,
} from "@/lib/automation-flow/campos-condicao";
import type { CampoCondicao, OperadorCondicao, RegraCondicao } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";
import { SeletorBuscavel } from "./SeletorBuscavel";
import type { CamposDeCondicao } from "./useCamposDeCondicao";

/**
 * UMA REGRA DE CONDIÇÃO, lida como frase: "Se <campo> <comparação>: <valor>".
 *
 * A MESMA linha serve ao cartão do canvas e ao painel da direita, com classes diferentes. Eram
 * dois editores escritos separados, e as duas telas já tinham divergido: o painel oferecia onze
 * operadores pra todo campo (inclusive "Respondeu entre") e o cartão não tinha o campo mais usado
 * de todos na lista.
 *
 * O que cada campo aceita sai do catálogo (`campos-condicao.ts`): operadores pelo TIPO do campo, e
 * o controle de valor pelo tipo também — lista escolhe de uma lista real, data abre calendário,
 * número aceita número, "existe" não pede valor nenhum.
 */
export function RegraDeCondicao({
  regra,
  campos,
  funilEscolhido,
  variante,
  aoMudar,
  primeira,
}: {
  regra: RegraCondicao;
  campos: CamposDeCondicao;
  /** O funil escolhido por outra regra da MESMA condição, pra "Etapa" listar só as dele. */
  funilEscolhido?: string;
  variante: "cartao" | "painel";
  aoMudar: (patch: Partial<RegraCondicao>) => void;
  /** No cartão, a primeira regra começa com "Se" e as outras com "e". */
  primeira?: boolean;
}) {
  const { t: traduzir } = useIdioma();
  const noCartao = variante === "cartao";
  const tipo = tipoDoCampo(regra.campo, campos.personalizados);
  const operadores = operadoresDoCampo(regra.campo, campos.personalizados);
  const opcoesDeValor = campos.opcoesDeValor(regra.campo, funilEscolhido);
  const mostraValor = pedeValor(regra.operador);
  // A fonte só aparece onde ela quer dizer alguma coisa: comparar texto com OUTRO campo do lead é
  // útil ("a mensagem contém o nome do responsável"); comparar uma etapa com um token, não.
  const aceitaFonte = tipo === "texto";
  const comFonte = !fontePedeTexto(regra.fonteValor);

  function trocarCampo(novo: string) {
    /*
     * TROCAR O CAMPO ZERA O OPERADOR E O VALOR.
     *
     * "origem é INSTAGRAM" com o campo trocado pra "valor do negócio" viraria "valor é INSTAGRAM",
     * que nunca bate e ninguém vê. E o operador pode nem existir no tipo novo — "começa com" numa
     * data é uma regra que a tela aceita e o motor ignora.
     */
    const campo = novo as CampoCondicao;
    const operadoresNovos = operadoresDoCampo(campo, campos.personalizados);
    const mantem = operadoresNovos.some((o) => o.valor === regra.operador);
    aoMudar({
      campo,
      operador: mantem ? regra.operador : operadoresNovos[0].valor,
      valor: "",
      valorFim: "",
      fonteValor: "manual",
      // O nome fica guardado na regra pra saída do bloco escrever "Turma" em vez de "cp:a1b2".
      campoPersonalizadoNome: campos.nomeDoCampo(campo),
    });
  }

  const classeCampo = noCartao ? "cond-campo" : "input";
  const classeOperador = noCartao ? "cond-operador" : "input";
  const classeValor = noCartao ? "cond-valor" : "input";

  function controleDeValor(qual: "inicio" | "fim") {
    const valor = (qual === "inicio" ? regra.valor : regra.valorFim) ?? "";
    const mudar = (v: string) => aoMudar(qual === "inicio" ? { valor: v } : { valorFim: v });
    const rotulo = qual === "inicio" ? traduzir("Valor") : traduzir("Valor final");

    if (opcoesDeValor) {
      return (
        <SeletorBuscavel
          valor={valor}
          opcoes={opcoesDeValor.map((o) => ({ valor: o.valor, label: o.label }))}
          aoEscolher={mudar}
          className={classeValor}
          ariaLabel={rotulo}
          placeholder={traduzir("Selecione…")}
        />
      );
    }
    if (tipo === "numero" || tipo === "moeda") {
      return (
        <input
          className={classeValor}
          type="number"
          step={tipo === "moeda" ? "0.01" : "1"}
          inputMode="decimal"
          value={valor}
          placeholder={qual === "inicio" ? traduzir("valor") : traduzir("até")}
          aria-label={rotulo}
          onChange={(e) => mudar(e.target.value)}
        />
      );
    }
    if (tipo === "data") {
      return noCartao ? (
        <input className={classeValor} type="date" value={valor} aria-label={rotulo} onChange={(e) => mudar(e.target.value)} />
      ) : (
        <SeletorDeData valor={valor} onChange={mudar} curto />
      );
    }
    if (tipo === "hora") {
      return <input className={classeValor} type="time" value={valor} aria-label={rotulo} onChange={(e) => mudar(e.target.value)} />;
    }
    return (
      <input
        className={classeValor}
        value={valor}
        placeholder={qual === "inicio" ? traduzir("valor") : traduzir("até")}
        aria-label={rotulo}
        onChange={(e) => mudar(e.target.value)}
      />
    );
  }

  return (
    <>
      {noCartao ? <span className="cond-regra-e">{primeira ? traduzir("Se") : traduzir("e")}</span> : null}

      <SeletorBuscavel
        valor={regra.campo}
        opcoes={campos.opcoes}
        aoEscolher={trocarCampo}
        className={classeCampo}
        ariaLabel={traduzir("Campo da condição")}
      />

      {/* Compatibilidade: fluxo antigo que guardou o campo da empresa PELO NOME continua editável. */}
      {regra.campo === "campo_personalizado" ? (
        <input
          className={classeValor}
          placeholder={traduzir("Nome do campo")}
          value={regra.campoPersonalizadoNome ?? ""}
          aria-label={traduzir("Nome do campo personalizado")}
          onChange={(e) => aoMudar({ campoPersonalizadoNome: e.target.value })}
        />
      ) : null}

      <span className="cond-comp">
        <SeletorBuscavel
          valor={regra.operador}
          opcoes={operadores.map((o) => ({ valor: o.valor, label: o.label }))}
          aoEscolher={(v) => aoMudar({ operador: v as OperadorCondicao })}
          className={classeOperador}
          ariaLabel={traduzir("Comparação")}
          larguraMinima={180}
        />

        {mostraValor ? (
          <>
            {noCartao ? (
              <span className="cond-dois-pontos" aria-hidden="true">
                :
              </span>
            ) : null}
            {comFonte ? (
              <span className={`cond-fonte-chip ${classeValor}`}>{traduzir(rotuloDaFonte(regra.fonteValor))}</span>
            ) : (
              controleDeValor("inicio")
            )}
            {regra.operador === "entre" && !comFonte ? (
              <>
                <span className="cond-ate" aria-hidden="true">
                  {traduzir("a")}
                </span>
                {controleDeValor("fim")}
              </>
            ) : null}
            {/*
              DE ONDE VEM O VALOR: digitado, vazio, ou outro campo do próprio lead.
              
              Fica escondido atrás de um botão minúsculo de propósito: quase toda regra compara com
              texto digitado, e um seletor a mais em toda linha faria a condição parecer um
              formulário de imposto. Quem precisa de "contém o nome do responsável" acha; quem não
              precisa nem repara.
            */}
            {aceitaFonte ? (
              <SeletorBuscavel
                valor={regra.fonteValor ?? "manual"}
                opcoes={FONTES_DE_VALOR}
                aoEscolher={(v) => aoMudar({ fonteValor: v, ...(v === "manual" ? {} : { valor: "" }) })}
                className="cond-fonte"
                ariaLabel={traduzir("De onde vem o valor")}
                larguraMinima={230}
              />
            ) : null}
          </>
        ) : null}
      </span>
    </>
  );
}
