# Conta de demonstração

Uma empresa fictícia completa (Clínica Vitta) para mostrar o produto sem expor dado de cliente.

## Por que existe

Demonstrar o CRM significava abrir a conta real e deixar nome, telefone e conversa de cliente de
verdade na tela: numa reunião de venda, ou na gravação do vídeo de apresentação. Depois que o
vídeo está publicado não tem volta.

Conta nova também não resolve, pelo motivo oposto: está vazia. Funil sem card, conversa sem
mensagem e relatório sem número parecem um produto que não faz nada.

## Como usar

Painel de super-admin, em Workspaces: o bloco **Conta de demonstração**. Define uma senha, escreve
`MONTAR` para confirmar, e entra com `demo@azuzcrm.com.br`.

Remontar é o uso normal, não a exceção. Depois de cada demonstração a conta fica com card
arrastado, conversa lida e tarefa concluída; o mesmo botão devolve tudo ao estado inicial.

## Nada aqui é real

Isto vai para vídeo público, então as duas garantias abaixo são presas por teste:

- **E-mails** usam `@exemplo.com.br`, domínio reservado para exemplo.
- **Telefones** saem no formato `(11) 90880-000X`. Celular brasileiro é `9` seguido de um dígito de
  6 a 9; estes saem `9` seguido de `0`, que não existe. Ninguém consegue ligar para o número que
  aparecer na tela, nem por engano.

## A trava

Remontar APAGA. Por isso o workspace alvo nunca vem do cliente: é a constante `WORKSPACE_DEMO`, a
rota recusa qualquer outro valor, e todo `deleteMany` é amarrado a ele. O botão ainda pede
confirmação escrita.

Isso não está só escrito no código: `__tests__/semear.test.ts` cria um workspace vizinho com dados
dentro, remonta a demonstração e confere que o vizinho saiu intacto.

## Rodando os testes contra um banco de verdade

`semearDemo` apaga e recria um workspace inteiro numa transação com dezenas de `create`
encadeados. Coluna obrigatória faltando, chave estrangeira fora de ordem e transação estourando o
tempo não aparecem em teste de unidade. Aparecem aqui.

Em 13/09/2026 o CRM caiu duas vezes no mesmo dia, nas duas por mudança com teste de unidade verde
que nunca tinha tocado num banco. Este teste existe por causa disso.

Ele pula sozinho quando não há banco, então `npx vitest run` funciona sem preparar nada. Para
rodar de verdade:

```bash
service mariadb start

mariadb -uroot -e "
  CREATE DATABASE IF NOT EXISTS azuz_demo;
  CREATE USER IF NOT EXISTS 'azuzd'@'localhost' IDENTIFIED BY 'azuzd123';
  CREATE USER IF NOT EXISTS 'azuzd'@'%' IDENTIFIED BY 'azuzd123';
  GRANT ALL ON azuz_demo.* TO 'azuzd'@'localhost';
  GRANT ALL ON azuz_demo.* TO 'azuzd'@'%';
  FLUSH PRIVILEGES;"

DATABASE_URL="mysql://azuzd:azuzd123@127.0.0.1:3306/azuz_demo" npx prisma db push --accept-data-loss

npx vitest run src/lib/demo
```

`TESTE_BANCO_URL` troca o destino quando for outro banco.
