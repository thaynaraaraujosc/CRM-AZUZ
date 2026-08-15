"use client";

import { useEffect, useState } from "react";

/** Motivos de perda cadastrados no workspace — busca real (`/api/motivos-perda`, que semeia um
 * padrão na primeira vez). Usado no seletor ao marcar um negócio como "perdido". */
export function useMotivosPerda(): string[] {
  const [motivos, setMotivos] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/motivos-perda")
      .then((r) => r.json())
      .then((dados: string[]) => setMotivos(dados))
      .catch((erro) => console.error("Falha ao carregar motivos de perda:", erro));
  }, []);

  return motivos;
}
