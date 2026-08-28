"use client";

import { useEffect, useState } from "react";

/**
 * Mostra o que copiar pro painel da Meta ao cadastrar um webhook — URL e token de verificação.
 *
 * Cadastrar webhook virava tentativa e erro: o token só era legível no painel da hospedagem (que
 * nem sempre reflete o que o servidor em execução usa) e o domínio tem duas formas, com e sem
 * `www`, possivelmente servidas por deploys diferentes. Errar qualquer um dos dois produz a mesma
 * mensagem genérica da Meta, sem dizer qual.
 *
 * Aqui os dois valores vêm do servidor que está respondendo agora, e há um botão de copiar — não
 * há o que digitar errado.
 */
type Dados = {
  host: string;
  urlWhatsapp: string;
  urlInstagram: string;
  tokenVerificacao: string | null;
};

function LinhaCopiavel({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      // Navegador sem permissão de área de transferência — o valor continua visível pra seleção
      // manual, então não vale interromper com um erro.
    }
  }

  return (
    <div className="field">
      <label>{rotulo}</label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input className="input" readOnly value={valor} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn ghost" style={{ flex: "0 0 auto" }} onClick={copiar}>
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export function DadosWebhook() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integracoes/webhooks")
      .then((r) => r.json())
      .then((d: Dados & { erro?: string }) => (d.erro ? setErro(d.erro) : setDados(d)))
      .catch(() => setErro("Não foi possível carregar os dados do webhook."));
  }, []);

  if (erro) return <p className="hint" style={{ color: "var(--danger)" }}>⚠ {erro}</p>;
  if (!dados) return <p className="hint">Carregando…</p>;

  return (
    <div className="config-bloco">
      <p className="config-bloco-titulo">Dados para cadastrar o webhook na Meta</p>
      <p className="hint" style={{ margin: "0 0 12px" }}>
        Copie daqui e cole no painel da Meta. Estes valores são deste servidor —{" "}
        <b>{dados.host}</b> — que é quem vai responder quando a Meta chamar. Se você acessar o CRM
        por outro endereço, os valores podem ser outros: use sempre os que aparecem aqui.
      </p>

      <LinhaCopiavel rotulo="URL do webhook — WhatsApp" valor={dados.urlWhatsapp} />
      <LinhaCopiavel rotulo="URL do webhook — Instagram" valor={dados.urlInstagram} />

      {dados.tokenVerificacao ? (
        <LinhaCopiavel rotulo="Token de verificação (os dois usam o mesmo)" valor={dados.tokenVerificacao} />
      ) : (
        <p className="hint" style={{ color: "var(--danger)", margin: "10px 0 0" }}>
          ⚠ Este servidor está sem o token de verificação configurado (`META_WEBHOOK_VERIFY_TOKEN`).
          Enquanto ele não existir, a Meta não consegue cadastrar webhook nenhum.
        </p>
      )}
    </div>
  );
}
