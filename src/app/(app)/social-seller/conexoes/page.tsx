import { redirect } from "next/navigation";

/**
 * Conexão de canal se administra em Configurações, e só lá.
 *
 * Esta tela mostrava os mesmos canais que Configurações → Outras integrações já mostra, e ter as
 * duas fazia a pergunta "em qual delas eu conecto?" existir sem precisar. Nada foi desconectado
 * ao removê-la: ela só lia o estado, nunca guardou token nem credencial.
 *
 * O endereço continua valendo pra quem tem ele salvo.
 */
export default function ConexoesSociaisPage() {
  redirect("/configuracoes?categoria=integracoes");
}
