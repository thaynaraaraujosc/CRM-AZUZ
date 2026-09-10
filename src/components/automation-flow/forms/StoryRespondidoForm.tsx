"use client";

import { useEffect, useState } from "react";

type Story = {
  id: string;
  tipo: string;
  miniatura: string | null;
  permalink: string | null;
  publicadoEm: string | null;
};

type Dados = {
  palavras?: string[];
  modoPalavra?: "contem" | "exata" | "qualquer";
  ignorarAcentos?: boolean;
  /** Vazio = qualquer story, de qualquer dia. */
  storyId?: string;
};

/*
 * Rótulo curto no `select`, explicação embaixo: um `select` nativo esconde o que passa da largura
 * da caixa em vez de cortar com reticência, e num painel estreito a diferença entre as opções
 * ficava justamente na parte escondida.
 */
const MODOS: { valor: NonNullable<Dados["modoPalavra"]>; label: string; ajuda: string }[] = [
  {
    valor: "qualquer",
    label: "Palavra inteira",
    ajuda: 'O mais usado. "quero" dispara em "eu quero", mas não em "querosene".',
  },
  {
    valor: "contem",
    label: "Em qualquer parte do texto",
    ajuda: 'Mais solto: "quero" também dispara em "querosene" e em "não quero".',
  },
  {
    valor: "exata",
    label: "Texto exatamente igual",
    ajuda: 'Só dispara se a pessoa escrever apenas "GUIA", nada mais.',
  },
];

const NOME_TIPO: Record<string, string> = {
  IMAGE: "Foto",
  VIDEO: "Vídeo",
};

function horaDoStory(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  const horas = Math.floor((Date.now() - data.getTime()) / (60 * 60 * 1000));
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (horas < 1) return `${hora} · agora há pouco`;
  return `${hora} · há ${horas}h`;
}

/**
 * Configuração do gatilho "Resposta a um story seu".
 *
 * O ponto desta tela é a escolha do story, e ela tem uma regra que nenhuma outra do produto tem:
 * **story dura 24 horas**. A lista aqui é o que está NO AR agora, buscado ao vivo na Meta a cada
 * vez que o campo abre. Não dá pra guardar essa lista, e não deveria: ela estaria errada antes do
 * fim do dia.
 *
 * Daí as duas formas de usar, e as duas são legítimas:
 *
 * - **Qualquer story, de qualquer dia** (o padrão): o robô fica ligado pra sempre e responde quem
 *   reagir a qualquer story, hoje e daqui a um mês. É o que serve pra uma automação permanente.
 * - **Um story específico**: o robô vale só pra quem responder ÀQUELE story. É o que serve pra uma
 *   campanha do dia, do tipo "responde esse story com GUIA que eu te mando o link".
 *
 * O segundo caso tem uma consequência que a tela precisa dizer, e diz: passadas as 24 horas o
 * story sai do ar e o robô para de disparar sozinho. Não é defeito, é o Instagram; mas quem montou
 * precisa saber disso antes, não depois.
 */
