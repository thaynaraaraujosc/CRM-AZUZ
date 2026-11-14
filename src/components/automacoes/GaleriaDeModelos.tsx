"use client";

import { useMemo, useState } from "react";

import { IconClose } from "@/components/icons";
import { CAPACIDADES, type CanalId } from "@/lib/canais/capacidades";
import {
  CATEGORIAS,
  MODELOS_DE_ROBO,
  type CategoriaDeModelo,
  type IlustracaoDoModelo,
  type ModeloDeRobo,
} from "@/lib/automacoes/modelos-de-robo";
import { useIdioma } from "@/lib/idioma-context";

/**
 * A GALERIA DE MODELOS: "Criar um bot".
 *
 * "Recriar o pop-up 'Criar um bot' do Kommo no meu CRM, incluindo a galeria de modelos prontos."
 *
 * O canvas em branco é honesto e é uma parede: quem abre o editor pela primeira vez não sabe o que
 * dá pra fazer, e muito menos por onde começar. A galeria responde as duas coisas de uma vez.
 *
 * Duas colunas, como na referência: à esquerda o "Começar do zero" e o filtro por canal; à direita
 * as abas de categoria e a grade de cartões.
 *
 * OS CANAIS SÃO OS DESTE CRM, e só. A referência filtra por TikTok, Telegram, Messenger e chat ao
 * vivo; aqui não existem. Pôr a linha mesmo assim daria uma lista que sempre volta vazia — um
 * filtro que não filtra nada é pior que filtro nenhum, porque faz procurar defeito onde não tem.
 */

const CANAIS_DO_FILTRO: CanalId[] = ["whatsapp_oficial", "whatsapp_qrcode", "instagram", "email"];

/** As cinco pastéis da referência, no azul e no ouro da casa onde dá. */
const FUNDOS: Record<IlustracaoDoModelo["fundo"], { fundo: string; bolha: string }> = {
  verde: { fundo: "#e8f5ec", bolha: "#1f9254" },
  rosa: { fundo: "#fdeaf1", bolha: "#c2306b" },
  laranja: { fundo: "#fdf0e3", bolha: "#b4651a" },
  lilas: { fundo: "#eeeafc", bolha: "#5b45b8" },
  azul: { fundo: "#e6f0fb", bolha: "#1d5fa8" },
};

/**
 * A ILUSTRAÇÃO, DESENHADA UMA VEZ pra todos os cartões.
 *
 * Vinte desenhos à mão seriam vinte arquivos pra manter e vinte chances de um deles sair diferente
 * dos outros. Aqui o modelo descreve o que aparece (cor, bolhas, pílulas, selo) e este componente
 * desenha — que é o que mantém a galeria parecendo uma galeria.
 */
