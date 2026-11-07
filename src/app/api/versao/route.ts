import { NextResponse } from "next/server";

/**
 * QUAL VERSÃO ESTÁ NO AR AGORA.
 *
 * Isto nasce de uma hora perdida hoje (07/11/2026): o código estava na `main`, conferido commit
 * a commit, e a tela da Thaynara continuava a mesma. Nenhum dos dois lados conseguia responder a
 * única pergunta que importava — "o site está servindo este código ou um build velho?" — e sem
 * ela a conversa vira adivinhação: eu afirmando que publiquei, ela vendo que não mudou, e os dois
 * certos.
 *
 * Um endereço público que diz o commit que gerou o build encerra essa dúvida em cinco segundos.
 * É deliberadamente PÚBLICO e deliberadamente MUDO sobre qualquer outra coisa: não diz variável de
 * ambiente, não diz banco, não diz cliente. Um sha de commit de um repositório privado não abre
 * porta nenhuma — e saber qual versão está no ar é exatamente o que se precisa quando algo parece
 * não ter subido.
 *
 * `404` AQUI TAMBÉM É RESPOSTA, e das boas: quer dizer que o build no ar é anterior a esta rota
 * existir, ou seja, que os deploys pararam de sair. É o diagnóstico sem precisar de painel nenhum.
 */

export const dynamic = "force-dynamic";

export function GET() {
  // A Vercel injeta estas no build e no runtime. Fora dela ficam vazias, e a resposta diz isso em
  // vez de inventar um valor — "não sei" é informação; um sha falso não é.
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "";
  const ambiente = process.env.VERCEL_ENV ?? "local";

  return NextResponse.json(
    {
      commit: sha ? sha.slice(0, 7) : "desconhecido",
      commitCompleto: sha || null,
      branch: branch || null,
      ambiente,
      // A hora em que ESTE processo começou a responder. Não é a hora do build, mas serve pro que
      // se quer saber: uma instância que subiu há dias é um deploy que não aconteceu.
      respondendoDesde: new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
