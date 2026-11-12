"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

import { FloatingDropdown } from "@/components/ui";
import { useIdioma } from "@/lib/idioma-context";

/**
 * TROCAR A CONTA DE ANÚNCIOS QUE O CRM LÊ.
 *
 * "E se essa campanha tiver errada? Eu tô achando que essa conta não é essa conta. Como que eu
 * faço pra mudar? Porque pode ter várias páginas lá."
 *
 * Não tinha como. No fim do OAuth o CRM pegava a primeira conta ativa da lista da Meta e gravava,
 * e não existia tela nenhuma pra ver qual foi nem pra trocar — reconectar só repetia o mesmo
 * chute. Quem administra mais de uma conta (agência, conta do cliente, a velha de teste) ficava
 * preso na que calhou de vir primeiro, olhando uma tela vazia sem saber por quê.
 *
 * O seletor fica na pílula de conexão, na faixa do Tráfego, porque é ali que a dúvida nasce: é
 * olhando a tela sem campanha que se desconfia da conta.
 */

type ContaListada = {
  id: string;
  nome: string;
  moeda: string;
  status: string;
  ativa: boolean;
};

export function SeletorDeContaDeAnuncios({
  contaAtualId,
  contaAtualNome,
  onTrocada,
}: {
  contaAtualId?: string;
  contaAtualNome?: string;
  /** Chamado depois de trocar, pra tela recarregar as campanhas da conta nova. */
  onTrocada: () => void;
}) {
  const { t: traduzir } = useIdioma();
  const { data: sessao } = useSession();
  const [aberto, setAberto] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [contas, setContas] = useState<ContaListada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [trocando, setTrocando] = useState<string | null>(null);

  /* Trocar a conta de anúncios é mexer numa integração, e é essa a permissão que vale — a mesma
     que o proxy cobra na rota. Quem só tem permissão de ver Inteligência comercial continua
     vendo QUAL conta está ligada (a informação é dela), mas sem o botão de trocar: oferecer um
     controle que vai responder 403 é pior do que não oferecer. */
  const podeTrocar =
    Boolean(sessao?.user?.superAdmin) ||
    sessao?.user?.papelTipo === "admin" ||
    (sessao?.user?.permissoes ?? []).includes("config_integracoes");

  const rotulo = contaAtualNome ?? contaAtualId ?? traduzir("conta não escolhida");

  if (!podeTrocar) {
    return <span className="conexao-conta">{rotulo}</span>;
  }

  function abrir(e: React.MouseEvent<HTMLButtonElement>) {
    setRect(e.currentTarget.getBoundingClientRect());
    setAberto((v) => !v);
    if (contas) return;
    setCarregando(true);
    setErro(null);
    fetch("/api/integracoes/meta/ads/contas")
      .then((r) => r.json())
      .then((dados: { contas?: ContaListada[]; erro?: string }) => {
        if (dados?.erro) setErro(dados.erro);
        else setContas(dados.contas ?? []);
      })
      .catch(() => setErro("Não deu pra falar com o Meta agora."))
      .finally(() => setCarregando(false));
  }

  async function escolher(id: string) {
    setTrocando(id);
    setErro(null);
    try {
      const resposta = await fetch("/api/integracoes/meta/ads/contas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adAccountId: id }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) {
        setErro(dados?.erro ?? "Não deu pra trocar a conta.");
        return;
      }
      setAberto(false);
      onTrocada();
    } finally {
      setTrocando(null);
    }
  }

  return (
    <>
      <button type="button" className="conexao-conta conexao-conta-btn" onClick={abrir} title={contaAtualId}>
        {rotulo} ▾
      </button>
      <FloatingDropdown anchorRect={aberto ? rect : null} onClose={() => setAberto(false)} width={330} align="right">
        <div className="contas-ads">
          <p className="contas-ads-h">{traduzir("Ler as campanhas de qual conta de anúncios?")}</p>

          {carregando ? <p className="hint">{traduzir("Carregando as contas…")}</p> : null}
          {erro ? <p className="hint contas-ads-erro">{erro}</p> : null}

          {contas?.length === 0 ? (
            <p className="hint">
              {traduzir("Esse acesso não enxerga nenhuma conta de anúncios. Reconecte escolhendo o Business que tem as campanhas.")}
            </p>
          ) : null}

          {contas?.map((conta) => {
            const escolhida = conta.id === contaAtualId;
            return (
              <button
                type="button"
                key={conta.id}
                className={`contas-ads-item${escolhida ? " escolhida" : ""}`}
                onClick={() => void escolher(conta.id)}
                disabled={trocando !== null}
              >
                <span className="contas-ads-nome">{conta.nome}</span>
                <span className="contas-ads-meta">
                  {conta.id} · {conta.moeda} ·{" "}
                  <span className={conta.ativa ? "contas-ads-ok" : "contas-ads-parada"}>{conta.status}</span>
                </span>
                {escolhida ? <span className="contas-ads-marca">{traduzir("lendo esta")}</span> : null}
                {trocando === conta.id ? <span className="contas-ads-marca">{traduzir("trocando…")}</span> : null}
              </button>
            );
          })}

          {/*
            A DIFERENÇA ENTRE PÁGINA E CONTA DE ANÚNCIOS, dita uma vez.

            "Pode ter várias páginas lá." Pode — e página não é o que o CRM precisa saber. Página é
            quem publica; conta de anúncios é a carteira, e é nela que campanha, orçamento e fatura
            moram. Uma conta de anúncios anuncia por várias páginas, e a mesma página pode ser
            anunciada por contas diferentes. Sem essa frase, escolher aqui vira adivinhação.
          */}
          <p className="hint contas-ads-nota">
            {traduzir(
              "Conta de anúncios não é página do Facebook: a página é quem publica, a conta de anúncios é onde ficam as campanhas, o orçamento e a fatura. Uma conta só pode anunciar por várias páginas. Se não reconhecer nenhuma da lista, o acesso conectado é de outro Business — aí é reconectar.",
            )}
          </p>
        </div>
      </FloatingDropdown>
    </>
  );
}
