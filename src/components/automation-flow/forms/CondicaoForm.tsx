"use client";

import type { GrupoCondicoes, RegraCondicao } from "@/lib/automation-flow/types";
import type { AreaAutomacao } from "@/lib/canais/capacidades";
import { regraPadrao } from "@/lib/automation-flow/campos-condicao";
import { IconClose } from "@/components/icons";
import { useIdioma } from "@/lib/idioma-context";
import { RegraDeCondicao } from "./RegraDeCondicao";
import { useCamposDeCondicao } from "./useCamposDeCondicao";

/**
 * O EDITOR COMPLETO DE CONDIÇÃO: E/OU/NÃO, regras e subgrupos aninhados.
 *
 * O cartão do canvas edita a maioria dos casos (uma condição = regras somadas com E). Aqui cabe o
 * que não cabe lá: OU dentro da mesma condição, NÃO, e grupos dentro de grupos.
 *
 * A LINHA DA REGRA é a mesma dos dois lados (`RegraDeCondicao`). Eram duas, escritas separado, e
 * tinham divergido no pior lugar possível: o painel oferecia onze operadores pra qualquer campo
 * — "Data da última conversa começa com" — e a lista de campos do painel não tinha "Cliente
 * enviar", o campo mais usado de todos, o que fazia o `<select>` mostrar "Canal" enquanto o dado
 * gravado continuava sendo a mensagem.
 */

let contador = 0;
function novoId(prefixo: string): string {
  contador += 1;
  return `${prefixo}-${Date.now()}-${contador}`;
}

export function novoGrupoCondicoes(): GrupoCondicoes {
  // Nasce COM regra: grupo "E" vazio é verdadeiro, e uma condição verdadeira pega todo mundo.
  return { id: novoId("grupo"), tipo: "E", regras: [novaRegra()], subgrupos: [] };
}

function novaRegra(): RegraCondicao {
  return regraPadrao(novoId("regra"));
}

export function CondicaoForm({
  grupo,
  onChange,
  nivel = 0,
  area,
}: {
  grupo: GrupoCondicoes;
  onChange: (novo: GrupoCondicoes) => void;
  nivel?: number;
  /** Decide quais campos a lista oferece: Instagram no social, WhatsApp no funil. */
  area?: AreaAutomacao;
}) {
  const { t: traduzir } = useIdioma();
  const campos = useCamposDeCondicao(area);

  function atualizarRegra(id: string, patch: Partial<RegraCondicao>) {
    onChange({ ...grupo, regras: grupo.regras.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  /** Tirar a última regra devolve a padrão: grupo sem regra nenhuma passa sempre. */
  function removerRegra(id: string) {
    const sobraram = grupo.regras.filter((r) => r.id !== id);
    const temSubgrupo = grupo.subgrupos.length > 0;
    onChange({ ...grupo, regras: sobraram.length || temSubgrupo ? sobraram : [novaRegra()] });
  }
  function atualizarSubgrupo(id: string, novo: GrupoCondicoes) {
    onChange({ ...grupo, subgrupos: grupo.subgrupos.map((g) => (g.id === id ? novo : g)) });
  }
  function removerSubgrupo(id: string) {
    onChange({ ...grupo, subgrupos: grupo.subgrupos.filter((g) => g.id !== id) });
  }

  const funilEscolhido = grupo.regras.find((r) => r.campo === "funil")?.valor?.trim() || undefined;

  return (
    <div className="flow-cond-grupo" style={{ marginLeft: nivel > 0 ? 12 : 0 }}>
      <div className="flow-cond-grupo-h">
        <div className="seg-picker" role="group" aria-label={traduzir("Tipo do grupo de condições")}>
          {(["E", "OU", "NAO"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              className={`seg-chip${grupo.tipo === tipo ? " on" : ""}`}
              aria-pressed={grupo.tipo === tipo}
              onClick={() => onChange({ ...grupo, tipo })}
            >
              {tipo === "NAO" ? traduzir("NÃO") : tipo}
            </button>
          ))}
        </div>
      </div>

      {/* O que a escolha acima quer dizer, em uma linha: "E" e "OU" são óbvios pra quem programa e
          não pra quem está montando um atendimento. */}
      <p className="hint flow-cond-explica">
        {traduzir(
          grupo.tipo === "OU"
            ? "Basta UMA das regras ser verdadeira."
            : grupo.tipo === "NAO"
              ? "Vale quando as regras NÃO são todas verdadeiras."
              : "TODAS as regras precisam ser verdadeiras.",
        )}
      </p>

      {grupo.regras.map((regra) => (
        <div className="flow-cond-regra" key={regra.id}>
          <RegraDeCondicao
            regra={regra}
            campos={campos}
            variante="painel"
            funilEscolhido={funilEscolhido}
            aoMudar={(patch) => atualizarRegra(regra.id, patch)}
          />
          <button
            type="button"
            className="remove-chip"
            aria-label={traduzir("Remover regra")}
            onClick={() => removerRegra(regra.id)}
          >
            <IconClose width={13} height={13} />
          </button>
        </div>
      ))}

      {grupo.subgrupos.map((sub) => (
        <div className="flow-cond-subgrupo" key={sub.id}>
          <CondicaoForm grupo={sub} onChange={(novo) => atualizarSubgrupo(sub.id, novo)} nivel={nivel + 1} area={area} />
          <button type="button" className="btn ghost mt8" onClick={() => removerSubgrupo(sub.id)}>
            {traduzir("Remover subgrupo")}
          </button>
        </div>
      ))}

      <div className="flow-cond-acoes">
        <button
          type="button"
          className="btn ghost"
          onClick={() => onChange({ ...grupo, regras: [...grupo.regras, novaRegra()] })}
        >
          + {traduzir("Regra")}
        </button>
        {nivel < 2 ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => onChange({ ...grupo, subgrupos: [...grupo.subgrupos, novoGrupoCondicoes()] })}
          >
            + {traduzir("Subgrupo")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
