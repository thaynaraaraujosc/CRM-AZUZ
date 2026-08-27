"use client";

import { useState } from "react";

/**
 * Aciona a criação das colunas `contaCanal` no banco (ver `/api/integracoes/whatsapp/migrar-conta-canal`).
 *
 * Existe porque hoje nada aplica mudança de schema em produção: o `prisma db push` mora no `start`,
 * que a Vercel (serverless) nunca executa, e o serviço do Railway que faria isso nunca foi
 * configurado. Como a `DATABASE_URL` também não é legível no painel da Vercel, não dá pra rodar o
 * SQL de fora — então o próprio CRM aplica, com a conexão que já tem.
 *
 * Temporário: sai daqui assim que existir migração de verdade no deploy.
 */
type Passo = { comando: string; resultado: "aplicado" | "ja_existia" };

export function MigrarContaCanal() {
  const [rodando, setRodando] = useState(false);
  const [passos, setPassos] = useState<Passo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function aplicar() {
    setRodando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/integracoes/whatsapp/migrar-conta-canal", { method: "POST" });
      const dados = (await resposta.json()) as { erro?: string; passos?: Passo[] };
      if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao aplicar.");
      setPassos(dados.passos ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao aplicar.");
    } finally {
      setRodando(false);
    }
  }

  if (passos) {
    const aplicados = passos.filter((p) => p.resultado === "aplicado").length;
    return (
      <p className="hint" style={{ margin: "10px 0 0" }}>
        {aplicados === 0
          ? "Banco já estava atualizado — nada a fazer."
          : `Banco atualizado: ${aplicados} de ${passos.length} itens criados agora.`}
      </p>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button type="button" className="btn ghost" onClick={aplicar} disabled={rodando}>
        {rodando ? "Aplicando…" : "Atualizar banco de dados"}
      </button>
      <p className="hint" style={{ margin: "6px 0 0" }}>
        Cria as colunas novas que a separação de conversas por número precisa. Só adiciona campos
        opcionais — nenhum dado existente é alterado ou apagado, e rodar de novo não faz mal.
      </p>
      {erro ? <p className="hint" style={{ color: "var(--danger)", marginTop: 6 }}>⚠ {erro}</p> : null}
    </div>
  );
}
