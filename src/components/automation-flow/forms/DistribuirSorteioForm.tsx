"use client";

import { IconLixeira } from "@/components/icons";
import type { DistribuirSorteioData, OpcaoDistribuicao } from "@/lib/automation-flow/types";
import { useIdioma } from "@/lib/idioma-context";

/**
 * O BLOCO DISTRIBUIR: quanto de cada lado.
 *
 * O selo da soma fica no topo e muda de cor: verde em 100%, alerta fora disso. É a única coisa que
 * pode dar errado aqui, e ela tem que estar visível ENQUANTO se digita — descobrir que soma 90%
 * só na hora de publicar é tarde, e descobrir quando um contato some no meio do fluxo é pior.
 *
 * "Distribuir igualmente" existe porque 3 opções dão 33,33% e ninguém quer digitar isso: a conta
 * divide e joga a sobra na primeira, pra fechar 100 exato.
 */
const MAXIMO = 20;

export function DistribuirSorteioForm({
  data,
  onChange,
}: {
  data: DistribuirSorteioData;
  onChange: (patch: Partial<DistribuirSorteioData>) => void;
}) {
  const { t: traduzir } = useIdioma();
  const opcoes = data.opcoes ?? [];
  const soma = opcoes.reduce((t, o) => t + (Number(o.porcentagem) || 0), 0);

  function trocar(id: string, patch: Partial<OpcaoDistribuicao>) {
    onChange({ opcoes: opcoes.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  }

  function adicionar() {
    if (opcoes.length >= MAXIMO) return;
    const n = opcoes.length + 1;
    onChange({
      opcoes: [...opcoes, { id: `o${Date.now().toString(36)}`, rotulo: `Opção ${n}`, porcentagem: 0 }],
    });
  }

  function remover(id: string) {
    if (opcoes.length <= 2) return;
    onChange({ opcoes: opcoes.filter((o) => o.id !== id) });
  }

  /** Divide 100 pelas opções e joga a sobra na primeira: 3 opções viram 34/33/33, e não 33/33/33. */
  function igualmente() {
    if (!opcoes.length) return;
    const base = Math.floor(100 / opcoes.length);
    const sobra = 100 - base * opcoes.length;
    onChange({ opcoes: opcoes.map((o, i) => ({ ...o, porcentagem: base + (i === 0 ? sobra : 0) })) });
  }

  return (
    <div className="dist-form">
      <div className="dist-topo">
        <div>
          <strong>{traduzir("Opções de randomização")}</strong>
          <p>{traduzir("Configure de 2 a 20 opções com porcentagens que somem 100%")}</p>
        </div>
        <span className={`dist-soma${soma === 100 ? " ok" : ""}`}>
          {traduzir("Total")}: {soma}%
        </span>
      </div>

      <div className="dist-acoes">
        <button type="button" className="btn ghost pequeno" onClick={igualmente}>
          {traduzir("Distribuir igualmente")}
        </button>
        <button type="button" className="btn ghost pequeno" disabled={opcoes.length >= MAXIMO} onClick={adicionar}>
          + {traduzir("Adicionar opção")}
        </button>
      </div>

      <div className="dist-lista">
        {opcoes.map((o) => (
          <div key={o.id} className="dist-linha">
            <input
              className="input"
              value={o.rotulo}
              maxLength={40}
              aria-label={traduzir("Nome da opção")}
              onChange={(e) => trocar(o.id, { rotulo: e.target.value })}
            />
            <label className="dist-pct">
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={o.porcentagem}
                aria-label={`${traduzir("Porcentagem de")} ${o.rotulo}`}
                onChange={(e) => trocar(o.id, { porcentagem: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
              />
              <span aria-hidden="true">%</span>
            </label>
            <button
              type="button"
              className="dist-remover"
              disabled={opcoes.length <= 2}
              title={opcoes.length <= 2 ? traduzir("Precisa de pelo menos duas opções") : traduzir("Remover")}
              aria-label={`${traduzir("Remover")} ${o.rotulo}`}
              onClick={() => remover(o.id)}
            >
              <IconLixeira width={14} height={14} />
            </button>
          </div>
        ))}
      </div>

      {soma !== 100 ? (
        <p className="dist-aviso">
          {traduzir("As porcentagens precisam somar 100%. Hoje somam")} {soma}%
          {soma < 100 ? `, ${traduzir("e os contatos que sobrarem vão pela última opção.")}` : "."}
        </p>
      ) : null}
    </div>
  );
}
