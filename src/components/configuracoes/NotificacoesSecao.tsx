"use client";

import { IconBell, IconInstagram, IconWhatsApp, IconCheck } from "@/components/icons";
import { tocarSinal, useNotificacoes } from "@/lib/notificacoes-context";
import { CabecalhoCategoria } from "./CabecalhoCategoria";
import { useIdioma } from "@/lib/idioma-context";

/**
 * NOTIFICAÇÕES, CADA UMA NUM BOTÃO.
 *
 * "Cadê as notificações? Deixa cada notificação num botão, bota azulzinho claro, fica bonito."
 *
 * A tela tinha UM interruptor numa linha, e antes dele uma matriz de canal × frequência que foi
 * removida porque prometia e-mail, push e WhatsApp que nunca chegaram a ser enviados. Vazia desse
 * jeito, ela parecia quebrada — e é exatamente o que ela viu.
 *
 * O que voltou são quatro botões que mexem em COMPORTAMENTO REAL, e dá pra apontar onde cada um
 * age: o aviso na tela, o canal de onde a mensagem veio (dois) e o apito. Nenhum deles promete
 * canal de envio que não existe.
 *
 * O botão é o próprio estado: ligado fica azul claro com a marca de conferido, desligado fica
 * branco. Não há interruptor ao lado — o botão inteiro é o alvo, que é o que faz ele funcionar no
 * celular sem mira.
 */

type Opcao = {
  campo: "notificacoesAtivas" | "whatsapp" | "instagram" | "som";
  titulo: string;
  descricao: string;
  Icon: typeof IconBell;
  cor: string;
};

const OPCOES: Opcao[] = [
  {
    campo: "notificacoesAtivas",
    titulo: "Avisar na tela",
    descricao: "O aviso que salta no canto quando chega mensagem nova.",
    Icon: IconBell,
    cor: "#F59E0B",
  },
  {
    campo: "whatsapp",
    titulo: "Mensagem do WhatsApp",
    descricao: "Avisar quando a mensagem chegar por um número de WhatsApp.",
    Icon: IconWhatsApp,
    cor: "#25D366",
  },
  {
    campo: "instagram",
    titulo: "Mensagem do Instagram",
    descricao: "Avisar quando a mensagem chegar pelo Direct.",
    Icon: IconInstagram,
    cor: "#C13584",
  },
  {
    campo: "som",
    titulo: "Tocar um som",
    descricao: "O apito junto do aviso. Útil desligar pra quem atende de headset o dia todo.",
    Icon: IconBell,
    cor: "#6366F1",
  },
];

export function NotificacoesSecao() {
  const { t: traduzir } = useIdioma();
  const { prefs, alternarPref } = useNotificacoes();

  return (
    <div className="config-secao">
      <CabecalhoCategoria
        titulo={traduzir("Notificações")}
        descricao={traduzir("Quando e como você é avisado sobre o que acontece no CRM.")}
      />

      <div className="config-bloco">
        <div className="notif-botoes">
          {OPCOES.map((o) => {
            const ligada = prefs[o.campo];
            return (
              <button
                type="button"
                key={o.campo}
                className={`notif-botao${ligada ? " on" : ""}`}
                aria-pressed={ligada}
                onClick={() => alternarPref(o.campo)}
              >
                <span className="notif-botao-icone" style={{ color: o.cor }}>
                  <o.Icon width={18} height={18} aria-hidden="true" />
                </span>
                <span className="notif-botao-texto">
                  <strong>{traduzir(o.titulo)}</strong>
                  <span>{traduzir(o.descricao)}</span>
                </span>
                <span className="notif-botao-marca" aria-hidden="true">
                  {ligada ? <IconCheck width={13} height={13} /> : null}
                </span>
              </button>
            );
          })}
        </div>

        {/*
          OUVIR O SOM, sem ter que esperar alguém mandar mensagem.

          "O som é muito feio." Era, e a única forma de conferir se o novo ficou melhor era
          esperar chegar mensagem — que é justamente quando não dá pra ficar comparando. Um botão
          resolve, e de quebra serve pra ajustar o volume do computador antes do expediente.

          Fica desligado junto com o som: um botão que toca o que a pessoa acabou de desligar
          contradiz o botão de cima.
        */}
        <button
          type="button"
          className="btn ghost pequeno notif-ouvir"
          disabled={!prefs.som}
          onClick={() => tocarSinal()}
        >
          {traduzir("Ouvir o som")}
        </button>

        {/*
          O QUE O CRM AVISA HOJE, dito na tela e não só no código.

          É um tipo só: mensagem nova numa conversa. Quem abre esta tela esperando escolher entre
          dez avisos merece saber que são quatro botões porque é isso que existe — e não porque a
          tela está incompleta.
        */}
        <p className="hint notif-rodape">
          {traduzir(
            "Hoje o CRM avisa de um acontecimento: mensagem nova numa conversa. Quando existirem outros (lead novo no funil, tarefa vencendo), eles aparecem aqui como mais botões.",
          )}
        </p>
      </div>
    </div>
  );
}