export function StoryRespondidoForm({
  data,
  onChange,
}: {
  data: Dados;
  onChange: (novo: Dados) => void;
}) {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [erroStories, setErroStories] = useState<string | null>(null);
  const [novaPalavra, setNovaPalavra] = useState("");

  const palavras = data.palavras ?? [];
  const escolhido = stories?.find((s) => s.id === data.storyId) ?? null;
  // Story escolhido que não está mais na lista: saiu do ar. A tela precisa dizer isso, senão o
  // campo volta pro estado visual de "qualquer story" e quem montou acha que desfez a escolha.
  const escolhidoSumiu = Boolean(data.storyId) && stories !== null && !escolhido;

  useEffect(() => {
    fetch("/api/integracoes/instagram/stories")
      .then(async (r) => {
        const dados = (await r.json()) as { stories?: Story[]; erro?: string };
        if (!r.ok) throw new Error(dados.erro ?? "Falha ao buscar os stories.");
        setStories(dados.stories ?? []);
      })
      .catch((erro: Error) => setErroStories(erro.message));
  }, []);

  function adicionarPalavra() {
    const palavra = novaPalavra.trim();
    if (!palavra || palavras.some((p) => p.toLowerCase() === palavra.toLowerCase())) {
      setNovaPalavra("");
      return;
    }
    onChange({ ...data, palavras: [...palavras, palavra] });
    setNovaPalavra("");
  }

  return (
    <div className="flow-form">
      <div className="field">
        <label>Palavras que disparam</label>
        <div className="ig-palavras">
          {palavras.map((palavra) => (
            <span key={palavra} className="ig-palavra-chip">
              {palavra}
              <button
                type="button"
                aria-label={`Remover ${palavra}`}
                onClick={() => onChange({ ...data, palavras: palavras.filter((p) => p !== palavra) })}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          className="input"
          placeholder="Digite e aperte Enter. Ex.: GUIA"
          value={novaPalavra}
          onChange={(e) => setNovaPalavra(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              adicionarPalavra();
            }
          }}
          onBlur={adicionarPalavra}
        />
        <p className="hint">
          {palavras.length === 0
            ? "Sem palavra nenhuma, QUALQUER resposta ao story dispara a automação."
            : "Basta uma das palavras aparecer na resposta."}
        </p>
      </div>

      <div className="field">
        <label>Como comparar</label>
        <select
          className="input"
          value={data.modoPalavra ?? "qualquer"}
          onChange={(e) => onChange({ ...data, modoPalavra: e.target.value as Dados["modoPalavra"] })}
        >
          {MODOS.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="hint">{MODOS.find((m) => m.valor === (data.modoPalavra ?? "qualquer"))?.ajuda}</p>
      </div>

      <div className="toggle-row">
        <label>
          <input
            type="checkbox"
            checked={data.ignorarAcentos ?? true}
            onChange={(e) => onChange({ ...data, ignorarAcentos: e.target.checked })}
          />{" "}
          Ignorar acentos e maiúsculas
        </label>
        <p className="hint">Com isso, &quot;GUIA&quot;, &quot;guia&quot; e &quot;guía&quot; contam como a mesma palavra.</p>
      </div>

      <div className="field">
        <label>Em qual story</label>
        <p className="hint">
          Story dura 24 horas. A lista abaixo é o que está no ar agora, buscado na hora.
        </p>

        {escolhidoSumiu ? (
          <p className="hint ig-story-aviso">
            O story escolhido saiu do ar: passou das 24 horas. Enquanto ele estiver assim, este robô
            não dispara. Escolha um story de agora, ou volte pra qualquer story.
          </p>
        ) : null}

        <div className="ig-publicacoes">
          <button
            type="button"
            className={`ig-publicacao${!data.storyId ? " escolhida" : ""}`}
            onClick={() => onChange({ ...data, storyId: "" })}
          >
            <span className="ig-publicacao-info">
              <strong>Qualquer story, de qualquer dia</strong>
              <span>O robô fica valendo pra sempre, inclusive pros stories de amanhã.</span>
            </span>
          </button>

          {erroStories ? (
            <p className="hint">
              Não deu pra carregar seus stories: {erroStories} Dá pra seguir com qualquer story.
            </p>
          ) : stories === null ? (
            <p className="hint">Carregando seus stories…</p>
          ) : stories.length === 0 ? (
            <p className="hint">
              Nenhum story seu está no ar agora. Poste um e abra este campo de novo pra escolher.
            </p>
          ) : (
            stories.map((story) => (
              <button
                key={story.id}
                type="button"
                className={`ig-publicacao${data.storyId === story.id ? " escolhida" : ""}`}
                onClick={() => onChange({ ...data, storyId: story.id })}
              >
                {story.miniatura ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem vem do CDN da Meta, com URL assinada e de vida curta
                  <img src={story.miniatura} alt="" />
                ) : (
                  <span className="ig-publicacao-sem-capa">sem capa</span>
                )}
                <span className="ig-publicacao-info">
                  <strong>{NOME_TIPO[story.tipo] ?? story.tipo}</strong>
                  <em>{horaDoStory(story.publicadoEm)}</em>
                  <span>No ar agora</span>
                </span>
              </button>
            ))
          )}
        </div>

        {data.storyId && escolhido ? (
          <p className="hint">
            O robô vale só pra quem responder este story. Quando ele sair do ar, daqui a menos de 24
            horas, o robô para de disparar sozinho.
          </p>
        ) : null}
      </div>
    </div>
  );
}
