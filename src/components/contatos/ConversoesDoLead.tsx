"use client";

import { useEffect, useState } from "react";

import { Ajuda } from "@/components/ui";
import {
  ROTULO_DO_STATUS,
  rotuloDaPlataforma,
  rotuloDoEvento,
  podeReprocessar,
  type StatusDaConversao,
} from "@/lib/rastreio/eventos-de-conversao";
import { useIdioma } from "@/lib/idioma-context";

type Evento = {
  id: string;
  plataforma: string;
  evento: string;
  eventoEm: string;
  valor: number | null;
  moeda: string | null;
  status: StatusDaConversao;
  tentativas: number;
  motivo: string | null;
  enviadoEm: string | null;
};

/**
 * O QUE FOI DEVOLVIDO PRA PLATAFORMA DE ANÚNCIO POR ESTE LEAD — e o que não foi, com o motivo.
 *
 * Esta é a tela que faltava quando alguém pergunta por que o relatório do Google não bate com o
 * do CRM. A resposta quase sempre é uma destas três: a venda ainda está na fila, a plataforma
 * recusou (e o motivo está escrito), ou o lead não tinha nenhum identificador de atribuição — e
 * nenhuma delas era visível em lugar nenhum.
 *
 * Só aparece pra quem TEM evento. A maioria dos contatos nunca vai ter: um bloco dizendo "nada
 * enviado" em toda ficha seria ruído repetido do tipo que faz a tela parecer quebrada.
 */
export function ConversoesDoLead({ contatoId }: { contatoId: string }) {
  const { t: traduzir } = useIdioma();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [reprocessando, setReprocessando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Limpa ao trocar de contato ajustando DURANTE a renderização, e não num efeito: sem isso, a
  // ficha de um contato mostraria por um instante as conversões do contato anterior — pior do que
  // não mostrar nada, porque é informação errada com cara de certa.
  const [ultimoContato, setUltimoContato] = useState<string | null>(null);
  if (contatoId !== ultimoContato) {
    setUltimoContato(contatoId);
    setEventos([]);
    setErro(null);
  }

  useEffect(() => {
    fetch(`/api/rastreio/conversoes/fila?contatoId=${encodeURIComponent(contatoId)}`)
      .then((r) => (r.ok ? r.json() : { eventos: [] }))
      .then((d: { eventos: Evento[] }) => setEventos(d.eventos ?? []))
      .catch((e) => console.error("Falha ao carregar as conversões do lead:", e));
  }, [contatoId]);

  async function reprocessar(id: string) {
    setReprocessando(id);
    setErro(null);
    try {
      const r = await fetch("/api/rastreio/conversoes/fila", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
        setErro(corpo.erro ?? "Não foi possível reprocessar.");
        return;
      }
      setEventos((atuais) =>
        atuais.map((e) => (e.id === id ? { ...e, status: "pendente", tentativas: 0, motivo: null } : e)),
      );
    } finally {
      setReprocessando(null);
    }
  }

  if (!eventos.length) return null;

  return (
    <div className="field" style={{ margin: "0 17px 14px" }}>
      <label>
        {traduzir("Conversões enviadas")}
        <Ajuda
          texto={traduzir(
            "O que o CRM devolveu pra plataforma de anúncio sobre este lead. É o que permite a plataforma saber que aquele clique virou venda, e procurar mais gente parecida com quem compra.",
          )}
        />
      </label>
      <div className="conv-lista">
        {eventos.map((e) => (
          <div className={`conv-linha conv-${e.status}`} key={e.id}>
            <div className="conv-linha-topo">
              <span className="conv-evento">{traduzir(rotuloDoEvento(e.evento))}</span>
              <span className={`conv-selo conv-selo-${e.status}`}>{traduzir(ROTULO_DO_STATUS[e.status])}</span>
            </div>
            <p className="conv-meta">
              {rotuloDaPlataforma(e.plataforma)}
              {e.valor != null ? ` · ${e.moeda ?? "BRL"} ${e.valor.toFixed(2)}` : ""}
              {" · "}
              {new Date(e.enviadoEm ?? e.eventoEm).toLocaleDateString("pt-BR")}
              {e.tentativas > 1 ? ` · ${e.tentativas} tentativas` : ""}
            </p>
            {/* O motivo é a parte que importa: "falhou" sozinho não diz a ninguém o que fazer. */}
            {e.motivo ? <p className="conv-motivo">{e.motivo}</p> : null}
            {podeReprocessar(e.status) ? (
              <button
                type="button"
                className="btn ghost conv-reprocessar"
                disabled={reprocessando === e.id}
                onClick={() => void reprocessar(e.id)}
              >
                {reprocessando === e.id ? traduzir("Mandando de volta pra fila…") : traduzir("Tentar de novo")}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {erro ? <p className="hint conv-erro">{erro}</p> : null}
    </div>
  );
}
