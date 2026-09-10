import { after } from "next/server";

/**
 * Roda um trabalho DEPOIS da resposta HTTP, mas com garantia de que ele roda.
 *
 * POR QUE ISTO EXISTE: disparar automação é efeito secundário de salvar um contato, mover um card
 * ou concluir uma tarefa. Não pode segurar a resposta, e não pode derrubar a operação principal se
 * falhar. A saída óbvia era `void promessa.catch(...)`: não espera e engole o erro.
 *
 * Só que essa saída óbvia NÃO FUNCIONA em serverless. Quando a rota devolve a resposta, a
 * plataforma pode congelar ou encerrar a execução na hora, e uma promessa ainda em voo morre no
 * meio. O efeito é o pior possível: às vezes a automação dispara, às vezes não, sem erro nenhum em
 * lugar nenhum. Era assim que "criei uma automação e ela não executou" acontecia sem deixar rastro.
 *
 * `after` do Next existe exatamente pra isso: a plataforma segura a execução viva até o trabalho
 * terminar, sem atrasar a resposta.
 *
 * O `try` não é decoração: `after` exige contexto de requisição. Chamado de um script de terminal
 * ou de um teste ele estoura, e aí o comportamento antigo é melhor do que quebrar o que chamou.
 */
export function emSegundoPlano(rotulo: string, trabalho: () => Promise<unknown>): void {
  const comLog = () =>
    trabalho().catch((erro) =>
      console.error(`[segundo-plano] ${rotulo} falhou:`, erro instanceof Error ? erro.message : erro),
    );

  try {
    after(comLog);
  } catch {
    // Fora de uma requisição (script, teste): sem plataforma pra segurar, resta o jeito antigo.
    void comLog();
  }
}
