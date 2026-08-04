"use client";

import { useEffect, useState } from "react";

import { Toggle } from "@/components/ui";
import { useConfiguracoes, type AutomacoesPrefsConfig } from "@/lib/configuracoes-context";
import { equipe, funis } from "@/lib/data";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { SalvarBar } from "./SalvarBar";

/** Preferências gerais de Automações (item 32) — front-end apenas; essas opções não mudam o
 * comportamento real do construtor nesta fase, só ficam salvas pra quando ligar de verdade. */
export function AutomacoesPrefsSecao() {
  const { estado, atualizarAutomacoesPrefs, setCategoriaSuja } = useConfiguracoes();
  const [rascunho, setRascunho] = useState<AutomacoesPrefsConfig>(estado.automacoesPrefs);
  const dirty = JSON.stringify(rascunho) !== JSON.stringify(estado.automacoesPrefs);

  useEffect(() => {
    setCategoriaSuja(dirty);
    return () => setCategoriaSuja(false);
  }, [dirty, setCategoriaSuja]);

  function set(patch: Partial<AutomacoesPrefsConfig>) {
    setRascunho((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Automações" descricao="Preferências gerais do construtor de automações." />

      <div className="config-bloco">
        {[
          { chave: "permitirAtivacaoSemTeste" as const, label: "Permitir ativação sem teste" },
          { chave: "exigirValidacaoAntesAtivar" as const, label: "Exigir validação antes de ativar" },
          { chave: "registrarHistorico" as const, label: "Registrar histórico" },
          { chave: "pausarEmErro" as const, label: "Pausar em caso de erro" },
          { chave: "impedirDuplicadas" as const, label: "Impedir mensagens duplicadas" },
          { chave: "explicacoesAutomaticas" as const, label: "Explicações automáticas no construtor" },
        ].map((item) => (
          <div className="toggle-row" key={item.chave} style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
            <span className="tl">{item.label}</span>
            <Toggle defaultOn={rascunho[item.chave]} label={item.label} onToggle={(v) => set({ [item.chave]: v })} />
          </div>
        ))}
      </div>

      <div className="config-bloco">
        <div className="config-grid-2">
          <div className="field">
            <label>Horário permitido — início</label>
            <input className="input" type="time" value={rascunho.horarioInicio} onChange={(e) => set({ horarioInicio: e.target.value })} />
          </div>
          <div className="field">
            <label>Horário permitido — fim</label>
            <input className="input" type="time" value={rascunho.horarioFim} onChange={(e) => set({ horarioFim: e.target.value })} />
          </div>
          <div className="field">
            <label>Limite de ações (mockado)</label>
            <input className="input" type="number" value={rascunho.limiteAcoes} onChange={(e) => set({ limiteAcoes: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Responsável padrão</label>
            <select className="input" value={rascunho.responsavelPadrao} onChange={(e) => set({ responsavelPadrao: e.target.value })}>
              {equipe.map((m) => (
                <option key={m.nome}>{m.nome}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Funil padrão</label>
            <select className="input" value={rascunho.funilPadrao} onChange={(e) => set({ funilPadrao: e.target.value })}>
              {funis.map((f) => (
                <option key={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Ao excluir etapa usada por uma automação</label>
            <select
              className="input"
              value={rascunho.comportamentoEtapaRemovida}
              onChange={(e) => set({ comportamentoEtapaRemovida: e.target.value as AutomacoesPrefsConfig["comportamentoEtapaRemovida"] })}
            >
              <option value="mover_padrao">Mover pra etapa padrão</option>
              <option value="pausar_automacao">Pausar a automação</option>
            </select>
          </div>
        </div>
      </div>

      <div className="config-bloco">
        <div className="config-grid-2">
          <div className="field">
            <label>Modo de construção</label>
            <select className="input" value={rascunho.modoConstrucao} onChange={(e) => set({ modoConstrucao: e.target.value as AutomacoesPrefsConfig["modoConstrucao"] })}>
              <option value="guiado">Guiado</option>
              <option value="avancado">Avançado</option>
              <option value="lembrar">Lembrar última escolha</option>
            </select>
          </div>
          <div className="field">
            <label>Mostrar resumo do fluxo</label>
            <select className="input" value={rascunho.mostrarResumo} onChange={(e) => set({ mostrarResumo: e.target.value as AutomacoesPrefsConfig["mostrarResumo"] })}>
              <option value="sempre">Sempre</option>
              <option value="ao_testar">Apenas ao testar</option>
              <option value="nunca">Nunca</option>
            </select>
          </div>
        </div>
      </div>

      <SalvarBar dirty={dirty} onSalvar={() => atualizarAutomacoesPrefs(rascunho)} onDescartar={() => setRascunho(estado.automacoesPrefs)} mensagemSalvo="Preferências de automações atualizadas." />
    </div>
  );
}
