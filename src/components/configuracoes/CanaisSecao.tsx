"use client";

import { useEffect, useState } from "react";

import { IconCalendar, IconConversas, IconDoc, IconInstagram, IconWhatsApp } from "@/components/icons";
import { CabecalhoCategoria } from "./CabecalhoCategoria";

type EstadoCanal = "Conectado" | "Desconectado" | "Requer atenção" | "Configuração incompleta";

const CANAIS_MOCK: { id: string; nome: string; Icon: typeof IconWhatsApp; estado: EstadoCanal; conexao: string; equipe: string; horario: string; conversas: number; ultimaSinc: string }[] = [
  { id: "whatsapp", nome: "WhatsApp", Icon: IconWhatsApp, estado: "Conectado", conexao: "Conexão por provedor", equipe: "Atendimento", horario: "08:00–20:00", conversas: 312, ultimaSinc: "há 2 min" },
  { id: "instagram", nome: "Instagram", Icon: IconInstagram, estado: "Conectado", conexao: "API oficial", equipe: "Marketing", horario: "09:00–18:00", conversas: 48, ultimaSinc: "há 5 min" },
  { id: "facebook", nome: "Facebook", Icon: IconInstagram, estado: "Requer atenção", conexao: "API oficial", equipe: "Marketing", horario: "09:00–18:00", conversas: 12, ultimaSinc: "há 3h" },
  { id: "email", nome: "E-mail", Icon: IconDoc, estado: "Configuração incompleta", conexao: "Não configurado", equipe: "—", horario: "—", conversas: 0, ultimaSinc: "nunca" },
  { id: "formularios", nome: "Formulários", Icon: IconDoc, estado: "Conectado", conexao: "Interno", equipe: "Comercial", horario: "24 horas", conversas: 26, ultimaSinc: "há 1 min" },
  { id: "chat-site", nome: "Chat do site", Icon: IconCalendar, estado: "Desconectado", conexao: "Não configurado", equipe: "—", horario: "—", conversas: 0, ultimaSinc: "nunca" },
];

const CLASSE_ESTADO: Record<EstadoCanal, string> = {
  Conectado: "connected",
  Desconectado: "off",
  "Requer atenção": "off",
  "Configuração incompleta": "off",
};

/** Canais de atendimento (item 27) — visão geral consolidada; cada card leva pra configuração
 * específica quando existe (WhatsApp/Instagram) ou só mostra estado, sem conexão real. */
export function CanaisSecao() {
  const [testando, setTestando] = useState<string | null>(null);
  const [whatsappReal, setWhatsappReal] = useState<{ estado: EstadoCanal; conexao: string } | null>(null);
  const [instagramReal, setInstagramReal] = useState<{ estado: EstadoCanal; conexao: string } | null>(null);

  useEffect(() => {
    fetch("/api/integracoes/meta?provedor=meta_whatsapp")
      .then((r) => r.json())
      .then((dados: { status: string; metadados: { numeroExibicao?: string } | null }) => {
        setWhatsappReal({
          estado: dados.status === "conectado" ? "Conectado" : dados.status === "erro" ? "Requer atenção" : "Desconectado",
          conexao: dados.status === "conectado" ? `API oficial — ${dados.metadados?.numeroExibicao ?? ""}` : "Não configurado",
        });
      })
      .catch((erro) => console.error("Falha ao carregar status do WhatsApp:", erro));

    fetch("/api/integracoes/meta?provedor=meta_instagram")
      .then((r) => r.json())
      .then((dados: { status: string; metadados: { instagramUsername?: string } | null }) => {
        setInstagramReal({
          estado: dados.status === "conectado" ? "Conectado" : dados.status === "erro" ? "Requer atenção" : "Desconectado",
          conexao: dados.status === "conectado" ? `API oficial — @${dados.metadados?.instagramUsername ?? ""}` : "Não configurado",
        });
      })
      .catch((erro) => console.error("Falha ao carregar status do Instagram:", erro));
  }, []);

  const canais = CANAIS_MOCK.map((c) =>
    c.id === "whatsapp" && whatsappReal
      ? { ...c, ...whatsappReal }
      : c.id === "instagram" && instagramReal
        ? { ...c, ...instagramReal }
        : c,
  );

  return (
    <div className="config-secao">
      <CabecalhoCategoria titulo="Canais de atendimento" descricao="Visão geral de todos os canais conectados ao workspace." />
      <div className="config-canais-grid">
        {canais.map((c) => (
          <div className="config-canal-card" key={c.id}>
            <div className="config-canal-card-h">
              <c.Icon width={20} height={20} />
              <span className="n">{c.nome}</span>
              <span className={`int-status ${CLASSE_ESTADO[c.estado]}`}>{c.estado}</span>
            </div>
            <p className="r">Conexão: {c.conexao}</p>
            <p className="r">Equipe responsável: {c.equipe}</p>
            <p className="r">Horário de atendimento: {c.horario}</p>
            <p className="r">
              {c.conversas} conversas · sincronizado {c.ultimaSinc}
            </p>
            <div className="config-canal-card-acoes">
              <button type="button" className="btn ghost">
                Configurar
              </button>
              <button type="button" className="btn ghost" onClick={() => setTestando(c.id)}>
                Testar visualmente
              </button>
              <button type="button" className="btn ghost" disabled={c.estado === "Desconectado"}>
                Desconectar
              </button>
            </div>
            {testando === c.id ? <p className="hint mt8">✓ Simulação de teste concluída — canal responde normalmente.</p> : null}
          </div>
        ))}
      </div>
      <p className="hint mt14">
        <IconConversas width={12} height={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
        WhatsApp e Instagram já refletem a conexão real com a Meta (ver Configurações → WhatsApp/Instagram).
        Facebook e os demais canais continuam mockados pra ilustrar como a tela vai se comportar quando
        forem conectados de verdade.
      </p>
    </div>
  );
}
