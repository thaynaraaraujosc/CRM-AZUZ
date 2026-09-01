"use client";

import { useEffect, useState } from "react";

type Publicacao = {
  id: string;
  tipo: string;
  legenda: string;
  miniatura: string | null;
  permalink: string | null;
  publicadoEm: string | null;
};

type Dados = {
  palavras?: string[];
  modoPalavra?: "contem" | "exata" | "qualquer";
  ignorarAcentos?: boolean;
  publicacaoId?: string;
};

const MODOS: { valor: NonNullable<Dados["modoPalavra"]>; label: string; ajuda: string }[] = [
  {
    valor: "qualquer",
    label: "Contém uma das palavras (palavra inteira)",
    ajuda: 'O mais usado. "quero" dispara em "eu quero", mas não em "querosene".',
  },
  {
    valor: "contem",
    label: "Contém o texto em qualquer lugar",
    ajuda: 'Mais solto: "quero" também dispara em "querosene" e em "não quero".',
  },
  {
    valor: "exata",
    label: "O comentário é exatamente a palavra",
    ajuda: 'Só dispara se a pessoa escrever apenas "GUIA", nada mais.',
  },
];

const NOME_TIPO: Record<string, string> = {
  IMAGE: "Foto",
  VIDEO: "Vídeo",
  CAROUSEL_ALBUM: "Carrossel",
  REELS: "Reel",
};

/**
 * Configuração do gatilho de comentário no Instagram.
 *
 * Formulário próprio em vez do genérico por dois motivos: a lista de palavras não é um campo de
 * texto (é um conjunto, e digitar "guia,quero" numa caixa esconde erros de espaço), e a escolha da
 * publicação precisa mostrar a foto — ninguém reconhece um post por um id de 17 dígitos.
 */
export function ComentarioInstagramForm({
  data,
  onChange,
}: {
  data: Dados;
  onChange: (novo: Dados) => void;
}) {
  const [publicacoes, setPublicacoes] = useState<Publicacao[] | null>(null);
  const [erroPublicacoes, setErroPublicacoes] = useState<string | null>(null);
  const [novaPalavra, setNovaPalavra] = useState("");

  const palavras = data.palavras ?? [];

  useEffect(() => {
    fetch("/api/integracoes/instagram/publicacoes")
      .then(async (r) => {
        const dados = (await r.json()) as { publicacoes?: Publicacao[]; erro?: string };
        if (!r.ok) throw new Error(dados.erro ?? "Falha ao buscar publicações.");
        setPublicacoes(dados.publicacoes ?? []);
      })
      .catch((erro: Error) => setErroPublicacoes(erro.message));
  }, []);

  function adicionarPalavra() {
    const palavra = novaPalavra.trim();
    // Repetida não entra: duas iguais na lista não mudam nada e só confundem quem lê o fluxo.
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
          placeholder="Digite e aperte Enter — ex.: GUIA"
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
            ? "Sem palavra nenhuma, QUALQUER comentário dispara a automação."
            : "Basta uma das palavras aparecer no comentário."}
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
        <label>Em qual publicação</label>
        {erroPublicacoes ? (
          <p className="hint">
            Não deu pra carregar suas publicações: {erroPublicacoes} A automação continua valendo pra qualquer
            publicação.
          </p>
        ) : publicacoes === null ? (
          <p className="hint">Carregando suas publicações…</p>
        ) : (
          <div className="ig-publicacoes">
            <button
              type="button"
              className={`ig-publicacao${!data.publicacaoId ? " escolhida" : ""}`}
              onClick={() => onChange({ ...data, publicacaoId: "" })}
            >
              <span className="ig-publicacao-todas">Qualquer publicação</span>
            </button>
            {publicacoes.map((pub) => (
              <button
                key={pub.id}
                type="button"
                className={`ig-publicacao${data.publicacaoId === pub.id ? " escolhida" : ""}`}
                onClick={() => onChange({ ...data, publicacaoId: pub.id })}
                title={pub.legenda}
              >
                {pub.miniatura ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagem vem do CDN da Meta, com URL assinada e de vida curta
                  <img src={pub.miniatura} alt="" />
                ) : (
                  <span className="ig-publicacao-sem-capa">sem capa</span>
                )}
                <span className="ig-publicacao-info">
                  <strong>{NOME_TIPO[pub.tipo] ?? pub.tipo}</strong>
                  {pub.publicadoEm ? <em>{new Date(pub.publicadoEm).toLocaleDateString("pt-BR")}</em> : null}
                  <span>{pub.legenda.slice(0, 60) || "Sem legenda"}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
