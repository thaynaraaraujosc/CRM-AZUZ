# Conexão com o banco

## Por que existe um teste que abre conexão de verdade

Em 13/09/2026 o CRM ficou inacessível em produção ("o servidor não está conseguindo acessar o
banco de dados"). A causa foi uma função que montava a URL de conexão e cortava a query string no
primeiro `?`. Senha de banco é gerada por máquina e pode conter `?` e `@` literais; quando isso
acontece, o corte cai no meio da senha e host, porta e nome do banco viram lixo codificado.

Havia teste. Ele passava. Ele conferia que a função montava a string certa, que é uma opinião de
quem escreveu o teste. Quem decide se a string presta é o driver, e depois dele o servidor. Entre
a string bonita e a conexão aberta cabia o bug.

Por isso `__tests__/conexao-real.test.ts` **abre conexão**: consulta, conta conexão viva e confere
o que o servidor enxerga. Rodando contra a versão que quebrou, ele falha. É o único tipo de teste
que teria impedido a queda.

## Rodando o teste de conexão real

Ele pula sozinho se não houver banco, então `npx vitest run` funciona sem preparar nada. Para
rodar de verdade:

```bash
service mariadb start

mariadb -uroot <<'SQL'
CREATE DATABASE IF NOT EXISTS azuz_pool;
CREATE USER IF NOT EXISTS 'azuzt'@'%' IDENTIFIED BY 'p@ss?w0rd';
GRANT ALL ON azuz_pool.* TO 'azuzt'@'%';
CREATE USER IF NOT EXISTS 'azuzs'@'%' IDENTIFIED BY 'simples123';
GRANT ALL ON azuz_pool.* TO 'azuzs'@'%';
FLUSH PRIVILEGES;
SQL

npx vitest run src/lib/banco
```

A senha `p@ss?w0rd` não é enfeite: é o formato exato que quebrou.

Host, porta e banco saem de `TESTE_BANCO_HOST`, `TESTE_BANCO_PORTA` e `TESTE_BANCO_NOME` quando
definidos.

## O que os parâmetros resolvem

| Parâmetro | Padrão do driver | Nosso | Por quê |
|---|---|---|---|
| `minimumIdle` | = `connectionLimit` (3) | `0` | O padrão segura 3 conexões vivas para sempre por processo. Na Vercel, cada instância nova abre as suas e nunca devolve, porque é congelada antes disso. |
| `idleTimeout` | 1800 s | `30` | Meia hora de conexão pendurada por instância congelada. |
| `connectionLimit` | 10 | `3` | Teto por processo, para não estourar o limite do banco. |
| `compress` | desligado | `true` | O Railway cobra por GB que sai do banco. |

Medido em produção antes do conserto: **73 conexões abertas** para um teto de 151 e **4.753
tentativas recusadas de 13.875**, com zero cliente usando o produto. Conexão recusada não é
lentidão: quando chega mensagem de WhatsApp, o webhook precisa de conexão para gravá-la, e a
Evolution não tenta de novo. A mensagem some.

A rota `/api/admin/custo-banco` mostra esses números ao vivo.
