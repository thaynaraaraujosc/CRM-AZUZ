"use client";

import { DIAS_SEMANA, type DiaSemana } from "@/lib/data";
import { useFunis } from "@/lib/funis-context";
import type { ConfiguracoesFluxo, FluxoAutomacao } from "@/lib/automation-flow/types";
import { SeletorDeData } from "@/components/seletor-de-data";
import { useIdioma } from "@/lib/idioma-context";
import { Ajuda } from "@/components/ui";

const LIMITES: { valor: NonNullable<ConfiguracoesFluxo["limiteExecucao"]>; label: string }[] = [
  { valor: "sempre", label: "Sempre que o gatilho acontecer"},
  { valor: "uma_vez_por_contato", label: "Uma vez por contato" },
  { valor: "uma_vez_por_entrada", label: "Uma vez por entrada na etapa" },
  { valor: "uma_vez_por_dia", label: "Uma vez por dia" },
  { valor: "uma_vez_por_semana", label: "Uma vez por semana" },
  { valor: "uma_vez_por_mes", label: "Uma vez por mês"},
  { valor: "no_maximo", label: "No máximo X vezes por contato"},
];

/**
 * O QUE FAZER QUANDO O CONTATO JÁ ESTÁ EM OUTRA AUTOMAÇÃO.
 *
 * As palavras dizem o efeito e não o conceito: "concorrência" é o nome da regra, mas o que a
 * pessoa precisa escolher é se o robô fala por cima dos outros, espera a vez ou toma a vez.
 */
const CONCORRENCIAS: { valor: NonNullable<ConfiguracoesFluxo["concorrencia"]>; label: string }[] = [
  { valor: "permitir", label: "Pode rodar junto com as outras" },
  { valor: "nao_iniciar", label: "Não começar enquanto houver outra rodando" },
  { valor: "encerrar_as_outras", label: "Encerrar as outras e começar esta" },
];

