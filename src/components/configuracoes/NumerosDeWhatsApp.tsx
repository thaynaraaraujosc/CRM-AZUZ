"use client";

import { useCallback, useEffect, useState } from "react";

import { IconAlerta } from "@/components/icons";
import { ImportarConversas } from "./ImportarConversas";
import { SaudeQrCode } from "./SaudeQrCode";
import type { HistoricoSync } from "@/lib/integracoes/historico-tipos";
import { useIdioma } from "@/lib/idioma-context";

/**
 * OS NÚMEROS DE WHATSAPP DA EMPRESA, numa lista.
 *
 * Até aqui o CRM tinha "o WhatsApp": um número, um botão de conectar, um de desconectar. Quem
 * vende com equipe não trabalha assim — a vendedora tem o número dela, o closer tem o dele, e os
 * dois precisam cair no mesmo CRM sem que as conversas se misturem.
 *
 * O desenho é o dos CRMs que já resolveram isso (Kommo, Take, Zenvia): uma linha por número, com
 * NOME, número, estado e o que dá pra fazer com ele. O nome é o que faz a lista servir: com três
 * linhas de treze dígitos lado a lado, desconectar o número errado é questão de tempo.
 *
 * Cada linha abre o que é DELA: o diagnóstico ("por que não chega mensagem neste número") e a
 * importação das conversas daquele celular. Eram painéis únicos da empresa, e com dois números
 * isso passaria a responder pelo número errado.
 */

type Conexao = {
  slot: number;
  nome: string;
  apelido: string | null;
  numero: string | null;
  numeroLegivel: string;
  status: string;
  erroMensagem: string | null;
  qrDataUrl: string | null;
};

type Resposta = { conexoes: Conexao[]; limite: number; proximoLivre: number | null };

const ROTULO: Record<string, string> = {
  conectado: "Conectado",
  aguardando_qr: "Esperando o QR Code",
  desconectado: "Desconectado",
  erro: "Com erro",
};

