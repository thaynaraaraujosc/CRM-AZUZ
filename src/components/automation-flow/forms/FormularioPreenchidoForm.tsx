"use client";

import { useEffect, useState } from "react";

import type { ListaDeFormularios } from "@/lib/integracoes/azuz-flow-formularios";
import {
  identificadorDoFormularioDoCrm,
  identificadorDoFormularioDoFlow,
} from "@/lib/automation-flow/formulario-do-gatilho";
import { useFormularios } from "@/lib/formularios-context";
import { useIdioma } from "@/lib/idioma-context";

/**
 * DE QUAL FORMULÁRIO ESTE ROBÔ ATENDE.
 *
 * O campo existia no tipo do bloco desde sempre e NUNCA teve tela: nada o preenchia, e o disparo
 * nem mandava de qual formulário o evento vinha. O resultado era o defeito relatado — todo robô de
 * "formulário preenchido" respondia a TODO formulário, do CRM e do AZUZ Flow, e não havia como uma
 * resposta ser diferente da outra.
 *
 * Os dois produtos aparecem na MESMA lista, em grupos separados. Separá-los em dois campos ("é do
 * CRM ou do Flow?" e depois "qual?") seria uma pergunta a mais para uma decisão que é uma só: de
 * qual formulário. Quem monta o robô pensa no formulário, não em qual produto o hospeda.
 */
export function FormularioPreenchidoForm({
  data,
  onChange,
}: {
  data: { formularioId?: string };
  onChange: (data: { formularioId?: string }) => void;
}) {
  const { t: traduzir } = useIdioma();
  const { formularios } = useFormularios();
  const [doFlow, setDoFlow] = useState<ListaDeFormularios | null>(null);

  useEffect(() => {
    fetch("/api/integracoes/azuz-flow/formularios")
      .then((r) => (r.ok ? r.json() : null))
      .then((lista: ListaDeFormularios | null) => {
        setDoFlow(lista && Array.isArray(lista.formularios) ? lista : null);
      })
      .catch(() => setDoFlow(null));
  }, []);

  const escolhido = data.formularioId ?? "";
  const conhecidos = new Set([
    ...formularios.map((f) => identificadorDoFormularioDoCrm(f.id)),
    ...(doFlow?.formularios ?? []).map((f) => identificadorDoFormularioDoFlow(f.id)),
  ]);
  // O formulário escolhido pode ter sido apagado depois, dos dois lados. Some da lista, e o bloco
  // apontaria pra um id invisível: dizer que ele sumiu é melhor do que parecer que nada foi
  // escolhido — "nada escolhido" significa "atende a todos", que é o oposto do que está gravado.
  const sumiu = Boolean(escolhido) && !conhecidos.has(escolhido);

  return (
    <div className="flow-form">
      <div className="field">
        <label>{traduzir("De qual formulário")}</label>
      <select
        className="input"
        value={escolhido}
        onChange={(e) => onChange({ formularioId: e.target.value || undefined })}
      >
        <option value="">{traduzir("Qualquer formulário")}</option>
        {sumiu ? <option value={escolhido}>{`${traduzir("Formulário apagado")} (${escolhido})`}</option> : null}
        {formularios.length ? (
          <optgroup label={traduzir("Formulários do CRM")}>
            {formularios.map((f) => (
              <option key={f.id} value={identificadorDoFormularioDoCrm(f.id)}>
                {f.nome}
                {f.status === "publicado" ? "" : ` (${traduzir("rascunho")})`}
              </option>
            ))}
          </optgroup>
        ) : null}
        {doFlow?.formularios.length ? (
          <optgroup label={traduzir("Formulários do AZUZ Flow")}>
            {doFlow.formularios.map((f) => (
              <option key={f.id} value={identificadorDoFormularioDoFlow(f.id)}>
                {f.nome}
                {f.publicado ? "" : ` (${traduzir("rascunho")})`}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>

      {/*
        "QUALQUER FORMULÁRIO" É O PADRÃO, e precisa estar escrito.
        
        É o comportamento que todo robô já publicado tem gravado — o campo nunca foi preenchido por
        ninguém. Quem abrir um robô antigo precisa entender por que ele responde a tudo, em vez de
        achar que a escolha se perdeu.
      */}
      <p className="hint mt8">
        {escolhido
          ? traduzir("Este robô só responde a quem preencher esse formulário.")
          : traduzir("Sem escolher, o robô responde a QUALQUER formulário preenchido — do CRM e do AZUZ Flow.")}
      </p>
      {doFlow && !doFlow.formularios.length ? (
        <p className="hint mt8">
          {traduzir(
            "Nenhum formulário do AZUZ Flow aqui ainda: a lista chega do próprio Flow. Confira a conexão em Configurações → Outras integrações.",
          )}
        </p>
      ) : null}
      </div>
    </div>
  );
}
