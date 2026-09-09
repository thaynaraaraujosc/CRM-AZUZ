import { redirect } from "next/navigation";

/**
 * O endereço antigo da grade do funil.
 *
 * Ela deixou de ser uma aba própria e virou uma visão dentro de Automações: duas abas passavam a
 * ideia de dois sistemas de automação, quando sempre foram os mesmos robôs e os mesmos gatilhos.
 * O redirecionamento fica porque o endereço pode estar num link salvo ou aberto numa aba.
 */
export default function AutomatizarFunilAntigo() {
  redirect("/automacoes");
}
