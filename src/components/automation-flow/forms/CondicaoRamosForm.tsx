"use client";

import { CondicaoForm, novoGrupoCondicoes } from "./CondicaoForm";
import { IconClose } from "@/components/icons";
import type { CondicaoRamosData, RamoDeCondicao } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";
import { Ajuda } from "@/components/ui";

/**
 * O painel do bloco "Condição: regras por caminho".
 *
 * O cartão no canvas já edita as regras simples, que são a maioria. Aqui cabe o que não cabe lá:
 * subgrupos, OU dentro do mesmo ramo e NÃO — tudo isso pelo mesmo `CondicaoForm` que o bloco de
 * sim/não usa. Dois editores de condição com comportamentos diferentes seria a mesma pergunta
 * respondida de dois jeitos.
 */
export function CondicaoRamosForm({
  data,
  onChange,
}: {
  data: CondicaoRamosData;
  onChange: (novo: CondicaoRamosData) => void;
}) {
  const { t: traduzir } = useIdioma();
  const ramos = data.ramos ?? [];

  function trocar(ramos: RamoDeCondicao[]) {
    onChange({ ...data, ramos });
  }

  return (
    <div className="flow-form">
      {ramos.map((ramo, i) => (
        <div className="field" key={ramo.id}>
          <label>
            {traduzir("Caminho")} {i + 1}
          </label>
          <div className="cond-ramo-painel-topo">
            <input
              className="input"
              value={ramo.rotulo ?? ""}
              placeholder={traduzir("Nome deste caminho (opcional)")}
              onChange={(e) => trocar(ramos.map((r) => (r.id === ramo.id ? { ...r, rotulo: e.target.value } : r)))}
            />
            {ramos.length > 1 ? (
              <button
                type="button"
                className="icon-btn subtle"
                aria-label={traduzir("Tirar este caminho")}
                onClick={() => trocar(ramos.filter((r) => r.id !== ramo.id))}
              >
                <IconClose width={12} height={12} />
              </button>
            ) : null}
          </div>
          <CondicaoForm
            grupo={ramo.grupo}
            onChange={(grupo) => trocar(ramos.map((r) => (r.id === ramo.id ? { ...r, grupo } : r)))}
          />
        </div>
      ))}

      <div className="field">
        <label>
          {traduzir("Ordem dos caminhos")}
          <Ajuda
            texto={traduzir(
              "Vale o primeiro caminho que bater, de cima pra baixo. Quem não bater em nenhum sai por \"Nenhuma das condições\", que existe sempre e não se apaga.",
            )}
          />
        </label>
        <button
          type="button"
          className="btn ghost block"
          onClick={() =>
            trocar([...ramos, { id: `ramo-${Date.now()}`, grupo: novoGrupoCondicoes() }])
          }
        >
          + {traduzir("Adicionar próxima condição")}
        </button>
      </div>
    </div>
  );
}
