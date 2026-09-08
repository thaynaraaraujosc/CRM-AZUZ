"use client";

import type { CampoCondicao, DecisaoMultiplaData, OperadorCondicao } from "@/lib/automation-flow/types";
import { IconClose } from "@/components/icons";

/**
 * Configuração da decisão com vários caminhos.
 *
 * A tela faz UMA pergunta ("o que você quer verificar?") e depois lista as respostas possíveis.
 * É a diferença entre montar a decisão e programá-la: no bloco antigo a pessoa precisava pensar em
 * campo, operador e valor pra cada ramo, e encadear vários blocos de sim/não pra tratar um menu de
 * três opções.
 */
const CAMPOS: { valor: CampoCondicao; label: string; ajuda?: string }[] = [
  { valor: "mensagem", label: "A resposta do contato", ajuda: "O que ele acabou de escrever" },
  { valor: "origem", label: "A origem do lead" },
  { valor: "etapa", label: "A etapa atual no funil" },
  { valor: "responsavel", label: "O responsável pelo lead" },
  { valor: "etiqueta", label: "As etiquetas do contato" },
  { valor: "canal", label: "O canal da conversa" },
  { valor: "campo_personalizado", label: "Um campo personalizado" },
];

const OPERADORES: { valor: OperadorCondicao; label: string }[] = [
  { valor: "igual", label: "é exatamente" },
  { valor: "contem", label: "contém" },
];

export function DecisaoMultiplaForm({
  data,
  onChange,
  onRemoverCaminho,
}: {
  data: DecisaoMultiplaData;
  onChange: (data: Partial<DecisaoMultiplaData>) => void;
  /** Remove também a aresta ligada. Senão sobra um caminho apontando pra uma saída que sumiu. */
  onRemoverCaminho?: (caminhoId: string) => void;
}) {
  const caminhos = data.caminhos ?? [];

  function alterar(indice: number, patch: Partial<DecisaoMultiplaData["caminhos"][number]>) {
    onChange({ caminhos: caminhos.map((c, i) => (i === indice ? { ...c, ...patch } : c)) });
  }

  function adicionar() {
    onChange({
      caminhos: [
        ...caminhos,
        { id: `cam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, rotulo: "", valor: "" },
      ],
    });
  }

  function remover(indice: number) {
    const saindo = caminhos[indice];
    onChange({ caminhos: caminhos.filter((_, i) => i !== indice) });
    if (saindo) onRemoverCaminho?.(saindo.id);
  }

  return (
    <div className="flow-form">
      <div className="field">
        <label>O que você quer verificar?</label>
        <select
          className="input"
          value={data.campo}
          onChange={(e) => onChange({ campo: e.target.value as CampoCondicao })}
        >
          {CAMPOS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="hint">{CAMPOS.find((c) => c.valor === data.campo)?.ajuda ?? ""}</p>
      </div>

      {data.campo === "campo_personalizado" ? (
        <div className="field">
          <label>Nome do campo</label>
          <input
            className="input"
            value={data.campoPersonalizadoNome ?? ""}
            onChange={(e) => onChange({ campoPersonalizadoNome: e.target.value })}
            placeholder="cidade, plano, cnpj…"
          />
        </div>
      ) : null}

      <div className="field">
        <label>Comparação</label>
        <select
          className="input"
          value={data.operador ?? "igual"}
          onChange={(e) => onChange({ operador: e.target.value as OperadorCondicao })}
        >
          {OPERADORES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Caminhos</label>
        <p className="hint">
          Cada linha vira uma saída do bloco. O primeiro que bater ganha. Se dois valores se
          parecem (&quot;valor&quot; e &quot;valores&quot;), deixe o mais específico em cima.
        </p>

        {caminhos.map((caminho, i) => (
          <div key={caminho.id} className="flow-decisao-linha">
            <input
              className="input"
              value={caminho.valor}
              onChange={(e) => alterar(i, { valor: e.target.value })}
              placeholder="Valor (ex.: 1)"
              aria-label={`Valor do caminho ${i + 1}`}
            />
            <input
              className="input"
              value={caminho.rotulo}
              onChange={(e) => alterar(i, { rotulo: e.target.value })}
              placeholder="Nome no canvas (ex.: Quero atendimento)"
              aria-label={`Nome do caminho ${i + 1}`}
            />
            <button type="button" className="icon-btn subtle" aria-label={`Remover caminho ${i + 1}`} onClick={() => remover(i)}>
              <IconClose width={12} height={12} />
            </button>
          </div>
        ))}

        <button type="button" className="btn ghost block" onClick={adicionar}>
          Adicionar caminho
        </button>

        <p className="hint" style={{ marginTop: 8 }}>
          Existe sempre uma saída <strong>&quot;Qualquer outra&quot;</strong>, e ela não some: um
          valor que ninguém previu precisa ter pra onde ir, senão a automação para em silêncio no
          meio da conversa.
        </p>
      </div>
    </div>
  );
}
