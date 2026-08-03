"use client";

import { PERMISSOES_POR_MODULO } from "@/lib/configuracoes/permissoes";

/** Matriz de permissões por módulo (item 21/22) — reutilizada ao adicionar usuário e ao criar
 * função personalizada, pra não duplicar essa lista de checkboxes em dois lugares. */
export function MatrizPermissoes({
  selecionadas,
  onChange,
}: {
  selecionadas: string[];
  onChange: (novas: string[]) => void;
}) {
  const set = new Set(selecionadas);

  function alternar(id: string) {
    const novo = new Set(set);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    onChange([...novo]);
  }

  function todasDoModulo(modulo: (typeof PERMISSOES_POR_MODULO)[number]) {
    return modulo.permissoes.every((p) => set.has(p.id));
  }

  function alternarModulo(modulo: (typeof PERMISSOES_POR_MODULO)[number]) {
    const todas = todasDoModulo(modulo);
    const novo = new Set(set);
    modulo.permissoes.forEach((p) => (todas ? novo.delete(p.id) : novo.add(p.id)));
    onChange([...novo]);
  }

  return (
    <div className="config-permissoes">
      <div className="config-permissoes-acoes">
        <button type="button" className="btn ghost" onClick={() => onChange(PERMISSOES_POR_MODULO.flatMap((m) => m.permissoes.map((p) => p.id)))}>
          Selecionar tudo
        </button>
        <button type="button" className="btn ghost" onClick={() => onChange([])}>
          Remover tudo
        </button>
      </div>
      {PERMISSOES_POR_MODULO.map((modulo) => (
        <div className="config-permissoes-modulo" key={modulo.modulo}>
          <label className="config-permissoes-modulo-h">
            <input type="checkbox" checked={todasDoModulo(modulo)} onChange={() => alternarModulo(modulo)} />
            <strong>{modulo.modulo}</strong>
          </label>
          <div className="config-permissoes-itens">
            {modulo.permissoes.map((p) => (
              <label key={p.id} className="config-permissoes-item">
                <input type="checkbox" checked={set.has(p.id)} onChange={() => alternar(p.id)} />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
