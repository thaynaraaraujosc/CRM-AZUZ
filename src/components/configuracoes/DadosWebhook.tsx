"use client";

import { useEffect, useState } from "react";
import { IconAlerta } from "@/components/icons";

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

/** Tira das conversas os "anexos" que na verdade são página HTML — sobra do período em que o CRM
 * baixava a mídia do Instagram sem autenticação. Some daqui quando não houver mais nenhum. */
function LimparAnexosInstagram() {
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<number | null>(null);

  async function limpar() {
    setRodando(true);
    try {
      const resposta = await fetch("/api/integracoes/whatsapp/limpar-dados", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: "anexos_instagram" }),
      });
      const dados = (await resposta.json()) as { corrigidas?: number };
      setResultado(dados.corrigidas ?? 0);
    } finally {
      setRodando(false);
    }
  }

  if (resultado !== null) {
    return (
      <p className="hint" style={{ margin: "12px 0 0" }}>
        {resultado === 0
          ? "Nenhum anexo inválido encontrado."
          : `${resultado} mensagens corrigidas — o anexo inválido saiu e o texto ficou.`}
      </p>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button type="button" className="btn ghost" onClick={limpar} disabled={rodando}>
        {rodando ? "Limpando…" : "Limpar anexos quebrados do Instagram"}
      </button>
      <p className="hint" style={{ margin: "6px 0 0" }}>
        Tira das conversas os cards de arquivo que apareceram como “html · 669 KB”. O texto das
        mensagens é preservado.
      </p>
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

  if (erro) return <p className="hint" style={{ color: "var(--danger)" }}><IconAlerta width={12} height={12} aria-hidden="true" /> {erro}</p>;
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

      <LimparAnexosInstagram />

      {dados.tokenVerificacao ? (
        <LinhaCopiavel rotulo="Token de verificação (os dois usam o mesmo)" valor={dados.tokenVerificacao} />
      ) : (
        <p className="hint" style={{ color: "var(--danger)", margin: "10px 0 0" }}>
          <IconAlerta width={12} height={12} aria-hidden="true" /> Este servidor está sem o token de verificação configurado (`META_WEBHOOK_VERIFY_TOKEN`).
          Enquanto ele não existir, a Meta não consegue cadastrar webhook nenhum.
        </p>
      )}
    </div>
  );
}
