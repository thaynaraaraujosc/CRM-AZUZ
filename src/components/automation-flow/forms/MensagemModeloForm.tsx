"use client";

import type { MensagemModeloWhatsappData } from "@/lib/automation-flow/types";
import { TEMPLATES_WHATSAPP } from "@/lib/automation-flow/templates-whatsapp";

/** Ação "Modelo aprovado do WhatsApp" — escolhe um dos templates pré-aprovados mocados. */
export function MensagemModeloForm({ data, onChange }: { data: MensagemModeloWhatsappData; onChange: (novo: MensagemModeloWhatsappData) => void }) {
  return (
    <div className="flow-form">
      <div className="field">
        <label>Modelo</label>
        <select className="input" value={data.templateId} onChange={(e) => onChange({ ...data, templateId: e.target.value })}>
          <option value="">Selecione um modelo…</option>
          {TEMPLATES_WHATSAPP.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
