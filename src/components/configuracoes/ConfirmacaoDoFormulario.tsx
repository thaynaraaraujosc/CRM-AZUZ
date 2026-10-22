"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { Toggle } from "@/components/ui";
import { useIdioma } from "@/lib/idioma-context";
import { lerJson } from "@/lib/ler-resposta";

/**
 * A confirmação de reunião do FORMULÁRIO DO CRM.
 *
 * Cartão próprio, e não mais um pedaço do cartão do AZUZ Flow: nem todo cliente usa o Flow, e lá a
 * opção só aparece com uma chave de integração ativa. Pra quem usa só o formulário do CRM, ela
 * ficaria invisível.
 *
 * O TEXTO é separado por origem (foi a escolha da agência: cada uma fala com as palavras dela). As
 * PROTEÇÕES não são: janela de horário, tetos, pausa e disjuntor estão no cartão do Flow e valem
 * para as duas, porque protegem o NÚMERO da agência e não a origem do lead.
 */

type Config = {
  formulario: { confirmacao: { ativa: boolean; texto: string } };
};

/** As mesmas variáveis da outra, menos o link: o formulário do CRM não tem link de reunião. */
const VARIAVEIS: [string, string][] = [
  ["{{primeiroNome}}", "o primeiro nome de quem preencheu"],
  ["{{data}}", "a data por extenso"],
  ["{{dataCurta}}", "a data em números"],
  ["{{hora}}", "a hora em Brasília"],
  ["{{empresa}}", "o nome da sua empresa"],
];

export function ConfirmacaoDoFormulario() {
  const { t: traduzir } = useIdioma();
  const { data: sessao } = useSession();
  const ehAdmin = sessao?.user?.papelTipo === "admin" || Boolean(sessao?.user?.superAdmin);

  const [config, setConfig] = useState<Config | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!ehAdmin) return;
    void (async () => {
      const r = await fetch("/api/integracoes/azuz-flow/config").catch(() => null);
      if (!r?.ok) return;
      const lido = await lerJson<Config>(r, "");
      if (lido.ok) {
        setConfig(lido.dados);
        setTexto(lido.dados.formulario.confirmacao.texto);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehAdmin]);

  if (!ehAdmin || !config) return null;

  async function salvar(mudanca: { ativa?: boolean; texto?: string }) {
    setSalvando(true);
    setErro(null);
    const r = await fetch("/api/integracoes/azuz-flow/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ formulario: { confirmacao: mudanca } }),
    }).catch(() => null);
    const lido = r ? await lerJson<Config>(r, traduzir("Não deu pra salvar.")) : { ok: false as const, erro: traduzir("Não deu pra salvar.") };
    if (lido.ok) {
      setConfig(lido.dados);
      setTexto(lido.dados.formulario.confirmacao.texto);
    } else setErro(lido.erro);
    setSalvando(false);
  }

  /** Põe a variável onde o cursor estava, como no cartão do Flow. */
  function inserir(chave: string) {
    const atual = texto ?? "";
    const campo = area.current;
    const inicio = campo?.selectionStart ?? atual.length;
    const fim = campo?.selectionEnd ?? inicio;
    const novo = atual.slice(0, inicio) + chave + atual.slice(fim);
    if (novo.length > 2000) return;
    setTexto(novo);
    if (!campo) return;
    requestAnimationFrame(() => {
      campo.focus();
      const posicao = inicio + chave.length;
      campo.setSelectionRange(posicao, posicao);
    });
  }

  const ativa = config.formulario.confirmacao.ativa;

  return (
    <div className="config-bloco">
      <p className="config-bloco-titulo">{traduzir("Formulário do CRM")}</p>

      <div className="flow-cartao">
        <div className="flow-interruptor">
          <div className="flow-rotulo">
            {traduzir("Confirmação de reunião")}
            <span className={`badge ${ativa ? "badge-success" : "badge-neutral"}`}>
              {traduzir(ativa ? "Ligada" : "Desligada")}
            </span>
          </div>
          <Toggle
            label={traduzir("Confirmação de reunião do formulário")}
            defaultOn={ativa}
            onToggle={(ligado) => void salvar({ ativa: ligado })}
          />
        </div>

        <div className="flow-bloco">
          <p className="flow-bloco-titulo">{traduzir("Mensagem")}</p>
          <textarea
            ref={area}
            className="input flow-area"
            value={texto ?? ""}
            maxLength={2000}
            onChange={(e) => setTexto(e.target.value)}
          />
          <span className="flow-contagem">{(texto ?? "").length}/2000</span>

          <div className="flow-vars">
            {VARIAVEIS.map(([chave, explicacao]) => (
              <button
                key={chave}
                type="button"
                className="flow-var"
                title={traduzir("Clique para inserir no texto")}
                onClick={() => inserir(chave)}
              >
                <code>{chave}</code>
                <span>{traduzir(explicacao)}</span>
              </button>
            ))}
          </div>

          {texto !== config.formulario.confirmacao.texto ? (
            <div className="flow-salvar">
              <button type="button" className="btn primary" disabled={salvando} onClick={() => void salvar({ texto: texto ?? "" })}>
                {salvando ? traduzir("Salvando…") : traduzir("Salvar texto")}
              </button>
              <span className="hint">{traduzir("Alterações não salvas.")}</span>
            </div>
          ) : null}
        </div>
      </div>

      <p className="hint">
        {traduzir(
          "Sai quando o formulário tem um campo \"Agendar reunião\" preenchido e uma pergunta marcada como consentimento de WhatsApp. As proteções do número (horário, limites, pausa) são as mesmas do cartão do AZUZ Flow.",
        )}
      </p>

      {erro ? (
        <p className="hint" style={{ color: "var(--danger)" }} role="alert">
          {traduzir(erro)}
        </p>
      ) : null}
    </div>
  );
}
