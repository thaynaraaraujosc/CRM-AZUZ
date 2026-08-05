"use client";

import { useEffect, useState } from "react";

import { Toggle } from "@/components/ui";
import { useConfiguracoes, type AzuzIaConfig } from "@/lib/configuracoes-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { SalvarBar } from "./SalvarBar";

type Aba = "comportamento" | "dados" | "sugestoes" | "respostas" | "privacidade";
const ABAS: { id: Aba; label: string }[] = [
  { id: "comportamento", label: "Comportamento" },
  { id: "dados", label: "Dados permitidos" },
  { id: "sugestoes", label: "Sugestões" },
  { id: "respostas", label: "Respostas" },
  { id: "privacidade", label: "Privacidade" },
];

const TONS: { valor: AzuzIaConfig["tom"]; label: string }[] = [
  { valor: "direto", label: "Direto" },
  { valor: "consultivo", label: "Consultivo" },
  { valor: "amigavel", label: "Amigável" },
  { valor: "formal", label: "Formal" },
  { valor: "personalizado", label: "Personalizado" },
];
const DETALHAMENTOS: { valor: AzuzIaConfig["detalhamento"]; label: string }[] = [
  { valor: "resumido", label: "Resumido" },
  { valor: "equilibrado", label: "Equilibrado" },
  { valor: "detalhado", label: "Detalhado" },
];
const DADOS_OPCOES = ["contatos", "conversas", "funis", "tarefas", "relatórios", "campanhas", "documentos"];
const SUGESTOES_OPCOES = ["follow-ups", "tarefas", "automações", "mensagens", "mudanças de etapa", "responsáveis", "análises"];

/** Azuz IA (item 33) — tela de preferências (persistidas de verdade via `Preferencia`); alimenta o
 * prompt que `/api/azuz-ia/perguntar` monta a cada pergunta no chat de `/azuz-ia`. */
export function AzuzIaSecao() {
  const { estado, atualizarAzuzIa, setCategoriaSuja } = useConfiguracoes();
  const [aba, setAba] = useState<Aba>("comportamento");
  const [rascunho, setRascunho] = useState<AzuzIaConfig>(estado.azuzIa);
  const dirty = JSON.stringify(rascunho) !== JSON.stringify(estado.azuzIa);

  useEffect(() => {
    setCategoriaSuja(dirty);
    return () => setCategoriaSuja(false);
  }, [dirty, setCategoriaSuja]);

  function set(patch: Partial<AzuzIaConfig>) {
    setRascunho((prev) => ({ ...prev, ...patch }));
  }
  function alternarLista(chave: "dadosPermitidos" | "sugestoesTipos", valor: string) {
    const atual = rascunho[chave];
    set({ [chave]: atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor] });
  }

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Azuz IA" descricao="Comportamento, dados permitidos, sugestões e privacidade." />
      <div className="config-abas">
        {ABAS.map((a) => (
          <button type="button" key={a.id} className={aba === a.id ? "on" : ""} onClick={() => setAba(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "comportamento" ? (
        <div className="config-bloco">
          <div className="field">
            <label>Tom</label>
            <div className="filters-row">
              {TONS.map((t) => (
                <button type="button" key={t.valor} className={`fchip${rascunho.tom === t.valor ? " active" : ""}`} onClick={() => set({ tom: t.valor })}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Detalhamento</label>
            <div className="filters-row">
              {DETALHAMENTOS.map((d) => (
                <button type="button" key={d.valor} className={`fchip${rascunho.detalhamento === d.valor ? " active" : ""}`} onClick={() => set({ detalhamento: d.valor })}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="toggle-row" style={{ padding: "10px 0" }}>
            <span className="tl">Sugestões proativas</span>
            <Toggle defaultOn={rascunho.sugestoesProativas} label="Sugestões proativas" onToggle={(v) => set({ sugestoesProativas: v })} />
          </div>
        </div>
      ) : null}

      {aba === "dados" ? (
        <div className="config-bloco">
          <p className="hint mb14">O que a Azuz IA pode ler pra gerar sugestões.</p>
          {DADOS_OPCOES.map((d) => (
            <label key={d} className="config-permissoes-item" style={{ display: "flex", padding: "6px 0" }}>
              <input type="checkbox" checked={rascunho.dadosPermitidos.includes(d)} onChange={() => alternarLista("dadosPermitidos", d)} />
              {d}
            </label>
          ))}
        </div>
      ) : null}

      {aba === "sugestoes" ? (
        <div className="config-bloco">
          {SUGESTOES_OPCOES.map((s) => (
            <label key={s} className="config-permissoes-item" style={{ display: "flex", padding: "6px 0" }}>
              <input type="checkbox" checked={rascunho.sugestoesTipos.includes(s)} onChange={() => alternarLista("sugestoesTipos", s)} />
              {s}
            </label>
          ))}
        </div>
      ) : null}

      {aba === "respostas" ? (
        <div className="config-bloco">
          <div className="field">
            <label>Como a Azuz IA deve se comportar neste workspace?</label>
            <textarea
              className="input"
              style={{ width: "100%", minHeight: 90 }}
              placeholder="Ex.: seja objetiva, sempre sugira o próximo passo comercial, use o nome do contato."
              value={rascunho.comportamentoPersonalizado}
              onChange={(e) => set({ comportamentoPersonalizado: e.target.value })}
            />
          </div>
          <div className="config-email-preview">
            <p className="r">Prévia:</p>
            <pre>
              Tom {TONS.find((t) => t.valor === rascunho.tom)?.label.toLowerCase()}, respostas {DETALHAMENTOS.find((d) => d.valor === rascunho.detalhamento)?.label.toLowerCase()}.
              {rascunho.comportamentoPersonalizado ? `\n${rascunho.comportamentoPersonalizado}` : ""}
            </pre>
          </div>
        </div>
      ) : null}

      {aba === "privacidade" ? (
        <div className="config-bloco">
          <p className="hint">
            Os dados marcados em &quot;Dados permitidos&quot; são enviados à Anthropic (Claude) só no
            momento em que você faz uma pergunta, pra gerar a resposta — nenhum dado fica armazenado
            do lado deles. Categorias desmarcadas nunca saem do workspace.
          </p>
        </div>
      ) : null}

      <SalvarBar dirty={dirty} onSalvar={() => atualizarAzuzIa(rascunho)} onDescartar={() => setRascunho(estado.azuzIa)} mensagemSalvo="Preferências da Azuz IA atualizadas." />
    </div>
  );
}
