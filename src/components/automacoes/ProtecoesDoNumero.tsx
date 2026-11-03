"use client";

import { useEffect, useState } from "react";

import { Toggle } from "@/components/ui";
import type { RespostaDoFlow } from "@/lib/integracoes/azuz-flow-resposta";
import { useIdioma } from "@/lib/idioma-context";

/**
 * AS PROTEÇÕES DO NÚMERO: horário, tetos, pausa e o religar do disjuntor.
 *
 * Vieram de Configurações junto com a confirmação de reunião, e param AQUI e não dentro de cada
 * formulário. Elas protegem o NÚMERO, não o formulário: uma por formulário protegeria pela metade —
 * cinco formulários com teto de 30 seriam 150 primeiras mensagens saindo do mesmo WhatsApp no mesmo
 * dia, que é exatamente o que derruba um número por denúncia.
 *
 * Por isso o cartão fica em cima, uma vez só, dizendo com todas as letras que vale para todos.
 */
export function ProtecoesDoNumero() {
  const { t: traduzir } = useIdioma();
  const [config, setConfig] = useState<RespostaDoFlow | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O rascunho dos campos de número: digitar "3" num campo que já tem "30" não pode salvar a cada
  // tecla, nem mandar o valor pela metade.
  const [rascunho, setRascunho] = useState<{
    inicio: string;
    fim: string;
    tetoDiario: string;
    tetoPorNumero: string;
    falhasParaPausar: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/integracoes/azuz-flow/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: RespostaDoFlow | null) => {
        if (!dados?.confirmacao) return;
        setConfig(dados);
        setRascunho({
          inicio: dados.confirmacao.janela.inicio,
          fim: dados.confirmacao.janela.fim,
          tetoDiario: String(dados.confirmacao.tetoDiario),
          tetoPorNumero: String(dados.confirmacao.tetoPorNumero),
          falhasParaPausar: String(dados.confirmacao.falhasParaPausar),
        });
      })
      .catch(() => setErro(traduzir("Não deu pra ler as proteções agora.")));
  }, [traduzir]);

  async function salvar(mudancas: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/integracoes/azuz-flow/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mudancas),
      });
      const corpo = (await resposta.json().catch(() => null)) as (RespostaDoFlow & { erro?: string }) | null;
      if (!resposta.ok) throw new Error(corpo?.erro ?? traduzir("Não deu pra salvar."));
      if (corpo?.confirmacao) setConfig(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : traduzir("Não deu pra salvar."));
    } finally {
      setSalvando(false);
    }
  }

  if (!config || !rascunho) return null;

  const numero = (valor: string, padrao: number) => {
    const n = Number(valor);
    return Number.isFinite(n) ? n : padrao;
  };

  return (
    <section className="card">
      <p className="int-title">{traduzir("Proteções do número")}</p>
      <p className="hint">
        {traduzir(
          "Valem para TODOS os formulários: é o número de WhatsApp que elas protegem, não o formulário. Uma regra por formulário protegeria pela metade.",
        )}
      </p>

      {/*
        O DISJUNTOR não é escolha da empresa: é o que está acontecendo com o canal. Por isso
        aparece como aviso com um botão, e não como mais uma opção entre as outras.
      */}
      {config.disjuntor.pausadoEm ? (
        <div className="int-aviso-conflito">
          <p>
            {traduzir("Envios pausados sozinhos depois de")}{" "}
            {config.disjuntor.falhasSeguidas} {traduzir("falhas seguidas.")}{" "}
            {config.disjuntor.ultimoMotivo ? traduzir(config.disjuntor.ultimoMotivo) : null}{" "}
            {traduzir("A fila está guardada e volta a sair quando você religar.")}
          </p>
          <button type="button" className="btn" disabled={salvando} onClick={() => void salvar({ religar: true })}>
            {salvando ? traduzir("Religando…") : traduzir("Religar")}
          </button>
        </div>
      ) : null}

      <div className="prot-grade">
        <label>
          <span className="lbl-pequeno">{traduzir("Das")}</span>
          <input
            className="input"
            type="time"
            value={rascunho.inicio}
            onChange={(e) => setRascunho({ ...rascunho, inicio: e.target.value })}
            onBlur={() => void salvar({ confirmacao: { janela: { inicio: rascunho.inicio, fim: rascunho.fim } } })}
          />
        </label>
        <label>
          <span className="lbl-pequeno">{traduzir("Às")}</span>
          <input
            className="input"
            type="time"
            value={rascunho.fim}
            onChange={(e) => setRascunho({ ...rascunho, fim: e.target.value })}
            onBlur={() => void salvar({ confirmacao: { janela: { inicio: rascunho.inicio, fim: rascunho.fim } } })}
          />
        </label>
        <label>
          <span className="lbl-pequeno">{traduzir("Por dia")}</span>
          <input
            className="input"
            type="number"
            min={1}
            max={500}
            value={rascunho.tetoDiario}
            onChange={(e) => setRascunho({ ...rascunho, tetoDiario: e.target.value })}
            onBlur={() =>
              void salvar({ confirmacao: { tetoDiario: numero(rascunho.tetoDiario, config.confirmacao.tetoDiario) } })
            }
          />
        </label>
        <label>
          <span className="lbl-pequeno">{traduzir("Por número")}</span>
          <input
            className="input"
            type="number"
            min={1}
            max={20}
            value={rascunho.tetoPorNumero}
            onChange={(e) => setRascunho({ ...rascunho, tetoPorNumero: e.target.value })}
            onBlur={() =>
              void salvar({
                confirmacao: { tetoPorNumero: numero(rascunho.tetoPorNumero, config.confirmacao.tetoPorNumero) },
              })
            }
          />
        </label>
        <label>
          <span className="lbl-pequeno">{traduzir("Falhas até pausar")}</span>
          <input
            className="input"
            type="number"
            min={1}
            max={50}
            value={rascunho.falhasParaPausar}
            onChange={(e) => setRascunho({ ...rascunho, falhasParaPausar: e.target.value })}
            onBlur={() =>
              void salvar({
                confirmacao: {
                  falhasParaPausar: numero(rascunho.falhasParaPausar, config.confirmacao.falhasParaPausar),
                },
              })
            }
          />
        </label>
      </div>

      {/*
        PAUSAR É DIFERENTE DE DESLIGAR, e por isso continua existindo mesmo com a confirmação
        agora sendo por formulário: desligar é "não quero isso"; pausar é "pare AGORA e me deixe
        pensar", sem perder nada do que foi escrito em formulário nenhum.
      */}
      <div className="toggle-row">
        <span className="tl">{traduzir("Pausar envios")}</span>
        <Toggle
          defaultOn={config.confirmacao.pausada}
          label={traduzir("Pausar envios")}
          onToggle={(ligado) => void salvar({ confirmacao: { pausada: ligado } })}
        />
      </div>

      {erro ? <p className="int-aviso-conflito">{erro}</p> : null}
    </section>
  );
}
