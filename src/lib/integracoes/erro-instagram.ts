/**
 * Traduz o erro que a Meta devolve ao conectar o Instagram para uma instrução que dá pra seguir.
 *
 * O caso que motivou isto: a pessoa abre o diálogo, aceita todas as permissões, e mesmo assim
 * recebe "Session Invalid. Error validating access token: You cannot access the app till you log in
 * to www.instagram.com and follow the instructions given." Lida ao pé da letra, a frase manda
 * entrar no Instagram, e é exatamente o que a pessoa já fez. Ela parece dizer que o problema é a
 * sessão dela, e não é.
 *
 * O que está acontecendo de verdade: enquanto o app da Meta está em modo de DESENVOLVIMENTO, só
 * contas convidadas como testadora conseguem gerar um token válido. Aceitar as permissões no
 * diálogo NÃO é a mesma coisa que aceitar o convite de testadora, que fica em outro lugar e quase
 * ninguém encontra sozinho. Sem essa tradução, o suporte gasta horas atrás de um problema de
 * sessão que não existe.
 */
export function explicarErroDoInstagram(mensagemDaMeta: string): string {
  const texto = mensagemDaMeta.toLowerCase();

  // A frase da Meta varia de forma, então casa pelo trecho que se repete em todas.
  if (texto.includes("cannot access the app till you log in") || texto.includes("session invalid")) {
    return (
      "O Instagram recusou o acesso porque essa conta ainda não foi aceita como testadora do app. " +
      "Aceitar as permissões na janela de login não é a mesma coisa. " +
      "No Instagram da conta, abra Configurações → Apps e sites → Convites de testador e aceite o convite; " +
      "depois volte aqui e conecte de novo. Quem administra o app precisa ter enviado o convite antes, " +
      "no painel da Meta, em Funções → Testadores do Instagram."
    );
  }

  if (texto.includes("must be a professional account") || texto.includes("not a business account")) {
    return (
      "Essa conta do Instagram é pessoal. O Direct por API só funciona em conta Profissional " +
      "(Comercial ou Criador de conteúdo). Mude o tipo da conta no app do Instagram e conecte de novo."
    );
  }

  /*
   * "The requested user cannot be found." ao RESPONDER.
   *
   * O identificador de quem escreveu é amarrado à conta do Instagram que estava conectada quando a
   * mensagem chegou. Trocando a conta conectada, as conversas antigas continuam na tela (elas são
   * do workspace, não da conexão) mas os identificadores delas deixam de valer, e a Meta responde
   * que não encontra o usuário. A frase sugere que a pessoa sumiu do Instagram, o que não tem nada
   * a ver e manda quem lê investigar o lado errado.
   */
  if (texto.includes("requested user cannot be found") || texto.includes("user cannot be found")) {
    return (
      "Essa conversa veio de outra conta do Instagram, que não é a que está conectada agora. " +
      "O Instagram identifica cada pessoa por conta, então não dá pra responder por aqui. " +
      "Reconecte a conta original, ou responda direto no aplicativo do Instagram."
    );
  }

  if (texto.includes("permission") && texto.includes("messaging")) {
    return (
      "Faltou a permissão de mensagens do Direct. Conecte de novo e deixe marcada a opção de " +
      "gerenciar mensagens, senão o CRM consegue ver o perfil mas não consegue ler nem responder."
    );
  }

  return mensagemDaMeta;
}
