"use client";

import type { ReactNode } from "react";

import type { ConvMensagem } from "@/lib/data";
import { AudioBubblePlayer } from "@/components/audio-player";
import { IconDoc, IconImage, IconLocalizacao, IconVideoCam } from "@/components/icons";
import { StatusMensagemIcone } from "./StatusMensagem";

/**
 * Desenha UMA mensagem — em qualquer tela do CRM.
 *
 * Este é o único lugar que decide como uma mensagem se parece. Antes existiam duas
 * implementações: a tela de Conversas desenhava as bolhas inline (mais de 300 linhas, com dez
 * variantes no meio de sete mil) e o painel do Funil usava este componente. A mesma mensagem
 * aparecia diferente conforme a tela, e toda correção precisava ser feita duas vezes — quando
 * alguém lembrava da segunda.
 *
 * O que é DESENHO mora aqui. O que é INTERAÇÃO DAQUELA TELA entra por props opcionais, com padrões
 * seguros: sem elas o componente funciona sozinho (é o caso do Funil), com elas ele ganha os
 * comportamentos da tela de Conversas (bloqueio de mídia pesada, visualizador de imagem, ficha do
 * contato, "Ler mais"). Misturar as duas coisas foi o que tornou o código antigo impossível de
 * reaproveitar.
 */
