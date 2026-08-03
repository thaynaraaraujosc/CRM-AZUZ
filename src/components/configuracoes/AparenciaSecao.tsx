"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { useConfiguracoes, type DensidadeAparencia, type MenuLateralModo, type TamanhoAparencia } from "@/lib/configuracoes-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

const DENSIDADES: { valor: DensidadeAparencia; label: string }[] = [
  { valor: "compacta", label: "Compacta" },
  { valor: "confortavel", label: "Confortável" },
  { valor: "espacosa", label: "Espaçosa" },
];
const TAMANHOS: { valor: TamanhoAparencia; label: string }[] = [
  { valor: "pequeno", label: "Pequeno" },
  { valor: "padrao", label: "Padrão" },
  { valor: "grande", label: "Grande" },
];
const MENUS: { valor: MenuLateralModo; label: string }[] = [
  { valor: "expandido", label: "Sempre expandido" },
  { valor: "recolhido", label: "Sempre recolhido" },
  { valor: "automatico", label: "Automático" },
];

/**
 * Aparência (item 36) — tema real (liga em `ThemeToggle`, já funcional); densidade/tamanho/menu
 * lateral ficam salvos aqui e têm uma prévia local nesta fase — a aplicação de fato no resto do CRM
 * é trabalho da Etapa 2 (modernização visual), que vem depois da Etapa 1 estar pronta e revisada.
 */
export function AparenciaSecao() {
  const { estado, atualizarAparencia } = useConfiguracoes();
  const { aparencia } = estado;

  const escalaTamanho = aparencia.tamanho === "pequeno" ? 0.9 : aparencia.tamanho === "grande" ? 1.15 : 1;
  const espacamentoDensidade = aparencia.densidade === "compacta" ? 6 : aparencia.densidade === "espacosa" ? 16 : 10;

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Aparência" descricao="Tema, densidade e tamanho da interface." />

      <div className="config-bloco">
        <p className="config-bloco-titulo">Tema</p>
        <ThemeToggle />
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Densidade</p>
        <div className="filters-row">
          {DENSIDADES.map((d) => (
            <button
              type="button"
              key={d.valor}
              className={`fchip${aparencia.densidade === d.valor ? " active" : ""}`}
              onClick={() => atualizarAparencia({ densidade: d.valor })}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Tamanho</p>
        <div className="filters-row">
          {TAMANHOS.map((t) => (
            <button
              type="button"
              key={t.valor}
              className={`fchip${aparencia.tamanho === t.valor ? " active" : ""}`}
              onClick={() => atualizarAparencia({ tamanho: t.valor })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Menu lateral</p>
        <div className="filters-row">
          {MENUS.map((m) => (
            <button
              type="button"
              key={m.valor}
              className={`fchip${aparencia.menuLateral === m.valor ? " active" : ""}`}
              onClick={() => atualizarAparencia({ menuLateral: m.valor })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="config-bloco">
        <p className="config-bloco-titulo">Prévia</p>
        <p className="hint mb14">A aplicação completa dessas prévias no restante do CRM acontece na modernização visual, depois da Central do Dia e Configurações estarem prontas.</p>
        <div className="config-aparencia-preview" style={{ fontSize: `${13 * escalaTamanho}px`, gap: espacamentoDensidade }}>
          <div className="config-aparencia-preview-linha" style={{ padding: espacamentoDensidade }}>
            Card de exemplo
          </div>
          <div className="config-aparencia-preview-linha" style={{ padding: espacamentoDensidade }}>
            Outro item da lista
          </div>
        </div>
      </div>
    </div>
  );
}
