import type { Metadata } from "next";

import {
  acaoRascunho,
  acoesAnteriores,
  audienciaSelecionada,
  segmentos,
} from "@/lib/data";
import { IconImage, IconMic, IconText } from "@/components/icons";
import { MediaPicker, SegmentChips, Topbar } from "@/components/ui";

export const metadata: Metadata = { title: "Ações · CRM AZUZ" };

const iconePorMidia = {
  imagem: <IconImage />,
  audio: <IconMic />,
  texto: <IconText />,
};

export default function AcoesPage() {
  return (
    <>
      <Topbar
        title="Ações"
        sub="Listas de transmissão segmentadas por período e tipo de contato"
        actions={
          <button type="button" className="btn primary">
            + Nova ação
          </button>
        }
      />

      <div className="content">
        <div className="grid rep-grid">
          <div>
            <div className="card mb14">
              <div className="panel-h">
                <h4>1. Quem vai receber</h4>
              </div>
              <SegmentChips options={segmentos} />
              <div className="aud-count">
                <div>
                  <p className="n">{audienciaSelecionada} contatos</p>
                  <p className="l">Vão receber essa ação</p>
                </div>
                <button type="button" className="btn ghost">
                  Ver lista
                </button>
              </div>
            </div>

            <div className="card">
              <div className="panel-h">
                <h4>2. O que vai enviar</h4>
              </div>
              <MediaPicker
                options={[
                  { label: "Imagem", icon: <IconImage /> },
                  { label: "Áudio", icon: <IconMic /> },
                  { label: "Texto", icon: <IconText /> },
                ]}
              />
              <div className="field">
                <label>Legenda / mensagem</label>
                <div className="input" style={{ minHeight: 54 }}>
                  {acaoRascunho.legenda}
                </div>
              </div>
              <div className="field">
                <label>Enviar</label>
                <div className="input">{acaoRascunho.envio}</div>
              </div>
              <div className="section-foot">
                <button type="button" className="btn primary block">
                  Agendar envio pra {audienciaSelecionada} contatos
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="panel-h">
              <h4>Ações anteriores</h4>
            </div>
            {acoesAnteriores.map((acao) => (
              <div className="broadcast-row" key={acao.titulo}>
                <div className="broadcast-icon">{iconePorMidia[acao.midia]}</div>
                <div className="broadcast-body">
                  <p className="broadcast-title">{acao.titulo}</p>
                  <p className="broadcast-meta">{acao.meta}</p>
                </div>
                <span
                  className={`broadcast-status ${
                    acao.agendado ? "scheduled" : "sent"
                  }`}
                >
                  {acao.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
