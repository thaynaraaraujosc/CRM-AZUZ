"use client";

import type { ConvMensagem } from "@/lib/data";

/**
 * Desenha UMA mensagem — texto, imagem, vídeo, documento, áudio ou localização.
 *
 * Primeiro passo da extração do painel de conversa em componentes reaproveitáveis. Hoje a tela de
 * Conversas desenha as bolhas inline, com dez variantes espalhadas no meio de 7 mil linhas, e o
 * popup do Funil desenhava só `msg.texto` — então uma foto, um PDF ou um áudio apareciam como
 * bolha vazia pra quem respondia pelo Funil, que é justamente onde o vendedor mais responde.
 *
 * Aqui mora só o DESENHO. Menu de ações, curtida, favorito e seleção continuam na tela de
 * Conversas: são interações daquela tela, não da mensagem em si — misturar as duas coisas foi o
 * que tornou aquele trecho impossível de reaproveitar.
 */
export function BolhaMensagem({ msg }: { msg: ConvMensagem }) {
  if (msg.tipo === "system") {
    return <div className="bubble sistema">{msg.texto}</div>;
  }

  const legenda = msg.legenda ?? (msg.texto || undefined);

  if (msg.imagens?.length) {
    // Conteúdo que vive no Instagram (post, reel, story): a miniatura é a porta pra publicação.
    // Sem isso a prévia era decorativa — dava contexto e não levava a lugar nenhum.
    const imagens = msg.imagens.map((img, i) => {
      // eslint-disable-next-line @next/next/no-img-element
      const figura = <img key={i} src={img.url} alt={img.nome ?? "imagem"} className="bubble-imagem" />;
      return msg.linkExterno ? (
        <a key={i} href={msg.linkExterno} target="_blank" rel="noopener noreferrer" title="Abrir no Instagram">
          {figura}
        </a>
      ) : (
        figura
      );
    });
    return (
      <div className={`bubble ${msg.tipo} bubble-midia`}>
        {/* Cabeçalho do cartão de publicação, no formato que o Instagram usa: quem compartilhou em
            cima, a prévia no meio, o texto embaixo. Sem ele, uma imagem solta no meio da conversa
            não diz se é uma foto da pessoa ou uma publicação que ela encaminhou. */}
        {msg.compartilhadoPor ? (
          <span className="bubble-share-topo">{msg.compartilhadoPor}</span>
        ) : null}
        <span className={`bubble-imagens${msg.imagens.length > 1 ? " grade" : ""}`}>{imagens}</span>
        {msg.legendaPublicacao ? (
          <span className="bubble-share-legenda">{msg.legendaPublicacao}</span>
        ) : null}
        {legenda ? <span className="bubble-legenda">{legenda}</span> : null}
        {msg.linkExterno ? (
          <a className="bubble-acao-externa" href={msg.linkExterno} target="_blank" rel="noopener noreferrer">
            {msg.linkEhConversa ? "Ver no Instagram ↗" : "Ver publicação no Instagram ↗"}
          </a>
        ) : null}
        <span className="tm">{msg.hora}</span>
      </div>
    );
  }

  if (msg.video) {
    // Vídeo que vive no Instagram: o CRM não guarda cópia, então o que existe é a porta pra lá.
    if (msg.linkExterno) {
      return (
        <div className={`bubble ${msg.tipo} bubble-midia`}>
          <a className="bubble-midia-externa" href={msg.linkExterno} target="_blank" rel="noopener noreferrer">
            ▶ {msg.linkEhConversa ? "Ver no Instagram" : "Ver publicação no Instagram"}
          </a>
          {legenda ? <span className="bubble-legenda">{legenda}</span> : null}
          <span className="tm">{msg.hora}</span>
        </div>
      );
    }
    return (
      <div className={`bubble ${msg.tipo} bubble-midia`}>
        <video className="bubble-video" src={msg.video.url} controls preload="metadata" />
        {legenda ? <span className="bubble-legenda">{legenda}</span> : null}
        <span className="tm">{msg.hora}</span>
      </div>
    );
  }

  if (msg.audio) {
    return (
      <div className={`bubble ${msg.tipo} bubble-audio`}>
        <audio src={msg.audio.url} controls preload="metadata" style={{ maxWidth: "100%" }} />
        <span className="tm">{msg.hora}</span>
      </div>
    );
  }

  if (msg.documento) {
    return (
      <div className={`bubble ${msg.tipo} bubble-documento`}>
        <a
          href={msg.documento.url}
          target="_blank"
          rel="noopener noreferrer"
          download={msg.documento.nome}
          className="bubble-doc-link"
        >
          <span className="bubble-doc-nome">{msg.documento.nome}</span>
          <span className="bubble-doc-meta">{msg.documento.formato}</span>
        </a>
        {legenda ? <span className="bubble-legenda">{legenda}</span> : null}
        <span className="tm">{msg.hora}</span>
      </div>
    );
  }

  if (msg.localizacao) {
    return (
      <div className={`bubble ${msg.tipo}`}>
        <a
          href={`https://www.google.com/maps?q=${msg.localizacao.lat},${msg.localizacao.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="wa-link-mensagem"
        >
          📍 {msg.localizacao.endereco ?? "Ver no mapa"}
        </a>
        <span className="tm">{msg.hora}</span>
      </div>
    );
  }

  return (
    <div className={`bubble ${msg.tipo}`}>
      {msg.texto}
      <span className="tm">{msg.hora}</span>
    </div>
  );
}
