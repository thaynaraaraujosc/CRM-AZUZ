"use client";

import { useEffect, useState } from "react";

type Faixa = { mediana: number; p90: number; pior: number };

type ResumoDoCanal = {
  canal: string;
  amostras: number;
  transporte: Faixa | null;
  processamento: Faixa | null;
  total: Faixa | null;
  relogioAdiantado: number;
};

type Medicao = {
  canais: ResumoDoCanal[];
  semAmostras: boolean;
  banco: { primeiraIda: number; idaEVolta: number };
  regiao: string | null;
  espera: { media: number; pior: number };
};

/** Milissegundos em segundos legíveis. Abaixo de um décimo de segundo, "instantâneo" é a verdade. */
function seg(ms: number): string {
  if (ms < 100) return "menos de 0,1s";
  return `${(ms / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s`;
}

/**
 * IDA E VOLTA AO BANCO ACIMA DISSO É DISTÂNCIA, não consulta mal escrita.
 *
 * Um `SELECT 1` não tem trabalho nenhum pra fazer: o que ele mede é o caminho. Na mesma região são
 * poucos milissegundos. Vinte e cinco já é longe demais pra ser qualquer outra coisa, e importa
 * porque tanto o webhook que grava quanto a busca que a tela repete fazem várias dessas EM SÉRIE.
 */
const IDA_E_VOLTA_SUSPEITA_MS = 25;

/**
 * A RESPOSTA TEM A FORMA QUE ESTE PAINEL ESPERA?
 *
 * Confiar na forma e ler `medicao.banco.idaEVolta` direto custou caro antes: um campo ausente vira
 * `TypeError` durante a renderização, e o React derruba a árvore inteira — o painel não falharia
 * sozinho, levaria a tela de Configurações junto, com a mesma cara de "algo deu errado por aqui"
 * que já apareceu em Conversas. Um diagnóstico não pode ser capaz de quebrar a tela em que mora.
 *
 * Então nada é renderizado a menos que o essencial esteja presente e seja do tipo certo. Resposta
 * de versão antiga, erro em JSON, resposta truncada: tudo cai no mesmo lugar, que é não aparecer.
 */
function medicaoValida(dados: unknown): dados is Medicao {
  if (typeof dados !== "object" || dados === null) return false;
  const d = dados as Partial<Medicao> & { erro?: unknown };
  if (d.erro) return false;
  if (!Array.isArray(d.canais)) return false;
  if (typeof d.banco?.idaEVolta !== "number") return false;
  return typeof d.espera?.media === "number" && typeof d.espera?.pior === "number";
}

/**
 * "Com quanto tempo a mensagem chega aqui?"
 *
 * A pergunta tinha duas respostas possíveis — "rápido" e "demora" — e nenhuma das duas dizia onde a
 * demora estava. Este painel mostra as três pernas separadas, porque elas têm consertos diferentes
 * e uma delas não tem conserto nenhum do nosso lado:
 *
 *   transporte (a Meta/Evolution entregando) + o nosso processamento + a espera da tela
 *
 * Tudo medido, menos a última, que é o intervalo do polling e por isso é calculada. Enquanto não
 * houver mensagem recebida depois da publicação desta medição, o painel diz isso em vez de mostrar
 * número nenhum: ver `src/lib/conversas/tempo-de-chegada.ts`.
 */
