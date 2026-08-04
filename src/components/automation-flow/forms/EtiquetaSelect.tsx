"use client";

import { useMemo, useState } from "react";

import { useConfiguracoes } from "@/lib/configuracoes-context";
import { contatos, funis } from "@/lib/data";

/**
 * Lista de etiquetas pra escolher num bloco de automação — junta as etiquetas já em uso em
 * contatos/negócios com as criadas em Configurações > Etiquetas (mesma fonte que `EtiquetasSecao`),
 * sem duplicar. "+ Criar nova etiqueta" grava em `configuracoes-context` (front-end apenas, sem
 * backend) — assim a etiqueta criada aqui também aparece em Configurações e em outros blocos.
 */
function useEtiquetasDisponiveis(): string[] {
  const { estado } = useConfiguracoes();
  return useMemo(() => {
    const nomes = new Set<string>();
    contatos.forEach((c) => c.etiquetas?.forEach((e) => nomes.add(e)));
    funis.forEach((f) => f.colunas.forEach((col) => col.cards.forEach((card) => card.etiquetas?.forEach((e) => nomes.add(e)))));
    estado.etiquetasPersonalizadas.forEach((e) => nomes.add(e.nome));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [estado.etiquetasPersonalizadas]);
}

export function EtiquetaSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (nome: string) => void;
}) {
  const { adicionarEtiqueta } = useConfiguracoes();
  const etiquetas = useEtiquetasDisponiveis();
  const [criandoNova, setCriandoNova] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");

  function confirmarNovaEtiqueta() {
    const nome = nomeNovo.trim();
    if (!nome) return;
    if (!etiquetas.includes(nome)) {
      adicionarEtiqueta({ nome, cor: "#2e6bff" });
    }
    onChange(nome);
    setNomeNovo("");
    setCriandoNova(false);
  }

  return (
    <div className="field">
      <label>{label}</label>
      {criandoNova ? (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Nome da nova etiqueta"
            autoFocus
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmarNovaEtiqueta();
              }
              if (e.key === "Escape") setCriandoNova(false);
            }}
          />
          <button type="button" className="btn primary" onClick={confirmarNovaEtiqueta}>
            Criar
          </button>
          <button type="button" className="btn ghost" onClick={() => setCriandoNova(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <>
          <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Selecione uma etiqueta…</option>
            {etiquetas.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="link"
            style={{ marginTop: 6 }}
            onClick={() => setCriandoNova(true)}
          >
            + Criar nova etiqueta
          </button>
        </>
      )}
    </div>
  );
}
