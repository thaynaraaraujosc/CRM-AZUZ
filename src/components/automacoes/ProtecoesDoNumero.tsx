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

/**
 * As horas que o seletor oferece, de meia em meia hora.
 *
 * Era um `<input type="time">`, e isso é pior do que parece num campo que quase sempre recebe uma
 * hora redonda: o controle nativo obriga a digitar hora e minuto separados, cada um com dois
 * dígitos, e no Safari ele nem abre lista — é só um campo com dois pares de números. Numa lista,
 * "das 5 às 23" é um clique de cada lado.
 *
 * Meia em meia hora e não de hora em hora: horário comercial de verdade tem 8:30 e 18:30.
 */
const HORARIOS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hora = String(Math.floor(i / 2)).padStart(2, "0");
  const minuto = i % 2 === 0 ? "00" : "30";
  return `${hora}:${minuto}`;
});

/** O valor guardado pode não estar na lista (veio de um campo livre antes desta tela existir).
 *  Ele entra como opção extra em vez de sumir — sumir trocaria silenciosamente o horário de alguém. */
function opcoesComOValorAtual(atual: string): string[] {
  return HORARIOS.includes(atual) ? HORARIOS : [atual, ...HORARIOS].filter(Boolean);
}

export function ProtecoesDoNumero() {
  const { t: traduzir } = useIdioma();
  const [config, setConfig] = useState<RespostaDoFlow | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** Os campos de número em edição: digitar "3" num campo que já tem "30" não pode salvar a cada
   *  tecla, nem mandar o valor pela metade. Os de horário salvam na hora — são uma escolha, não
   *  uma digitação. */
  const [tetos, setTetos] = useState<{ diario: string; porNumero: string; falhas: string } | null>(null);

  useEffect(() => {
    fetch("/api/integracoes/azuz-flow/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: RespostaDoFlow | null) => {
        if (!dados?.confirmacao) return;
        setConfig(dados);
        setTetos({
          diario: String(dados.confirmacao.tetoDiario),
          porNumero: String(dados.confirmacao.tetoPorNumero),
          falhas: String(dados.confirmacao.falhasParaPausar),
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

  if (!config || !tetos) return null;

  const janela = config.confirmacao.janela;
  const numero = (valor: string, padrao: number) => {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? n : padrao;
  };

  return (
    <section className="card prot-card">
      <header className="prot-topo">
        <p className="int-title">{traduzir("Proteções do número")}</p>
        <p className="hint">
          {traduzir("Valem para todos os formulários: é o número de WhatsApp que elas protegem.")}
        </p>
      </header>

      {/*
        O DISJUNTOR não é escolha da empresa: é o que está ACONTECENDO com o canal. Por isso aparece
        como aviso com um botão, e não como mais uma opção entre as outras.
      */}
      {config.disjuntor.pausadoEm ? (
        <div className="prot-disjuntor">
          <p>
            {traduzir("Envios pausados sozinhos depois de")} {config.disjuntor.falhasSeguidas}{" "}
            {traduzir("falhas seguidas.")}{" "}
            {config.disjuntor.ultimoMotivo ? traduzir(config.disjuntor.ultimoMotivo) : null}{" "}
            {traduzir("A fila está guardada e volta a sair quando você religar.")}
          </p>
          <button type="button" className="btn" disabled={salvando} onClick={() => void salvar({ religar: true })}>
            {salvando ? traduzir("Religando…") : traduzir("Religar")}
          </button>
        </div>
      ) : null}

      {/*
        AGRUPADO POR ASSUNTO, e não cinco campos numa fileira.
        
        Eram cinco caixas lado a lado com rótulos em maiúsculas — "DAS", "ÀS", "POR DIA", "POR
        NÚMERO", "FALHAS ATÉ PAUSAR" —, e lendo assim ninguém sabe que as duas primeiras são uma
        coisa só e as três seguintes são outra. Em duas linhas com o assunto escrito à esquerda, a
        frase se lê inteira: "só manda das 5 às 23" e "no máximo 30 por dia".
      */}
      <div className="prot-linha">
        <span className="prot-rotulo">{traduzir("Só manda")}</span>
        <div className="prot-campos">
          <label className="prot-campo">
            <span>{traduzir("das")}</span>
            <select
              className="input"
              value={janela.inicio}
              disabled={salvando}
              onChange={(e) => void salvar({ confirmacao: { janela: { inicio: e.target.value, fim: janela.fim } } })}
            >
              {opcoesComOValorAtual(janela.inicio).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <label className="prot-campo">
            <span>{traduzir("às")}</span>
            <select
              className="input"
              value={janela.fim}
              disabled={salvando}
              onChange={(e) => void salvar({ confirmacao: { janela: { inicio: janela.inicio, fim: e.target.value } } })}
            >
              {opcoesComOValorAtual(janela.fim).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <span className="prot-nota">{traduzir("horário de Brasília")}</span>
        </div>
      </div>

      <div className="prot-linha">
        <span className="prot-rotulo">{traduzir("No máximo")}</span>
        <div className="prot-campos">
          <label className="prot-campo">
            <input
              className="input prot-numero"
              type="number"
              min={1}
              max={500}
              value={tetos.diario}
              onChange={(e) => setTetos({ ...tetos, diario: e.target.value })}
              onBlur={() =>
                void salvar({ confirmacao: { tetoDiario: numero(tetos.diario, config.confirmacao.tetoDiario) } })
              }
            />
            <span>{traduzir("por dia")}</span>
          </label>
          <label className="prot-campo">
            <input
              className="input prot-numero"
              type="number"
              min={1}
              max={20}
              value={tetos.porNumero}
              onChange={(e) => setTetos({ ...tetos, porNumero: e.target.value })}
              onBlur={() =>
                void salvar({
                  confirmacao: { tetoPorNumero: numero(tetos.porNumero, config.confirmacao.tetoPorNumero) },
                })
              }
            />
            <span>{traduzir("para o mesmo número")}</span>
          </label>
          <label className="prot-campo">
            <span>{traduzir("pausa depois de")}</span>
            <input
              className="input prot-numero"
              type="number"
              min={1}
              max={50}
              value={tetos.falhas}
              onChange={(e) => setTetos({ ...tetos, falhas: e.target.value })}
              onBlur={() =>
                void salvar({
                  confirmacao: { falhasParaPausar: numero(tetos.falhas, config.confirmacao.falhasParaPausar) },
                })
              }
            />
            <span>{traduzir("falhas seguidas")}</span>
          </label>
        </div>
      </div>

      {/*
        PAUSAR É DIFERENTE DE DESLIGAR, e por isso continua existindo mesmo com a confirmação agora
        sendo por formulário: desligar é "não quero isso"; pausar é "pare AGORA e me deixe pensar",
        sem perder o que foi escrito em formulário nenhum.
      */}
      <div className="prot-linha prot-pausa">
        <span className="prot-rotulo">{traduzir("Pausar envios")}</span>
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