export function TempoDeChegada({ canal }: { canal: "WhatsApp" | "Instagram" }) {
  const [medicao, setMedicao] = useState<Medicao | null>(null);

  useEffect(() => {
    fetch("/api/conversas/tempo-de-chegada")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: unknown) => setMedicao(medicaoValida(dados) ? dados : null))
      .catch(() => setMedicao(null));
  }, []);

  if (!medicao) return null;

  // O tipo de cada item também é conferido, pelo mesmo motivo de `medicaoValida`: `Array.isArray`
  // garante que é uma lista, não o que tem dentro dela.
  const meus = medicao.canais.filter(
    (c): c is ResumoDoCanal => typeof c?.canal === "string" && c.canal.startsWith(canal),
  );
  const banco = medicao.banco.idaEVolta;
  // A linha do banco aparece mesmo sem amostra de mensagem: ela já é mensurável no primeiro
  // segundo, e é a explicação mais provável de uma demora alta nas outras linhas.
  const bancoLonge = banco >= IDA_E_VOLTA_SUSPEITA_MS;

  if (!meus.length) {
    return (
      <p className="hint" style={{ marginTop: 10 }}>
        Tempo de chegada das mensagens: ainda sem medição. A conta começa na primeira mensagem
        recebida daqui pra frente.
        {bancoLonge ? ` O banco responde em ${banco} ms por consulta${medicao.regiao ? `, e o CRM roda em ${medicao.regiao}` : ""}.` : ""}
      </p>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      {meus.map((c) => {
        /*
         * A ESPERA DA TELA ENTRA NO TOTAL, e isso não é detalhe.
         *
         * Sem ela o painel mostraria um número menor do que a experiência de quem usa — e aí a
         * medição desmentiria quem está certo, que é o pior defeito possível num diagnóstico. A
         * mensagem fica gravada e ainda espera a tela perguntar de novo.
         *
         * O resto (`c.total`) é soma feita POR MENSAGEM no servidor, não soma de medianas: ver o
         * comentário de `total` em `tempo-de-chegada.ts`.
         */
        const medido = c.total ?? c.processamento;
        const tipico = (medido?.mediana ?? 0) + medicao.espera.media;
        const ruim = (medido?.p90 ?? 0) + medicao.espera.pior;
        /*
         * A FRASE MUDA COM O QUE FOI MEDIDO, e isto é o oposto de detalhe de redação.
         *
         * Sem `total` (todas as amostras com o relógio do remetente adiantado), o número cobre só
         * o nosso pedaço mais a espera da tela — e anunciá-lo como "da hora que a pessoa manda"
         * seria afirmar um tempo menor do que o real, com a autoridade de uma medição. Então a
         * frase diz exatamente de onde até onde o número vale.
         */
        const desdeOEnvio = Boolean(c.total);
        return (
          <div key={c.canal} style={{ marginBottom: 8 }}>
            <p className="hint" style={{ margin: 0 }}>
              <strong>{c.canal}:</strong>{" "}
              {desdeOEnvio
                ? "da hora que a pessoa manda até aparecer na tela, "
                : "de quando a mensagem chega no servidor até aparecer na tela, "}
              <strong>{seg(tipico)}</strong> na maioria das vezes, até {seg(ruim)} nas piores.{" "}
              {c.amostras === 1 ? "1 mensagem medida" : `${c.amostras} mensagens medidas`}.
            </p>
            <p className="hint" style={{ margin: "2px 0 0", opacity: 0.8 }}>
              {/* "Entrega até o CRM" e não "entrega da Meta": no QR Code quem entrega é o servidor
                  da Evolution, não a Meta, e a mesma linha serve os três canais. */}
              {c.transporte ? `Entrega até o CRM: ${seg(c.transporte.mediana)}. ` : ""}
              {c.processamento ? `Gravação aqui no CRM: ${seg(c.processamento.mediana)}. ` : ""}
              Espera da tela: até {seg(medicao.espera.pior)}.
            </p>
            {/*
              * A MARGEM DECLARADA. O carimbo de quando a pessoa mandou vem do relógio do aparelho
              * dela; adiantado, ele produz transporte negativo. Essas amostras saem da conta do
              * transporte (não do processamento, que usa dois relógios nossos) e são contadas aqui,
              * porque uma medição que esconde o que descartou não é medição.
              */}
            {c.relogioAdiantado ? (
              <p className="hint" style={{ margin: "2px 0 0", opacity: 0.8 }}>
                {c.relogioAdiantado === 1
                  ? "1 mensagem ficou fora da conta de entrega"
                  : `${c.relogioAdiantado} mensagens ficaram fora da conta de entrega`}{" "}
                porque o relógio do aparelho de quem mandou estava adiantado.
              </p>
            ) : null}
          </div>
        );
      })}
      {bancoLonge ? (
        <p className="hint" style={{ margin: 0 }}>
          Cada consulta ao banco leva <strong>{banco} ms</strong>
          {medicao.regiao ? ` e o CRM roda em ${medicao.regiao}` : ""}. Como gravar uma mensagem e
          carregar a tela fazem várias consultas em sequência, é daqui que vem a maior parte do
          tempo acima: aproximar o servidor do banco encurta tudo de uma vez.
        </p>
      ) : null}
    </div>
  );
}
