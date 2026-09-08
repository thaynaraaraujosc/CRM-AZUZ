"use client";

import type { IaClassificarData } from "@/lib/automation-flow/types";
import { IconClose } from "@/components/icons";

/**
 * Configuração do bloco "Classificar com IA".
 *
 * Precisa de formulário próprio porque cada categoria é uma SAÍDA do bloco: mexer nessa lista muda
 * os caminhos do fluxo no canvas, e o formulário genérico (que edita chaves soltas) não daria conta
 * disso sem a pessoa se perder.
 */
export function IaClassificarForm({
  data,
  onChange,
  onRemoverCategoria,
}: {
  data: IaClassificarData;
  onChange: (data: Partial<IaClassificarData>) => void;
  onRemoverCategoria?: (categoria: string) => void;
}) {
  const categorias = data.categorias ?? [];

  function alterar(indice: number, valor: string) {
    onChange({ categorias: categorias.map((c, i) => (i === indice ? valor : c)) });
  }

  function remover(indice: number) {
    const saindo = categorias[indice];
    onChange({ categorias: categorias.filter((_, i) => i !== indice) });
    // A aresta ligada nessa categoria some junto. Senão fica um caminho apontando pra uma saída
    // que não existe mais, e o fluxo trava ali sem explicação.
    if (saindo) onRemoverCategoria?.(saindo);
  }

  return (
    <div className="flow-form">
      <div className="field">
        <label>Critério (opcional)</label>
        <textarea
          className="input"
          rows={3}
          placeholder="Ex.: se a pessoa pergunta valor, é orçamento; se reclama de atraso, é reclamação."
          value={data.instrucao ?? ""}
          onChange={(e) => onChange({ instrucao: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Categorias</label>
        <p className="hint">
          Cada uma vira uma saída do bloco. Quando a IA não encaixa a conversa em nenhuma, o fluxo
          segue pela saída &quot;Não classificado&quot;. Ela não escolhe um caminho no chute.
        </p>
        {categorias.map((categoria, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              value={categoria}
              onChange={(e) => alterar(i, e.target.value)}
              placeholder="Nome da categoria"
            />
            <button type="button" className="icon-btn subtle" aria-label={`Remover ${categoria}`} onClick={() => remover(i)}>
              <IconClose width={12} height={12} />
            </button>
          </div>
        ))}
        <button type="button" className="btn ghost block" onClick={() => onChange({ categorias: [...categorias, ""] })}>
          Adicionar categoria
        </button>
      </div>
    </div>
  );
}
