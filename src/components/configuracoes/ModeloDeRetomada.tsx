"use client";

import { useEffect, useState } from "react";

type Modelo = { id: string; nome: string; idioma: string; corpo: string };

/**
 * Escolher UMA vez o modelo que retoma conversa fora das 24 horas.
 *
 * A Meta só aceita modelo aprovado depois de 24 horas sem resposta da pessoa. Antes o CRM parava
 * nessa hora e explicava a regra, o que é honesto e é inútil: quem compra um CRM não deveria
 * precisar aprender regra de API pra um follow-up sair, e o follow-up existe justamente pra falar
 * com quem parou de responder.
 *
 * Com um modelo escolhido aqui, toda automação que esbarrar na janela manda ele no lugar de
 * falhar. O texto continua sendo um que a pessoa aprovou; o que sai da frente dela é a decisão
 * repetida a cada mensagem.
 */
export function ModeloDeRetomada() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [escolhido, setEscolhido] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/whatsapp/retomada")
      .then((r) => r.json())
      .then((d: { templateId?: string; modelos?: Modelo[] }) => {
        setModelos(d.modelos ?? []);
        setEscolhido(d.templateId ?? "");
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function salvar(templateId: string) {
    setEscolhido(templateId);
    setSalvando(true);
    setAviso(null);
    try {
      const resposta = await fetch("/api/whatsapp/retomada", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) throw new Error(dados.erro ?? "Não deu pra salvar.");
      setAviso(
        templateId
          ? "Pronto. As automações passam a retomar a conversa sozinhas quando as 24 horas vencerem."
          : "Desligado. Fora das 24 horas a automação vai parar e dizer o motivo.",
      );
    } catch (erro) {
      setAviso(erro instanceof Error ? erro.message : "Não deu pra salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return null;

  const modelo = modelos.find((m) => m.id === escolhido);

  return (
    <div className="config-bloco">
      <p className="config-bloco-titulo">Retomar conversa depois de 24 horas</p>
      <p className="hint">
        Passadas 24 horas sem resposta da pessoa, o WhatsApp só entrega modelo aprovado. Escolha um
        aqui e as automações passam a usá-lo sozinhas nessa hora, em vez de parar.
      </p>

      {modelos.length === 0 ? (
        <p className="hint">
          Você ainda não tem nenhum modelo aprovado pela Meta. Crie um em Automações → Templates e
          volte aqui depois que ele for aprovado.
        </p>
      ) : (
        <div className="field mt8">
          <label htmlFor="modelo-retomada">Modelo usado na retomada</label>
          <select
            id="modelo-retomada"
            className="input"
            value={escolhido}
            disabled={salvando}
            onChange={(e) => void salvar(e.target.value)}
          >
            <option value="">Não retomar: parar e avisar o motivo</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
          {modelo ? <p className="hint">Vai sair assim: “{modelo.corpo}”</p> : null}
        </div>
      )}

      {aviso ? <p className="hint">{aviso}</p> : null}
    </div>
  );
}
