"use client";

import { useEffect, useState } from "react";

import type { MensagemModeloWhatsappData } from "@/lib/automation-flow/types";
import type { TemplateSalvo } from "@/components/automacoes/EditorTemplate";

/**
 * Ação "Modelo aprovado do WhatsApp" — escolhe um template REAL do CRM (tela Automações →
 * Templates), aprovado pela Meta. A lista mocada que vivia aqui foi embora: agora quem aparece é o
 * que existe de verdade no workspace, e só o que a Meta já aprovou (o resto não pode ser enviado).
 */
export function MensagemModeloForm({ data, onChange }: { data: MensagemModeloWhatsappData; onChange: (novo: MensagemModeloWhatsappData) => void }) {
  const [templates, setTemplates] = useState<TemplateSalvo[] | null>(null);

  useEffect(() => {
    fetch("/api/templates", { cache: "no-store" })
      .then((r) => r.json() as Promise<TemplateSalvo[]>)
      .then((lista) => setTemplates((Array.isArray(lista) ? lista : []).filter((t) => t.canal === "whatsapp_oficial" && t.status === "aprovado")))
      .catch(() => setTemplates([]));
  }, []);

  return (
    <div className="flow-form">
      <div className="field">
        <label>Modelo</label>
        <select
          className="input"
          value={data.templateId}
          onChange={(e) => {
            const escolhido = templates?.find((t) => t.id === e.target.value);
            onChange({ ...data, templateId: e.target.value, templateNome: escolhido?.nome });
          }}
        >
          <option value="">{templates === null ? "Carregando…" : "Selecione um modelo…"}</option>
          {(templates ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        {templates && templates.length === 0 ? (
          <p className="hint">Nenhum template aprovado ainda. Crie em Automações → Templates e envie pra análise.</p>
        ) : null}
      </div>
    </div>
  );
}
