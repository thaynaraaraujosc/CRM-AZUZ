"use client";

import { useEffect, useState } from "react";

export type LinhaPorCampanha = {
  plataforma: "google" | "meta";
  campanhaId: string | null;
  campanhaNome: string;
  leads: number;
  vendas: number;
  receita: number;
};

/**
 * O que o CRM sabe de cada campanha: quantos leads entraram e quanto virou venda fechada.
 *
 * Separado do `useGoogleAds` de propósito. Aquele fala com a plataforma de anúncio; este só lê o
 * banco do próprio CRM. Juntar os dois num hook só faria a tabela inteira esperar a API do Google
 * responder pra mostrar um número que já está aqui dentro.
 */
export function usePorCampanha() {
  const [linhas, setLinhas] = useState<LinhaPorCampanha[]>([]);
  const [leadsSemCampanha, setLeadsSemCampanha] = useState(0);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/trafego/por-campanha")
      .then((r) => (r.ok ? r.json() : { linhas: [], leadsSemCampanha: 0 }))
      .then((d: { linhas?: LinhaPorCampanha[]; leadsSemCampanha?: number }) => {
        if (!vivo) return;
        setLinhas(d.linhas ?? []);
        setLeadsSemCampanha(d.leadsSemCampanha ?? 0);
      })
      .catch((erro) => console.error("Falha ao carregar os leads por campanha:", erro))
      .finally(() => {
        if (vivo) setCarregado(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return { linhasDoCrm: linhas, leadsSemCampanha, crmCarregado: carregado };
}

/**
 * Acha a linha do CRM que corresponde a uma campanha da plataforma.
 *
 * Casa por id quando ele existe dos dois lados, e por nome normalizado quando não. O nome é a
 * chave frágil (acento, maiúscula, espaço a mais), então ele é comparado sem nada disso — mas
 * continua sendo o que o anunciante digitou na plataforma, então é o que bate.
 */
export function acharNoCrm(
  linhas: LinhaPorCampanha[],
  campanha: { plataforma: "M" | "G"; nome: string },
): LinhaPorCampanha | undefined {
  const plataforma = campanha.plataforma === "M" ? "meta" : "google";
  const alvo = normalizar(campanha.nome);
  return linhas.find((l) => l.plataforma === plataforma && normalizar(l.campanhaNome) === alvo);
}

/** Mesmo critério usado no casamento por nome, exportado pra quem precisar comparar por fora. */
export function normalizarNome(texto: string): string {
  return normalizar(texto);
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
