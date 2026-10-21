"use client";

import { useSyncExternalStore } from "react";

import { prepararLogoDaEmpresa } from "@/lib/imagens/preparar-logo";

/**
 * A IDENTIDADE DA AGÊNCIA — a logo e o nome do espaço de trabalho — em UM estado compartilhado.
 *
 * O NOME ESTÁ AQUI por causa de um defeito real: ele também mora no token da SESSÃO
 * (`sessao.user.workspaceNome`), e token de sessão é tirado no login e não muda sozinho. Trocar o
 * nome em Configurações gravava a coluna e o menu continuava mostrando o nome antigo — até a
 * pessoa sair e entrar de novo. Parecia que não tinha salvado.
 *
 * Com um estado compartilhado, quem grava PUBLICA, e quem mostra lê daqui com a sessão como
 * reserva. O menu atualiza na hora, sem recarregar a página e sem precisar saber que existe uma
 * tela de Configurações.
 *
 * Por que `useSyncExternalStore` e não um Context: o menu é montado uma vez, no layout, e envolve o
 * app inteiro. Um Provider novo em volta de tudo obrigaria a árvore inteira a renderizar de novo a
 * cada troca de logo.
 */

type Estado = { logo: string | null; nome: string | null; carregado: boolean };

let estado: Estado = { logo: null, nome: null, carregado: false };
/** O estado do servidor, imutável: o `useSyncExternalStore` exige o mesmo objeto a cada chamada,
 *  senão o React entra em laço de render durante a hidratação. */
const NO_SERVIDOR: Estado = { logo: null, nome: null, carregado: false };
const ouvintes = new Set<() => void>();

function publicar(novo: Estado) {
  estado = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function useIdentidadeDaEmpresa(): Estado {
  return useSyncExternalStore(
    assinar,
    () => estado,
    () => NO_SERVIDOR,
  );
}

/** Lê a identidade de quem está logado. Falhar aqui não derruba nada: o menu segue com a marca
 *  padrão e com o nome que veio na sessão. */
export function carregarIdentidadeDaEmpresa(): Promise<void> {
  return fetch("/api/workspace", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ logo?: string | null; nome?: string }>) : null))
    .then((corpo) => {
      if (corpo) publicar({ logo: corpo.logo ?? null, nome: corpo.nome ?? null, carregado: true });
    })
    .catch(() => undefined);
}

/**
 * Avisa que o nome mudou. Chamado por QUEM GRAVOU, nos dois lugares que editam o nome (o menu e
 * Configurações › Dados da empresa), logo depois de o servidor confirmar.
 *
 * Não é um "set" otimista: só vem depois do `ok` da rota. Publicar antes faria o menu mostrar um
 * nome que o banco recusou.
 */
export function publicarNomeDaEmpresa(nome: string): void {
  publicar({ ...estado, nome, carregado: true });
}

async function gravar(logo: string | null): Promise<string | null> {
  const resposta = await fetch("/api/workspace", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logo }),
  }).catch(() => null);
  if (resposta?.ok) {
    publicar({ ...estado, logo, carregado: true });
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
