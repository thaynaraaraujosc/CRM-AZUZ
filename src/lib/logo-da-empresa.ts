"use client";

import { useSyncExternalStore } from "react";

import { prepararLogoDaEmpresa } from "@/lib/imagens/preparar-logo";

/**
 * A LOGO DA AGÊNCIA NO TOPO DO MENU.
 *
 * O ESTADO É UM SÓ, e esse é o ponto: o menu lateral e a tela de Configurações leem do mesmo
 * lugar. Trocar a logo em Configurações atualiza o menu na hora, sem recarregar a página — e sem
 * o menu precisar saber que existe uma tela de Configurações.
 *
 * O NOME DO PRODUTO CONTINUA AO LADO, com ou sem logo. A agência põe a marca dela no quadradinho;
 * o nome do sistema não é o espaço dela.
 *
 * Por que `useSyncExternalStore` e não um Context: o menu é montado uma vez, no layout, e envolve o
 * app inteiro. Um Provider novo em volta de tudo pra carregar uma imagem obrigaria toda a árvore a
 * renderizar de novo a cada troca.
 */

type Estado = { logo: string | null; carregado: boolean };

let estado: Estado = { logo: null, carregado: false };
/** O estado do servidor, imutável: o `useSyncExternalStore` exige o mesmo objeto a cada chamada,
 *  senão o React entra em laço de render durante a hidratação. */
const NO_SERVIDOR: Estado = { logo: null, carregado: false };
const ouvintes = new Set<() => void>();

function publicar(novo: Estado) {
  estado = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function useLogoDaEmpresa(): Estado {
  return useSyncExternalStore(
    assinar,
    () => estado,
    () => NO_SERVIDOR,
  );
}

/** Lê a logo de quem está logado. Falhar aqui não derruba nada: o menu segue com a marca padrão. */
export function carregarLogoDaEmpresa(): Promise<void> {
  return fetch("/api/workspace", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ logo?: string | null }>) : null))
    .then((corpo) => {
      if (corpo) publicar({ logo: corpo.logo ?? null, carregado: true });
    })
    .catch(() => undefined);
}

async function gravar(logo: string | null): Promise<string | null> {
  const resposta = await fetch("/api/workspace", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logo }),
  }).catch(() => null);
  if (resposta?.ok) {
    publicar({ logo, carregado: true });
    return null;
  }
  const corpo = (await resposta?.json().catch(() => null)) as { erro?: string } | null;
  return corpo?.erro ?? "Não deu pra salvar agora. Tente de novo.";
}

/**
 * Prepara o arquivo e grava NA HORA, sem passar pelo botão Salvar.
 *
 * Escolher o arquivo já é a decisão: ninguém abre o seletor de arquivos por engano. Exigir um
 * segundo clique depois disso é como se perde a escolha — a pessoa vê a imagem na tela, acha que
 * está feito, sai da página e a logo não foi.
 *
 * Devolve a frase do erro, ou `null` quando deu certo.
 */
export async function enviarLogoDaEmpresa(arquivo: File): Promise<string | null> {
  try {
    return await gravar(await prepararLogoDaEmpresa(arquivo));
  } catch (erro) {
    return erro instanceof Error ? erro.message : "Não deu pra usar essa logo.";
  }
}

export function tirarLogoDaEmpresa(): Promise<string | null> {
  return gravar(null);
}
