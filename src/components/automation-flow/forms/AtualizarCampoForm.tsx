"use client";

import type { AtualizarCampoData } from "@/lib/automation-flow/types";
import { useConfiguracoes } from "@/lib/configuracoes-context";

/**
 * "Definir campo": qual campo do lead gravar e com que valor.
 *
 * Os campos vêm dos campos personalizados REAIS do workspace, não de uma lista fixa. Uma lista
 * fixa envelhece na primeira vez que o cliente cria um campo novo, e ele digitaria o nome à mão
 * torcendo pra bater com o do banco: erro de digitação vira automação que grava num campo que não
 * existe, sem avisar ninguém.
 *
 * Os campos nativos (origem, responsável, valor) entram junto porque são os mais usados e têm
 * bloco próprio, mas ninguém procura por "bloco de alterar responsável" quando está pensando em
 * "definir campo".
 */
const CAMPOS_NATIVOS = [
  { nome: "origem", label: "Origem" },
  { nome: "responsavel", label: "Responsável" },
  { nome: "empresa", label: "Empresa" },
  { nome: "cargo", label: "Cargo" },
  { nome: "cidade", label: "Cidade" },
  { nome: "estado", label: "Estado" },
  { nome: "email", label: "E-mail" },
];

export function AtualizarCampoForm({
  data,
  onChange,
}: {
  data: AtualizarCampoData;
  onChange: (data: AtualizarCampoData) => void;
}) {
  const { estado } = useConfiguracoes();
  // Só os campos do contato/lead: um campo de outro objeto não existe pra gravar aqui.
  const personalizados = (estado.camposPersonalizados ?? []).filter(
    (c) => !c.objeto || c.objeto === "contato" || c.objeto === "lead",
  );

  // O campo salvo pode não estar mais na lista (alguém apagou o campo personalizado). Aparece
  // assim mesmo, marcado: some da lista seria a automação passar a gravar em outro lugar sem
  // ninguém perceber.
  const sumiu =
    data.campoNome &&
    !personalizados.some((c) => c.nome === data.campoNome) &&
    !CAMPOS_NATIVOS.some((c) => c.nome === data.campoNome);

  return (
    <div className="flow-form">
      <div className="field">
        <label>Campo</label>
        <select
          className="input"
          value={data.campoNome ?? ""}
          onChange={(e) => onChange({ ...data, campoNome: e.target.value })}
        >
          <option value="">Escolha o campo</option>
          {sumiu ? <option value={data.campoNome}>{data.campoNome} (campo apagado)</option> : null}
          <optgroup label="Campos do lead">
            {CAMPOS_NATIVOS.map((c) => (
              <option key={c.nome} value={c.nome}>
                {c.label}
              </option>
            ))}
          </optgroup>
          {personalizados.length ? (
            <optgroup label="Campos personalizados">
              {personalizados.map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        {!personalizados.length ? (
          <p className="hint mt8">
            Nenhum campo personalizado criado ainda. Você cria em Configurações, e ele aparece aqui.
          </p>
        ) : null}
      </div>

      <div className="field">
        <label>Valor</label>
        <input
          className="input"
          value={data.valor ?? ""}
          onChange={(e) => onChange({ ...data, valor: e.target.value })}
          placeholder="Aceita variáveis, ex.: {primeiro_nome}"
        />
      </div>
    </div>
  );
}
