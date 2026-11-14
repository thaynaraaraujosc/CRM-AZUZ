"use client";

import { useMemo, useState } from "react";

import { IconClose } from "@/components/icons";
import { CAPACIDADES, type AreaAutomacao, type CanalId } from "@/lib/canais/capacidades";
import {
  CATEGORIAS,
  canaisDoFiltro,
  modelosDaArea,
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

/**
 * O QUE CADA GALERIA DIZ DE SI MESMA, e o que ela explica que NÃO está ali.
 *
 * "Se eu estiver fazendo uma automação lá no Social Seller, de forma alguma deve estar aparecendo
 * que eu estou dentro de Automações. Social Seller é Social Seller, lá em Automações é automações
 * de WhatsApp ou de outras coisas."
 *
 * Separar as duas sem dizer onde foi parar o que sumiu transforma a separação em sumiço: quem
 * procurava "Responda a palavras-chave nos comentários" na automação do funil não acha e acha que
 * quebrou. Cada lado aponta pro outro, por nome.
 */
const TEXTOS_DA_AREA: Record<AreaAutomacao, { titulo: string; nota: string }> = {
  comercial: {
    titulo: "Criar um robô",
    nota: "Estes são os robôs de WhatsApp e e-mail, disparados por uma etapa do funil. Os modelos de Instagram ficam no Social Seller, porque lá o que dispara é um comentário, um story ou uma mensagem no Direct — e isso uma etapa do funil não enxerga.",
  },
  social: {
    titulo: "Criar uma automação do Instagram",
    nota: "Cada modelo daqui já vem com o próprio gatilho do Instagram: comentário, resposta a story, menção ou Direct. Os robôs de WhatsApp e e-mail, que quem dispara é a etapa do funil, ficam em Automações.",
  },
};

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
  area,
  aoEscolher,
  aoComecarDoZero,
  aoFechar,
  ocupado,
  comoPagina,
}: {
  /** Qual galeria: a do funil ("comercial") ou a do Social Seller ("social"). */
  area: AreaAutomacao;
  /** Recebe o modelo clicado. Quem chama é que cria o robô e abre o editor. */
  aoEscolher: (modelo: ModeloDeRobo) => void;
  aoComecarDoZero: () => void;
  aoFechar: () => void;
  /** Enquanto o robô está sendo criado: evita dois cliques virarem dois robôs. */
  ocupado?: boolean;
  /**
   * Desenha o painel direto na página, sem o véu escuro por trás.
   *
   * No funil a galeria é um desvio de dez segundos dentro de outra tela, e a janela é o certo: ela
   * some sem mexer no que estava atrás. No Social Seller, "Criar automação" É a tela — um véu ali
   * escureceria uma página vazia, que é o cheiro de modal preso.
   */
  comoPagina?: boolean;
}) {
  const { t: traduzir } = useIdioma();
  const [categoria, setCategoria] = useState<CategoriaDeModelo | "todos">("todos");
  const [canais, setCanais] = useState<CanalId[]>([]);

  const CANAIS_DO_FILTRO = useMemo(() => canaisDoFiltro(area), [area]);
  const textos = TEXTOS_DA_AREA[area];
  const daArea = useMemo(() => modelosDaArea(area), [area]);
  const categoriasComModelo = useMemo(
    () => CATEGORIAS.filter((c) => daArea.some((m) => m.categorias.includes(c.valor))),
    [daArea],
  );

  const visiveis = useMemo(
    () =>
      daArea.filter((m) => {
        if (categoria !== "todos" && !m.categorias.includes(categoria)) return false;
        // Vários canais marcados = UNIÃO, como na referência: "serve pra WhatsApp OU pra
        // Instagram", e não "serve pros dois ao mesmo tempo", que quase nada atende.
        if (canais.length && !canais.some((c) => m.canais.includes(c))) return false;
        return true;
      }),
    [daArea, categoria, canais],
  );

  function alternarCanal(canal: CanalId) {
    setCanais((atual) => (atual.includes(canal) ? atual.filter((c) => c !== canal) : [...atual, canal]));
  }

  const todosMarcados = canais.length === CANAIS_DO_FILTRO.length;

  const painel = (
      <div
        className={`gm-painel${comoPagina ? " gm-painel-pagina" : ""}`}
        role={comoPagina ? undefined : "dialog"}
        aria-modal={comoPagina ? undefined : true}
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="gm-lado">
          <h2>{traduzir(textos.titulo)}</h2>

          <button type="button" className="btn primary block" onClick={aoComecarDoZero} disabled={ocupado}>
            {traduzir("Começar do zero")}
          </button>

          {/*
            O FILTRO DE CANAL SÓ APARECE SE HOUVER O QUE FILTRAR.

            No Social Seller todo modelo é de Instagram: uma caixinha sozinha chamada "Instagram"
            não separa nada, e só ensina a pessoa a clicar numa coisa que não muda a tela.
          */}
          {CANAIS_DO_FILTRO.length > 1 ? (
            <>
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
            </>
          ) : null}

          {/*
            O QUE NÃO ESTÁ AQUI, DITO NA TELA — e onde foi parar.

            Quem veio da referência vai procurar os modelos de TikTok, Telegram e Messenger; quem
            procura Instagram aqui vai achar que sumiu. Não achar sem explicação parece defeito, e
            a diferença entre "o CRM não tem" e "eu não encontrei" é uma frase.
          */}
          {/* As duas notas ancoradas JUNTAS no pé da coluna. Soltas, cada uma puxava o próprio
              `margin-top: auto` e a primeira parava no meio do vazio, parecendo deslocada. */}
          <div className="gm-lado-notas">
            <p className="hint">{traduzir(textos.nota)}</p>
            <p className="hint">
              {traduzir(
                "Modelos de TikTok, Telegram e Messenger não aparecem em lugar nenhum porque esses canais não existem neste CRM.",
              )}
            </p>
          </div>
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
              {/*
                SÓ AS CATEGORIAS QUE TÊM MODELO NESTA GALERIA.

                As quatro são do catálogo inteiro. No Social Seller nenhum modelo é de
                "Informações comerciais" nem de "Reduzir retrabalho": as duas abas abririam numa
                tela vazia, sempre. Um filtro que nunca filtra nada faz procurar defeito onde não
                tem — é a mesma razão por que o filtro de canal some quando há um canal só.
              */}
              {categoriasComModelo.map((c) => (
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
  );

  if (comoPagina) return painel;

  return (
    <div className="gm-veu" onClick={aoFechar} role="presentation">
      {painel}
    </div>
  );
}
