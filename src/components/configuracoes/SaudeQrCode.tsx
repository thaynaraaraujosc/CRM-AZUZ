"use client";

import { useEffect, useState } from "react";

type Saude = {
  webhookCerto: boolean;
  reparado: boolean;
  minutosDesdeOUltimoEvento: number | null;
  diagnostico: string;
  /** A última mensagem que CHEGOU e o CRM jogou fora, com o motivo. */
  ultimoDescarte: { motivo: string; em: string; detalhe?: string } | null;
};

/**
 * "Chega mensagem no meu celular e não chega no CRM."
 *
 * O WhatsApp por QR Code depende de um aviso que fica registrado no servidor do WhatsApp, não
 * neste CRM. Quando esse registro se perde, o celular continua recebendo, a conexão continua
 * marcada como conectada, e nenhuma mensagem chega aqui. Isso era invisível.
 *
 * Ao abrir a tela o CRM confere e CONSERTA sozinho. Esta linha só aparece quando há algo pra
 * contar: no estado saudável ela não ocupa espaço nenhum, porque ninguém precisa ler todo dia que
 * está tudo bem.
 */
export function SaudeQrCode() {
  const [saude, setSaude] = useState<Saude | null>(null);
  const [descarteRecente, setDescarteRecente] = useState<Saude["ultimoDescarte"]>(null);

  useEffect(() => {
    fetch("/api/integracoes/whatsapp-nao-oficial/saude")
      .then((r) => r.json())
      .then((dados: Saude & { erro?: string }) => {
        if ("erro" in dados && dados.erro) {
          setSaude(null);
          return;
        }
        setSaude(dados);
        // "É recente?" é decidido aqui, quando o dado chega — e não na renderização, porque ler o
        // relógio durante o render é impuro: o mesmo componente daria respostas diferentes a cada
        // re-render.
        const d = dados.ultimoDescarte;
        setDescarteRecente(d && Date.now() - Date.parse(d.em) < 24 * 60 * 60 * 1000 ? d : null);
      })
      .catch(() => setSaude(null));
  }, []);

  if (!saude) return null;

  /*
   * O DESCARTE SAI DA API E VAI PRA TELA.
   *
   * O servidor já gravava "chegou e o CRM jogou fora, por este motivo" — é o único registro que
   * responde "por que essa mensagem não apareceu". Mas ele ficava só no JSON da rota: na prática,
   * invisível. Quem procurava uma mensagem sumida não tinha onde olhar, e a conclusão virava "o
   * CRM perde mensagem", sem nenhuma pista do contrário.
   *
   * Só aparece se for das últimas 24 horas: um descarte de semanas atrás não explica o problema de
   * hoje e só assustaria quem abrisse a tela.
   */
  const saudavel = saude.webhookCerto && !saude.reparado && (saude.minutosDesdeOUltimoEvento ?? 0) <= 60;
  if (saudavel && !descarteRecente) return null;

  return (
    <>
      {saudavel ? null : (
        <p className={saude.reparado ? "hint" : "int-aviso-conflito"}>{saude.diagnostico}</p>
      )}
      {descarteRecente ? (
        <p className="hint">
          Última mensagem recebida e descartada:{" "}
          <strong>{descarteRecente.motivo}</strong>
          {descarteRecente.detalhe ? ` — ${descarteRecente.detalhe}` : ""}, em{" "}
          {new Date(descarteRecente.em).toLocaleString("pt-BR")}.
        </p>
      ) : null}
    </>
  );
}
