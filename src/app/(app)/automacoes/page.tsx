"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Topbar } from "@/components/ui";
import { AbasAutomacoes } from "@/components/automacoes/AbasAutomacoes";
import { NovaAutomacao } from "@/components/automacoes/NovaAutomacao";
import { AutomacaoDoFunil } from "@/components/funil/AutomacaoDoFunil";
import { useFunis } from "@/lib/funis-context";

/**
 * Automações: a grade por etapa do funil, e só ela.
 *
 * Esta página era uma biblioteca de robôs (lista com busca, filtros, arquivar, duplicar) que
 * convivia com a grade do funil. Eram dois lugares pra pensar a mesma coisa, e a pergunta de quem
 * abriu a tela foi exatamente essa: "por que tem dois?". A automação passa a ser configurada num
 * lugar só: a etapa.
 *
 * O que a lista fazia e não se perdeu: criar (pelo "+ Nova automação" e pelo "+ Adicionar gatilho"
 * de cada etapa), abrir, renomear (o nome fica no painel do próprio robô) e ver execuções. O que
 * saiu junto: busca, filtros por gatilho/canal, arquivar e os modelos de demonstração. Se algum
 * fizer falta, ele volta pra dentro desta tela, não pra uma segunda.
 */
function AutomacoesConteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const { funis } = useFunis();

  const [assistenteAberto, setAssistenteAberto] = useState(false);
  const [funilEscolhido, setFunilEscolhido] = useState("");

  const funilParam = params.get("funil");
  const etapaParam = params.get("etapa");

  // Por derivação, não por efeito: um seletor que abre vazio obriga a um clique que não decide
  // nada quando só existe um funil, que é o caso comum.
  const funil = funis.find((f) => f.id === (funilEscolhido || funilParam || funis[0]?.id));

  return (
    <>
      <Topbar
        title="Automações"
        sub="O que cada etapa do funil faz sozinha quando um lead entra"
        actions={
          <button type="button" className="btn primary" onClick={() => setAssistenteAberto(true)}>
            + Nova automação
          </button>
        }
      />
      <AbasAutomacoes />

      <div className="content">
        {/* O seletor respira do que vem antes e do que vem depois: o rótulo, o campo e o nome do
            funil abaixo eram três coisas de pesos diferentes empilhadas com a mesma distância. */}
        <div className="field" style={{ maxWidth: 340, padding: 0, marginBottom: "var(--space-5)" }}>
          <label>Qual funil você quer automatizar</label>
          <select
            className="input"
            value={funil?.id ?? ""}
            onChange={(e) => setFunilEscolhido(e.target.value)}
          >
            {funis.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        {funil ? (
          <AutomacaoDoFunil
            funilId={funil.id}
            funilNome={funil.nome}
            colunas={funil.colunas.map((c) => ({ id: c.id, titulo: c.titulo, total: c.total }))}
          />
        ) : (
          <section className="card">
            <p className="hint">
              Nenhum funil criado ainda. Crie um em Funil pra automatizar as etapas.
            </p>
          </section>
        )}
      </div>

      {assistenteAberto ? (
        <NovaAutomacao
          funilSugerido={funilParam ?? funil?.id}
          etapaSugerida={etapaParam ?? undefined}
          onCancelar={() => setAssistenteAberto(false)}
          onCriado={(fluxoId) => {
            setAssistenteAberto(false);
            router.push(`/automacoes/editor/${fluxoId}`);
          }}
        />
      ) : null}
    </>
  );
}

export default function AutomacoesPage() {
  // `useSearchParams` precisa de um limite de Suspense: sem ele a página inteira vira dinâmica e
  // o build reclama.
  return (
    <Suspense fallback={null}>
      <AutomacoesConteudo />
    </Suspense>
  );
}