export function BolhaMensagem({
  msg,
  onTentarNovamente,
  chrome,
  chaveDom,
  velocidadeAudio,
  mostrarRemetenteGrupo = true,
  midiaLiberada,
  aoLiberarMidia,
  aoAbrirImagem,
  aoAbrirContato,
  renderizarTexto,
}: {
  msg: ConvMensagem;
  onTentarNovamente?: () => void;
  /** Menu, estrela e reação da tela de Conversas — desenhados dentro da bolha, antes do conteúdo. */
  chrome?: ReactNode;
  /** Valor de `data-msg-chave`, usado pela tela de Conversas pra localizar a bolha no DOM. */
  chaveDom?: string;
  velocidadeAudio?: 1 | 1.5 | 2;
  mostrarRemetenteGrupo?: boolean;
  /** `false` esconde a mídia atrás de um botão — economia de banda em conversa pesada. Padrão: mostra. */
  midiaLiberada?: (tipo: "imagem" | "video" | "documento", id?: string, url?: string) => boolean;
  aoLiberarMidia?: (id?: string) => void;
  /** Abre o visualizador de imagens. Sem isso, a imagem é só imagem. */
  aoAbrirImagem?: (urls: string[], indice: number) => void;
  aoAbrirContato?: (contato: NonNullable<ConvMensagem["contatoCompartilhado"]>) => void;
  /** Transforma o texto (links clicáveis, "Ler mais"). Padrão: texto puro. */
  renderizarTexto?: (texto: string) => ReactNode;
}) {
  const liberada = (tipo: "imagem" | "video" | "documento") =>
    midiaLiberada ? midiaLiberada(tipo, msg.id, msg.imagens?.[0]?.url ?? msg.video?.url) : true;

  const texto = renderizarTexto ? renderizarTexto(msg.texto) : msg.texto;

  if (msg.tipo === "system") {
    return (
      <div className="bubble sistema" data-msg-chave={chaveDom}>
        {msg.texto}
      </div>
    );
  }

  /** Hora + tiquinhos, o rodapé que toda bolha tem. */
  const rodape = (
    <span className="tm">
      {msg.hora}
      {msg.tipo === "out" ? <StatusMensagemIcone status={msg.status} onTentarNovamente={onTentarNovamente} /> : null}
    </span>
  );

  /**
   * Trecho citado quando a mensagem responde outra. Quando o que foi respondido era mídia — foto,
   * story, reel —, a miniatura entra ao lado do texto: sem ela a citação de uma foto aparecia
   * praticamente vazia, porque aquela mensagem não tinha texto nenhum pra citar.
   */
  const citacao = msg.respondendoA ? (
    <span className="wa-citacao">
      {msg.respondendoA.miniatura ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura já baixada e servida pelo CRM
        <img src={msg.respondendoA.miniatura} alt="" className="wa-citacao-thumb" />
      ) : null}
      <span className="wa-citacao-corpo">
        <span className="wa-citacao-autor">{msg.respondendoA.autor}</span>
        <span className="wa-citacao-texto">
          {msg.respondendoA.texto || msg.respondendoA.tipoConteudo || "Mídia"}
        </span>
      </span>
    </span>
  ) : null;

  /** Cabeçalho do conteúdo compartilhado: tipo (STORY/REEL) e autor da publicação. */
  const topoDoShare =
    msg.tipoConteudo || msg.compartilhadoPor ? (
      <span className="bubble-share-topo">
        {msg.tipoConteudo ? <em className="bubble-tipo-conteudo">{msg.tipoConteudo}</em> : null}
        {msg.compartilhadoPor ?? null}
      </span>
    ) : null;

  /** Botão que abre a publicação (ou a conversa) no Instagram. */
  const botaoExterno = msg.linkExterno ? (
    <a className="bubble-acao-externa" href={msg.linkExterno} target="_blank" rel="noopener noreferrer">
      {msg.linkEhConversa ? "Abrir conversa no Instagram ↗" : "Ver publicação no Instagram ↗"}
    </a>
  ) : null;

  const abrir = (classe: string) => ({
    className: `bubble ${msg.tipo} ${classe}`.trim(),
    "data-msg-chave": chaveDom,
  });

  // ----------------------------------------------------------------- localização
  if (msg.localizacao) {
    const { lat, lng, endereco } = msg.localizacao;
    return (
      <div {...abrir("bubble-localizacao")}>
        {chrome}
        {citacao}
        <a
          className="bubble-localizacao-link-area"
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- mapa estático externo */}
          <img
            className="bubble-localizacao-mapa"
            src={`https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=280x140&maptype=mapnik&markers=${lat},${lng},red-pushpin`}
            alt="Mapa com a localização compartilhada"
            loading="lazy"
          />
          <div className="bubble-localizacao-info">
            <span
              className="bubble-localizacao-titulo"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <IconLocalizacao width={12} height={12} /> Localização compartilhada
            </span>
            <span className="bubble-localizacao-endereco">
              {endereco ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
            </span>
            <span className="bubble-localizacao-link">Abrir no mapa →</span>
          </div>
        </a>
        {rodape}
      </div>
    );
  }

  // ------------------------------------------------------------ contato compartilhado
  if (msg.contatoCompartilhado) {
    const ficha = (
      <>
        <span className="avatar">{msg.contatoCompartilhado.initials}</span>
        <span className="bubble-contato-info">
          <span className="bubble-contato-nome">{msg.contatoCompartilhado.nome}</span>
          {msg.contatoCompartilhado.whatsapp ? (
            <span className="bubble-contato-numero">{msg.contatoCompartilhado.whatsapp}</span>
          ) : null}
        </span>
      </>
    );
    return (
      <div {...abrir("bubble-contato")}>
        {chrome}
        {citacao}
        {aoAbrirContato ? (
          <button type="button" className="bubble-contato-area" onClick={() => aoAbrirContato(msg.contatoCompartilhado!)}>
            {ficha}
          </button>
        ) : (
          // Sem o manipulador (Funil), o cartão é só leitura — não um botão que não faz nada.
          <span className="bubble-contato-area" style={{ cursor: "default" }}>
            {ficha}
          </span>
        )}
        {rodape}
      </div>
    );
  }

  // ----------------------------------------------------------------- imagens
  if (msg.imagens?.length) {
    return (
      <div {...abrir("bubble-midia")}>
        {chrome}
        {topoDoShare}
        {liberada("imagem") ? (
          <div className={`bubble-imagens${msg.imagens.length > 1 ? " grade" : ""}`}>
            {msg.imagens.map((img, ix) =>
              // Publicação compartilhada: a miniatura é a porta pro Instagram, não uma foto pra
              // ampliar — o conteúdo (inclusive o carrossel inteiro) está lá, não aqui.
              msg.linkExterno ? (
                <a
                  key={`${msg.id}-img-${ix}`}
                  href={msg.linkExterno}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir a publicação no Instagram"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- anexo servido pelo próprio CRM */}
                  <img src={img.url} alt={img.nome ?? "imagem"} loading="lazy" decoding="async" />
                </a>
              ) : aoAbrirImagem ? (
                <button
                  type="button"
                  key={`${msg.id}-img-${ix}`}
                  className="bubble-imagem-btn"
                  onClick={() => aoAbrirImagem(msg.imagens!.map((im) => im.url), ix)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- anexo servido pelo próprio CRM */}
                  <img src={img.url} alt={img.nome ?? "imagem"} loading="lazy" decoding="async" />
                </button>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- anexo servido pelo próprio CRM
                <img
                  key={`${msg.id}-img-${ix}`}
                  src={img.url}
                  alt={img.nome ?? "imagem"}
                  loading="lazy"
                  decoding="async"
                />
              ),
            )}
          </div>
        ) : (
          <button type="button" className="bubble-midia-bloqueada" onClick={() => aoLiberarMidia?.(msg.id)}>
            <IconImage width={18} height={18} />
            Baixar {msg.imagens.length > 1 ? "imagens" : "imagem"}
          </button>
        )}
        {msg.legendaPublicacao ? <p className="bubble-share-legenda">{msg.legendaPublicacao}</p> : null}
        {msg.legenda ? <p className="bubble-legenda">{msg.legenda}</p> : null}
        {botaoExterno}
        {rodape}
      </div>
    );
  }

  // ----------------------------------------------------------------- vídeo
  if (msg.video) {
    return (
      <div {...abrir("bubble-midia")}>
        {chrome}
        {topoDoShare}
        {msg.linkExterno ? (
          // Vídeo que vive no Instagram: o CRM não guarda cópia, então o que existe é a porta pra
          // lá. "Baixar vídeo" aqui seria uma promessa falsa — não há o que baixar.
          <a className="bubble-midia-externa" href={msg.linkExterno} target="_blank" rel="noopener noreferrer">
            <IconVideoCam width={18} height={18} />
            {msg.linkEhConversa ? "Abrir conversa no Instagram" : "Ver publicação no Instagram"}
          </a>
        ) : liberada("video") ? (
          <video className="bubble-video" src={msg.video.url} controls preload="metadata" muted={!msg.video.comAudio} />
        ) : (
          <button type="button" className="bubble-midia-bloqueada" onClick={() => aoLiberarMidia?.(msg.id)}>
            <IconVideoCam width={18} height={18} />
            Baixar vídeo
          </button>
        )}
        {msg.legendaPublicacao ? <p className="bubble-share-legenda">{msg.legendaPublicacao}</p> : null}
        {msg.legenda ? <p className="bubble-legenda">{msg.legenda}</p> : null}
        {botaoExterno}
        {rodape}
      </div>
    );
  }

  // ----------------------------------------------------------------- documento
  if (msg.documento) {
    return (
      <div {...abrir("bubble-documento")}>
        {chrome}
        <a
          className="bubble-documento-cartao"
          href={msg.documento.url}
          download={msg.documento.nome}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="bubble-documento-icone">
            <IconDoc width={20} height={20} />
          </span>
          <span className="bubble-documento-info">
            <span className="bubble-documento-nome">{msg.documento.nome}</span>
            <span className="bubble-documento-meta">
              {msg.documento.formato} · {formatarTamanho(msg.documento.tamanho)}
            </span>
          </span>
        </a>
        {msg.legenda ? <p className="bubble-legenda">{msg.legenda}</p> : null}
        {rodape}
      </div>
    );
  }

  // ------------------------------------------------- mídia ainda sendo buscada
  if (msg.midiaPendente?.tipo === "audio" || msg.midiaPendente?.tipo === "imagem") {
    const ehAudio = msg.midiaPendente.tipo === "audio";
    return (
      <div {...abrir("")}>
        {chrome}
        <span className="wa-carregar-midia">
          <span className="wa-participante-foto-carregando" />
          {ehAudio ? "Carregando áudio…" : "Carregando imagem…"}
        </span>
        <span className="tm">{msg.hora}</span>
      </div>
    );
  }

  // ----------------------------------------------------------------- áudio
  if (msg.audio) {
    return (
      <div {...abrir("bubble-audio")}>
        {chrome}
        <AudioBubblePlayer
          audio={msg.audio}
          tipo={msg.tipo === "in" ? "in" : "out"}
          velocidadeInicial={velocidadeAudio}
        />
        {rodape}
      </div>
    );
  }

  // ----------------------------------------------------------------- texto
  return (
    <div {...abrir("")}>
      {chrome}
      {mostrarRemetenteGrupo && msg.tipo === "in" && msg.remetenteNome ? (
        <span className="wa-remetente-grupo">{msg.remetenteNome}</span>
      ) : null}
      {citacao}
      {texto}
      {botaoExterno}
      {rodape}
    </div>
  );
}

/** Tamanho legível de arquivo. */
function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
