"use client";

import { useState } from "react";

import { GRUPOS_CONFIGURACOES, type CategoriaId } from "@/lib/configuracoes/estrutura";

/** Coluna esquerda: busca + categorias agrupadas (itens 18/42). A busca filtra por nome/descrição da
 * categoria — resultado simples, mas real (não é só um placeholder decorativo). */
export function CategoriasNav({
  ativa,
  onSelecionar,
}: {
  ativa: CategoriaId;
  onSelecionar: (id: CategoriaId) => void;
}) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();

  return (
    <nav className="config-nav" aria-label="Categorias de configuração">
      <input
        className="input config-nav-busca"
        placeholder="Buscar configuração…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar configuração"
      />
      {GRUPOS_CONFIGURACOES.map((grupo) => {
        const categoriasFiltradas = termo
          ? grupo.categorias.filter(
              (c) => c.label.toLowerCase().includes(termo) || c.descricao.toLowerCase().includes(termo),
            )
          : grupo.categorias;
        if (categoriasFiltradas.length === 0) return null;
        return (
          <div className="config-nav-grupo" key={grupo.titulo}>
            <p className="config-nav-grupo-h">{grupo.titulo}</p>
            {categoriasFiltradas.map((cat) => (
              <button
                type="button"
                key={cat.id}
                className={`config-nav-item${ativa === cat.id ? " active" : ""}`}
                onClick={() => onSelecionar(cat.id)}
                aria-pressed={ativa === cat.id}
              >
                <cat.Icon width={16} height={16} aria-hidden="true" />
                <span>{cat.label}</span>
                {cat.emBreve ? <span className="nav-badge-em-breve" style={{ marginLeft: "auto" }}>Em breve</span> : null}
              </button>
            ))}
          </div>
        );
      })}
      {termo && GRUPOS_CONFIGURACOES.every((g) => g.categorias.every((c) => !c.label.toLowerCase().includes(termo) && !c.descricao.toLowerCase().includes(termo))) ? (
        <p className="hint" style={{ padding: "8px 10px" }}>
          Nenhuma configuração encontrada pra &quot;{busca}&quot;.
        </p>
      ) : null}
    </nav>
  );
}
