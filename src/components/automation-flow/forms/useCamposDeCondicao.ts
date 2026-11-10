"use client";

import { useEffect, useMemo, useState } from "react";

import { ORIGENS } from "@/lib/data";
import { useEquipe } from "@/lib/equipe-context";
import { useFunis } from "@/lib/funis-context";
import { lerCamposDoContato, type CampoDoContato } from "@/lib/contatos/campos-do-contato";
import {
  camposDaArea,
  PERFIS_INSTAGRAM,
  PREFIXO_CAMPO_PERSONALIZADO,
  infoDoCampo,
  type CampoCondicaoInfo,
  type TipoDeCampoCondicao,
} from "@/lib/automation-flow/campos-condicao";
import type { CampoCondicao } from "@/lib/automation-flow/types";
import type { AreaAutomacao } from "@/lib/canais/capacidades";
import { useEquipesDisponiveis } from "./useEquipesDisponiveis";
import { useEtiquetasDisponiveis } from "./EtiquetaSelect";
import type { OpcaoBuscavel } from "./SeletorBuscavel";

/**
 * TUDO QUE UMA CONDIÇÃO PODE PERGUNTAR, já com os dados REAIS deste workspace.
 *
 * O catálogo (`campos-condicao.ts`) é puro e diz só DE ONDE vêm as opções de cada campo —
 * "etiquetas", "funis", "responsáveis". É aqui que elas viram lista de verdade, lendo os mesmos
 * contextos que o resto do CRM usa. Sem isso, "Etapa" seria um campo de texto onde a pessoa
 * digita o nome da etapa e erra uma letra.
 *
 * Os campos que a própria empresa criou entram pelo mesmo caminho: a definição mora em
 * `Preferencia`, chave `campos-do-contato`, e cada um vira um campo de condição `cp:<id>` com o
 * tipo certo — escolha vira lista com as opções reais, número vira número, data vira data.
 */

const CANAIS = [
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "instagram", label: "Instagram" },
  { valor: "email", label: "E-mail" },
];

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const TIPO_DO_CAMPO_DA_EMPRESA: Record<CampoDoContato["tipo"], TipoDeCampoCondicao> = {
  texto: "texto",
  numero: "numero",
  data: "data",
  escolha: "lista",
};

/** Os campos criados pela empresa, lidos uma vez por tela. */
export function useCamposDaEmpresa(): CampoDoContato[] {
  const [campos, setCampos] = useState<CampoDoContato[]>([]);
  useEffect(() => {
    let vivo = true;
    fetch("/api/contatos/campos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((dados) => {
        if (vivo) setCampos(lerCamposDoContato(dados));
      })
      .catch(() => {
        /* Sem os campos da empresa a condição segue inteira: só não oferece os personalizados. */
      });
    return () => {
      vivo = false;
    };
  }, []);
  return campos;
}

export type CamposDeCondicao = {
  /** Pro seletor com busca: catálogo + campos da empresa, agrupados. */
  opcoes: OpcaoBuscavel[];
  /** Pros utilitários puros (`tipoDoCampo`, `operadoresDoCampo`) enxergarem os da empresa. */
  personalizados: CampoCondicaoInfo[];
  /** O nome que fica guardado na regra pra saída do bloco poder escrever o campo sem a lista. */
  nomeDoCampo: (campo: CampoCondicao) => string | undefined;
  /** As opções de valor de um campo de lista. `null` = este campo não é lista. */
  opcoesDeValor: (campo: CampoCondicao, funilEscolhido?: string) => { valor: string; label: string }[] | null;
};

/**
 * `area` decide QUAIS campos a lista oferece: "É seguidor" é pergunta de robô de Instagram, e
 * "Número salvo" é de robô de WhatsApp. Sem área, oferece todos — é o que as telas que não sabem
 * de qual robô se trata precisam.
 */
export function useCamposDeCondicao(area?: AreaAutomacao): CamposDeCondicao {
  const { funis } = useFunis();
  const { membros } = useEquipe();
  const equipes = useEquipesDisponiveis();
  const etiquetas = useEtiquetasDisponiveis();
  const daEmpresa = useCamposDaEmpresa();

  const personalizados = useMemo<CampoCondicaoInfo[]>(
    () =>
      daEmpresa.map((c) => ({
        valor: `${PREFIXO_CAMPO_PERSONALIZADO}${c.id}` as CampoCondicao,
        label: c.nome,
        grupo: "Campos personalizados" as const,
        tipo: TIPO_DO_CAMPO_DA_EMPRESA[c.tipo],
        opcoesFixas: c.opcoes?.map((o) => ({ valor: o, label: o })),
      })),
    [daEmpresa],
  );

  const opcoes = useMemo<OpcaoBuscavel[]>(
    () =>
      [...camposDaArea(area), ...personalizados]
        // O campo "pelo nome" é só compatibilidade com fluxos antigos: quem monta hoje escolhe o
        // campo da empresa direto na lista, e oferecer os dois caminhos convida ao errado.
        .filter((c) => c.valor !== "campo_personalizado")
        .map((c) => ({ valor: c.valor, label: c.label, grupo: c.grupo })),
    [personalizados, area],
  );

  return {
    opcoes,
    personalizados,
    nomeDoCampo: (campo) => infoDoCampo(campo, personalizados)?.label,
    opcoesDeValor: (campo, funilEscolhido) => {
      const info = infoDoCampo(campo, personalizados);
      if (!info) return null;
      if (info.tipo === "booleano") {
        return [
          { valor: "sim", label: "Sim" },
          { valor: "nao", label: "Não" },
        ];
      }
      if (info.opcoesFixas) return info.opcoesFixas;
      // `multi` (etiqueta) escolhe das MESMAS opções que uma lista; o que muda é quantas de cada
      // vez, e isso é o operador que diz.
      if (info.tipo !== "lista" && info.tipo !== "multi") return null;
      switch (info.opcoes) {
        case "canais":
          return CANAIS;
        case "etiquetas":
          return etiquetas.map((e) => ({ valor: e, label: e }));
        case "funis":
          return funis.map((f) => ({ valor: f.nome, label: f.nome }));
        case "etapas": {
          /*
           * ETAPA DEPENDE DO FUNIL, quando a mesma condição já escolheu um.
           *
           * Sem isso a lista é a soma das etapas de todos os funis — com "Fechado" aparecendo três
           * vezes, uma por funil, e nenhuma forma de saber qual é qual. Com um funil escolhido na
           * condição, as etapas são as DELE; sem funil escolhido, são todas, sem repetição.
           */
          const doFunil = funilEscolhido ? funis.find((f) => f.nome === funilEscolhido) : undefined;
          const titulos = doFunil
            ? doFunil.colunas.map((c) => c.titulo)
            : Array.from(new Set(funis.flatMap((f) => f.colunas.map((c) => c.titulo))));
          return titulos.map((t) => ({ valor: t, label: t }));
        }
        case "responsaveis":
          return membros.map((m) => ({ valor: m.nome, label: m.nome }));
        case "equipes":
          return equipes.map((e) => ({ valor: e, label: e }));
        case "dias_semana":
          return DIAS_SEMANA.map((d) => ({ valor: d, label: d }));
        case "perfil_instagram":
          return PERFIS_INSTAGRAM;
        case "origens_do_lead":
          // As origens que o CRM grava de verdade (ver `ORIGENS` em `data.ts`). Era campo de texto
          // livre: quem escrevesse "instagram" com minúscula montava uma regra que nunca batia.
          return ORIGENS.map((o) => ({ valor: o, label: o }));
        default:
          return null;
      }
    },
  };
}