function Ilustracao({ arte }: { arte: IlustracaoDoModelo }) {
  const cor = FUNDOS[arte.fundo];
  return (
    <div className="gm-arte" style={{ background: cor.fundo }}>
      {arte.selo ? <span className="gm-arte-selo">{arte.selo}</span> : null}
      {arte.emoji ? (
        <span className="gm-arte-emoji" aria-hidden="true">
          {arte.emoji}
        </span>
      ) : null}
      <div className="gm-arte-bolhas">
        {arte.bolhas.map((b, i) => (
          <span
            key={i}
            className={`gm-arte-bolha${b.de === "eu" ? " eu" : ""}`}
            style={b.de === "eu" ? { background: cor.bolha } : undefined}
          >
            {b.texto}
          </span>
        ))}
        {arte.botoes?.length ? (
          <span className="gm-arte-pilulas">
            {arte.botoes.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function GaleriaDeModelos({
  aoEscolher,
  aoComecarDoZero,
  aoFechar,
  ocupado,
}: {
  /** Recebe o modelo clicado. Quem chama é que cria o robô e abre o editor. */
  aoEscolher: (modelo: ModeloDeRobo) => void;
  aoComecarDoZero: () => void;
  aoFechar: () => void;
  /** Enquanto o robô está sendo criado: evita dois cliques virarem dois robôs. */
  ocupado?: boolean;
}) {
  const { t: traduzir } = useIdioma();
  const [categoria, setCategoria] = useState<CategoriaDeModelo | "todos">("todos");
  const [canais, setCanais] = useState<CanalId[]>([]);

  const visiveis = useMemo(
    () =>
      MODELOS_DE_ROBO.filter((m) => {
        if (categoria !== "todos" && !m.categorias.includes(categoria)) return false;
        // Vários canais marcados = UNIÃO, como na referência: "serve pra WhatsApp OU pra
        // Instagram", e não "serve pros dois ao mesmo tempo", que quase nada atende.
        if (canais.length && !canais.some((c) => m.canais.includes(c))) return false;
        return true;
      }),
    [categoria, canais],
  );

  function alternarCanal(canal: CanalId) {
    setCanais((atual) => (atual.includes(canal) ? atual.filter((c) => c !== canal) : [...atual, canal]));
  }

  const todosMarcados = canais.length === CANAIS_DO_FILTRO.length;

  return (
    <div className="gm-veu" onClick={aoFechar} role="presentation">
      <div className="gm-painel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <aside className="gm-lado">
          <h2>{traduzir("Criar um robô")}</h2>

          <button type="button" className="btn primary block" onClick={aoComecarDoZero} disabled={ocupado}>
            {traduzir("Começar do zero")}
          </button>

          <p className="gm-lado-titulo">{traduzir("Canais")}</p>
          <label className="gm-canal">
            <input
              type="checkbox"
              checked={todosMarcados}
              onChange={() => setCanais(todosMarcados ? [] : [...CANAIS_DO_FILTRO])}
            />
            <span>{traduzir("Selecionar tudo")}</span>
          </label>
          {CANAIS_DO_FILTRO.map((c) => (
            <label key={c} className="gm-canal">
              <input type="checkbox" checked={canais.includes(c)} onChange={() => alternarCanal(c)} />
              <span>{CAPACIDADES[c].label}</span>
            </label>
          ))}

          {/*
            O QUE NÃO ESTÁ AQUI, DITO NA TELA.

            A referência tem modelos de TikTok, Telegram e Messenger. Quem veio de lá vai procurar
            por eles, e não achar sem explicação parece defeito. Dizer que o canal não está
            conectado é a diferença entre "o CRM não tem" e "eu não encontrei".
          */}
          <p className="hint gm-lado-nota">
            {traduzir(
              "A lista mostra o que roda nos canais deste CRM. Modelos de TikTok, Telegram e Messenger não aparecem porque esses canais não existem aqui.",
            )}
          </p>
        </aside>

        <div className="gm-conteudo">
          <header className="gm-topo">
            <div className="gm-abas">
              <button
                type="button"
                className={`gm-aba${categoria === "todos" ? " on" : ""}`}
                onClick={() => setCategoria("todos")}
              >
                {traduzir("Todos os modelos")}
              </button>
              {CATEGORIAS.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  className={`gm-aba${categoria === c.valor ? " on" : ""}`}
                  onClick={() => setCategoria(c.valor)}
                >
                  {traduzir(c.label)}
                </button>
              ))}
            </div>
            <button type="button" className="modal-close-btn" aria-label={traduzir("Fechar")} onClick={aoFechar}>
              <IconClose width={13} height={13} />
            </button>
          </header>

          <div className="gm-grade">
            {visiveis.map((m) => (
              <button
                key={m.id}
                type="button"
                className="gm-cartao"
                disabled={ocupado}
                title={traduzir(m.objetivo)}
                onClick={() => aoEscolher(m)}
              >
                <Ilustracao arte={m.ilustracao} />
                <span className="gm-cartao-nome">{traduzir(m.nome)}</span>
              </button>
            ))}
            {!visiveis.length ? (
              <p className="hint gm-vazio">
                {traduzir("Nenhum modelo para esse recorte. Tire um filtro para ver mais.")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