export function ConfiguracoesGeraisForm({
  fluxo,
  onChange,
  onChangeConfiguracoes,
}: {
  fluxo: FluxoAutomacao;
  onChange: (patch: Partial<Pick<FluxoAutomacao, "nome" | "descricao" | "funilId" | "etapaId" | "categoria">>) => void;
  onChangeConfiguracoes: (patch: Partial<ConfiguracoesFluxo>) => void;
}) {
  const { t: traduzir } = useIdioma();
  const { funis } = useFunis();
  const cfg = fluxo.configuracoes;
  const funilEscolhido = funis.find((f) => f.id === fluxo.funilId);

  function alternarDia(dia: DiaSemana) {
    const atuais = cfg.diasAtivos ?? [];
    const novo = atuais.includes(dia) ? atuais.filter((d) => d !== dia) : [...atuais, dia];
    onChangeConfiguracoes({ diasAtivos: novo });
  }

  return (
    <div className="flow-form">
      <div className="field">
        <label>{traduzir("Nome do fluxo")}</label>
        <input className="input" value={fluxo.nome} onChange={(e) => onChange({ nome: e.target.value })} />
      </div>
      <div className="field">
        <label>{traduzir("Descrição")}</label>
        <textarea
          className="input"
          style={{ width: "100%", minHeight: 60, resize: "vertical" }}
          value={fluxo.descricao ?? ""}
          onChange={(e) => onChange({ descricao: e.target.value })}
        />
      </div>
      <div className="field">
        <label>{traduzir("Funil relacionado")}</label>
        <select className="input" value={fluxo.funilId ?? ""} onChange={(e) => onChange({ funilId: e.target.value || undefined, etapaId: undefined })}>
          <option value="">{traduzir("Nenhum específico")}</option>
          {funis.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>
      {funilEscolhido ? (
        <div className="field">
          <label>{traduzir("Etapa relacionada")}</label>
          <select className="input" value={fluxo.etapaId ?? ""} onChange={(e) => onChange({ etapaId: e.target.value || undefined })}>
            <option value="">{traduzir("Qualquer etapa")}</option>
            {funilEscolhido.colunas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field">
        <label>{traduzir("Dias ativos")}</label>
        <div className="filters-row">
          {DIAS_SEMANA.map((d) => (
            <button
              key={d.valor}
              type="button"
              className={`fchip${(cfg.diasAtivos ?? []).includes(d.valor) ? " active" : ""}`}
              aria-pressed={(cfg.diasAtivos ?? []).includes(d.valor)}
              onClick={() => alternarDia(d.valor)}
            >
              {traduzir(d.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="toggle-row">
        <span className="tl">{traduzir("Restringir a um horário")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!cfg.usarHorario}
          aria-label={traduzir("Restringir a um horário")}
          className={`toggle${cfg.usarHorario ? " on" : ""}`}
          onClick={() => onChangeConfiguracoes({ usarHorario: !cfg.usarHorario })}
        >
          <span className="knob" />
        </button>
      </div>
      {cfg.usarHorario ? (
        <div className="field">
          <label>{traduzir("Janela de horário")}</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              type="time"
              style={{ flex: 1 }}
              value={cfg.horarioInicio ?? ""}
              onChange={(e) => onChangeConfiguracoes({ horarioInicio: e.target.value })}
            />
            <input
              className="input"
              type="time"
              style={{ flex: 1 }}
              value={cfg.horarioFim ?? ""}
              onChange={(e) => onChangeConfiguracoes({ horarioFim: e.target.value })}
            />
          </div>
        </div>
      ) : null}
      <div className="field">
        <label>{traduzir("Fuso horário")}</label>
        <input
          className="input"
          placeholder="America/Sao_Paulo"
          value={cfg.fusoHorario ?? ""}
          onChange={(e) => onChangeConfiguracoes({ fusoHorario: e.target.value })}
        />
      </div>
      <div className="field">
        <label>
          {traduzir("Quando o gatilho acontecer fora desse horário")}
          <Ajuda
            texto={
              cfg.foraDaJanela === "continuar"
                ? traduzir("A mensagem sai na hora, mesmo de madrugada.")
                : cfg.foraDaJanela === "encerrar" || cfg.foraDaJanela === "ignorar"
                  ? traduzir("O lead não entra na automação e nada é enviado depois.")
                  : traduzir("O lead fica esperando e a automação continua sozinha quando o horário abrir.")
            }
          />
        </label>
        <select
          className="input"
          value={cfg.foraDaJanela === "ignorar" ? "encerrar" : (cfg.foraDaJanela ?? "aguardar")}
          onChange={(e) => onChangeConfiguracoes({ foraDaJanela: e.target.value as ConfiguracoesFluxo["foraDaJanela"] })}
        >
          <option value="aguardar">{traduzir("Aguardar e continuar quando abrir")}</option>
          <option value="continuar">{traduzir("Continuar mesmo assim")}</option>
          <option value="encerrar">{traduzir("Encerrar a execução")}</option>
        </select>
      </div>

      <div className="field">
        <label>{traduzir("Data de início")}</label>
        <SeletorDeData valor={cfg.dataInicio ?? ""} onChange={(iso) => onChangeConfiguracoes({ dataInicio: iso })} />
      </div>
      <div className="field">
        <label>{traduzir("Data de fim")}</label>
        <SeletorDeData valor={cfg.dataFim ?? ""} onChange={(iso) => onChangeConfiguracoes({ dataFim: iso })} />
      </div>

      <div className="field">
        <label>{traduzir("Prioridade")}</label>
        <select className="input" value={cfg.prioridade ?? "normal"} onChange={(e) => onChangeConfiguracoes({ prioridade: e.target.value as ConfiguracoesFluxo["prioridade"] })}>
          <option value="baixa">{traduzir("Baixa")}</option>
          <option value="normal">{traduzir("Normal")}</option>
          <option value="alta">{traduzir("Alta")}</option>
        </select>
      </div>

      <div className="field">
        <label>
          {traduzir("Limite de execução")}
          <Ajuda
            texto={traduzir("A contagem usa o histórico de execuções, que só existe com as esperas de verdade ligadas.")}
          />
        </label>
        <select
          className="input"
          value={cfg.limiteExecucao ?? "sempre"}
          onChange={(e) => onChangeConfiguracoes({ limiteExecucao: e.target.value as ConfiguracoesFluxo["limiteExecucao"] })}
        >
          {LIMITES.map((l) => (
            <option key={l.valor} value={l.valor}>
              {traduzir(l.label)}
            </option>
          ))}
        </select>
      </div>

      {cfg.limiteExecucao === "no_maximo" ? (
        <div className="field">
          <label>{traduzir("Quantas vezes no máximo")}</label>
          <input
            className="input"
            type="number"
            min={1}
            value={cfg.maximoExecucoes ?? 1}
            onChange={(e) => onChangeConfiguracoes({ maximoExecucoes: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      ) : null}

      {/*
        OUTRAS AUTOMAÇÕES AO MESMO TEMPO.
        
        As duas chaves abaixo falam da MESMA automação. Esta fala das outras, que é onde o cliente
        sente: um comentário que casa com três robôs vira três mensagens em cima da outra, de três
        conversas que não sabem uma da outra.
      */}
      <div className="field">
        <label>
          {traduzir("Outras automações ao mesmo tempo")}
          <Ajuda
            texto={traduzir(
              "Vale entre automações DIFERENTES para o mesmo contato. Conta qualquer execução viva, inclusive a que está parada esperando uma resposta ou um prazo de dias. Quando duas automações do mesmo evento disputam, quem começa é a de maior Prioridade. O bloco \"Executar robô\" não é afetado: ali é o próprio fluxo chamando o próximo.",
            )}
          />
        </label>
        <select
          className="input"
          value={cfg.concorrencia ?? "permitir"}
          onChange={(e) =>
            onChangeConfiguracoes({ concorrencia: e.target.value as ConfiguracoesFluxo["concorrencia"] })
          }
        >
          {CONCORRENCIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {traduzir(c.label)}
            </option>
          ))}
        </select>
      </div>

      <div className="toggle-row">
        <span className="tl">{traduzir("Não iniciar se já estiver nesse fluxo")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!cfg.naoIniciarSeJaNoFluxo}
          aria-label={traduzir("Não iniciar se já estiver nesse fluxo")}
          className={`toggle${cfg.naoIniciarSeJaNoFluxo ? " on" : ""}`}
          onClick={() => onChangeConfiguracoes({ naoIniciarSeJaNoFluxo: !cfg.naoIniciarSeJaNoFluxo })}
        >
          <span className="knob" />
        </button>
      </div>
      <div className="toggle-row">
        <span className="tl">{traduzir("Cancelar execução anterior ao reiniciar")}</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!cfg.cancelarExecucaoAnterior}
          aria-label={traduzir("Cancelar execução anterior ao reiniciar")}
          className={`toggle${cfg.cancelarExecucaoAnterior ? " on" : ""}`}
          onClick={() => onChangeConfiguracoes({ cancelarExecucaoAnterior: !cfg.cancelarExecucaoAnterior })}
        >
          <span className="knob" />
        </button>
      </div>

      <div className="toggle-row">
        <span className="tl">
          {traduzir("Esperas e botões de verdade")}
          <Ajuda
            texto={traduzir(
              "Ligado (o normal), o fluxo guarda onde parou: a espera continua depois de horas ou dias, a resposta do contato retoma a conversa e a pergunta sai com as opções. Desligado, ele roda do jeito antigo: a pergunta vai só com o texto e qualquer espera encerra o fluxo. O que roda é sempre a última versão publicada, não o rascunho aberto aqui.",
            )}
          />
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={cfg.motorNovo !== false}
          aria-label={traduzir("Esperas e botões de verdade")}
          className={`toggle${cfg.motorNovo !== false ? " on" : ""}`}
          onClick={() => onChangeConfiguracoes({ motorNovo: cfg.motorNovo === false })}
        >
          <span className="knob" />
        </button>
      </div>
    </div>
  );
}