export function NumerosDeWhatsApp({ aoMudar }: { aoMudar?: () => void }) {
  const { t: traduzir } = useIdioma();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [ocupado, setOcupado] = useState<number | "novo" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [renomeando, setRenomeando] = useState<number | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);
  const [historicos, setHistoricos] = useState<Record<number, HistoricoSync>>({});

  /* Encadeada em vez de `async`: o `setDados` precisa cair num callback de promessa, e não no
     corpo do efeito — chamar `setState` direto dentro dele dispara renderização em cascata. */
  const carregar = useCallback(
    () =>
      fetch("/api/integracoes/whatsapp-nao-oficial/numeros")
        .then((r) => r.json())
        .then((corpo: Resposta) => {
          if (corpo?.conexoes) setDados(corpo);
        })
        .catch(() => undefined),
    [],
  );

  /*
   * O RITMO SEGUE O QUE ESTÁ ACONTECENDO.
   *
   * Enquanto alguém está com o celular na mão lendo um QR Code, a tela precisa virar pra
   * "Conectado" quase na hora. No resto do tempo a lista não muda por dias, e bater de quatro em
   * quatro segundos o dia inteiro é consulta ao banco sem ninguém olhando.
   */
  const esperandoQr = dados?.conexoes.some((c) => c.status === "aguardando_qr") ?? false;
  useEffect(() => {
    carregar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") carregar();
    }, esperandoQr ? 4000 : 30000);
    return () => clearInterval(intervalo);
  }, [carregar, esperandoQr]);

  async function conectar(alvo: number | "novo") {
    setOcupado(alvo);
    setErro(null);
    const r = await fetch("/api/integracoes/whatsapp-nao-oficial/conectar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(alvo === "novo" ? { novo: true } : { slot: alvo }),
    }).catch(() => null);
    const corpo = (await r?.json().catch(() => null)) as { erro?: string } | null;
    if (!r?.ok) setErro(corpo?.erro ?? traduzir("Não deu pra conectar agora."));
    setOcupado(null);
    await carregar();
    aoMudar?.();
  }

  async function desconectar(slot: number, nome: string) {
    /*
     * Pergunta antes, e a pergunta diz o NOME do número.
     *
     * Desconectar derruba o atendimento de quem está atrás daquele número. Com uma lista de
     * vários, "tem certeza?" sem dizer qual é o convite para derrubar o errado.
     */
    const limpar = window.confirm(
      traduzir(
        `Desconectar "${nome}"?\n\nOK = desconectar e apagar as conversas que vieram deste WhatsApp · Cancelar = só desconectar, mantendo tudo.`,
      ),
    );
    setOcupado(slot);
    const r = await fetch("/api/integracoes/whatsapp-nao-oficial/desconectar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, limparDados: limpar }),
    }).catch(() => null);
    const corpo = (await r?.json().catch(() => null)) as { limpezaRecusada?: string | null } | null;
    // A limpeza é por canal, não por número: com outro ainda ligado ela não acontece, e quem
    // pediu precisa saber disso agora, não descobrir depois que as conversas continuam lá.
    if (corpo?.limpezaRecusada) setErro(corpo.limpezaRecusada);
    setOcupado(null);
    await carregar();
    aoMudar?.();
  }

  async function salvarNome(slot: number) {
    setRenomeando(null);
    await fetch("/api/integracoes/whatsapp-nao-oficial/numeros", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot, apelido: rascunho }),
    }).catch(() => null);
    await carregar();
  }

  if (!dados) return <p className="hint" style={{ margin: 0 }}>{traduzir("Carregando os números…")}</p>;

  const cheio = dados.proximoLivre === null;

  return (
    <div className="wa-numeros">
      {erro ? (
        <p className="hint" style={{ color: "var(--danger)", margin: 0 }}>
          <IconAlerta width={12} height={12} aria-hidden="true" /> {erro}
        </p>
      ) : null}

      {dados.conexoes.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          {traduzir("Nenhum número conectado ainda.")}
        </p>
      ) : null}

      {dados.conexoes.map((c) => (
        <div key={c.slot} className={`wa-numero${c.status === "conectado" ? " on" : ""}`}>
          <div className="wa-numero-linha">
            <span className={`wa-numero-ponto ${c.status}`} aria-hidden="true" />

            <div className="wa-numero-textos">
              {renomeando === c.slot ? (
                <input
                  className="input"
                  autoFocus
                  value={rascunho}
                  placeholder={traduzir("Ex.: Vendas — Marina")}
                  onChange={(e) => setRascunho(e.target.value)}
                  onBlur={() => void salvarNome(c.slot)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void salvarNome(c.slot);
                    if (e.key === "Escape") setRenomeando(null);
                  }}
                  aria-label={traduzir("Nome deste número")}
                />
              ) : (
                <button
                  type="button"
                  className="wa-numero-nome"
                  onClick={() => {
                    setRascunho(c.apelido ?? "");
                    setRenomeando(c.slot);
                  }}
                  title={traduzir("Dar um nome a este número")}
                >
                  {c.nome}
                </button>
              )}
              <span className="wa-numero-sub">
                {c.numeroLegivel ? `${c.numeroLegivel} · ` : ""}
                {traduzir(ROTULO[c.status] ?? c.status)}
              </span>
            </div>

            <div className="wa-numero-acoes">
              {c.status === "conectado" ? (
                <>
                  <button type="button" className="btn ghost pequeno" onClick={() => setAberta(aberta === c.slot ? null : c.slot)}>
                    {aberta === c.slot ? traduzir("Fechar") : traduzir("Detalhes")}
                  </button>
                  <button
                    type="button"
                    className="btn ghost pequeno wa-desconectar"
                    disabled={ocupado === c.slot}
                    onClick={() => void desconectar(c.slot, c.nome)}
                  >
                    {ocupado === c.slot ? traduzir("Desconectando…") : traduzir("Desconectar")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn primary pequeno"
                  disabled={ocupado === c.slot}
                  onClick={() => void conectar(c.slot)}
                >
                  {ocupado === c.slot ? traduzir("Gerando QR Code…") : traduzir("Conectar")}
                </button>
              )}
            </div>
          </div>

          {c.erroMensagem ? (
            <p className="hint" style={{ color: "var(--danger)", margin: 0 }}>
              <IconAlerta width={12} height={12} aria-hidden="true" /> {c.erroMensagem}
            </p>
          ) : null}

          {c.qrDataUrl ? (
            <div className="wa-numero-qr">
              {/* Fundo branco explícito: o PNG da Evolution é TRANSPARENTE, e sem isso o card
                  azulado do CRM aparece por trás e o leitor do celular não reconhece o código. */}
              <div style={{ background: "#fff", padding: 12, borderRadius: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL gerado na hora pela Evolution, não é asset */}
                <img src={c.qrDataUrl} alt={traduzir("QR Code de conexão do WhatsApp")} width={180} height={180} />
              </div>
              <p className="hint" style={{ margin: 0 }}>
                {traduzir("Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho.")}
              </p>
            </div>
          ) : null}

          {aberta === c.slot ? (
            <div className="wa-numero-detalhes">
              {/* O diagnóstico e a importação são DESTE número: cada celular tem a conexão e a
                  fila dele. Antes eram painéis da empresa, e com dois números passariam a
                  responder pelo número errado. */}
              <SaudeQrCode slot={c.slot} />
              <ImportarConversas
                slot={c.slot}
                conectada
                historico={historicos[c.slot]}
                aoMudar={(h) => setHistoricos((atual) => ({ ...atual, [c.slot]: h }))}
              />
            </div>
          ) : null}
        </div>
      ))}

      <div className="wa-numeros-rodape">
        <button
          type="button"
          className="btn ghost"
          disabled={cheio || ocupado === "novo"}
          onClick={() => void conectar("novo")}
        >
          {ocupado === "novo"
            ? traduzir("Gerando QR Code…")
            : dados.conexoes.length === 0
              ? traduzir("Conectar um número")
              : traduzir("Conectar outro número")}
        </button>
        <span className="hint">
          {cheio
            ? traduzir("Limite de {n} números atingido.", { n: String(dados.limite) })
            : traduzir("{usados} de {limite} números", {
                usados: String(dados.conexoes.filter((c) => c.status === "conectado").length),
                limite: String(dados.limite),
              })}
        </span>
      </div>
    </div>
  );
}
