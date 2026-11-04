# Referência: a automação de funil do Kommo

Mapeado pela extensão do Claude no Chrome da Thaynara, em 04/11/2026, na conta da Clínica Criar
(funil "DRA NATÁLIA VIANNA"). Medidas em pixels CSS, tiradas dos estilos computados, janela de
1414×904 com DPR 2. Nada foi alterado lá: os testes foram cancelados.

**Este arquivo é a FONTE das decisões de estrutura da grade de automação do funil.** Quando uma
medida daqui e o código divergirem, o código está errado — ou o motivo da diferença está escrito
ao lado da regra, no `globals.css`.

O que ele NÃO é: uma fonte de cores. O Kommo é azul `#4C8BF7` em PT Sans; o CRM é azul-marinho e
ouro em Inter. A referência entra pela ESTRUTURA (o que aparece, onde, de que tamanho, e o que só
aparece ao passar o mouse) e passa pelos tokens do `globals.css` antes de virar regra. Era isso
que a unificação do renderizador de mensagens tinha acabado de resolver, e copiar paleta de fora
desfaz.

> **Deixado de fora de propósito:** o inventário dos 18 robôs da conta (textos das mensagens para
> pacientes, endereços da clínica, ids de etapa e de campo). É conteúdo de um cliente, não
> referência de produto, e não tem por que morar num repositório de código. O que importa dali
> está destilado nas seções 3 e 4.

---

## 1. A grade

| Medida | Valor |
|---|---|
| Coluna | 305px (304 + 1px de borda) |
| Cabeçalho | 79px — faixa do nome 34px, área das dicas 43px |
| Linha vazia, ou com cartão de uma linha de ação | 66px |
| Cartão de duas linhas de ação | 77,2px |
| Cartão de três linhas de ação | 96,5px |

**Cada cabeçalho tem**, de cima para baixo e da esquerda para a direita:

- alça de arraste de 7×14px, seis pontos, à esquerda, **sempre visível** nas colunas editáveis;
- nome em maiúsculas;
- linha colorida de 4px de altura por 304px de largura;
- link de dicas (`3 dicas` ou `Adicionar dicas`);
- botão `+` de 26×26px **na divisa entre colunas**, e também antes da primeira.

**Não aparece** nesta tela: a contagem de leads da etapa.

**Célula vazia:** branca e sem nada em repouso. Ao passar o mouse, um `+` em círculo e a palavra
"Adicionar gatilho" centralizados, em `#CBCFD0` — e **só na célula sob o cursor**.

**Inserir etapa:** o `+` da divisa cria a coluna na hora, com o cursor no nome. A grade abaixo
fica cinza, o cabeçalho ganha uma lixeira vermelha e um círculo de cor (paleta de 21 cores), e
"Voltar" vira "Cancelar". A etapa só existe depois do "Salvar" da barra de cima.

**Reordenar etapa:** há alça e a linha é `ui-sortable`. O arraste em si não foi executado para não
mexer no funil da cliente — **não verificado**. Num teste cancelado depois, soltar a etapa deixou
a grade cinza, "Sair" virou "Cancelar" e "Salvar" acendeu mesmo sem a ordem ter mudado.

**Dicas:** o link abre um modal com três textos por etapa — Iniciante, Intermediário, Expert.

## 2. O cartão de gatilho

Ícone de 34×30px à esquerda. À direita, a linha do "quando" (uma linha) e a linha do "o que faz"
em negrito, que quebra em várias.

**Em repouso não há botão nenhum à vista.** Ao passar o mouse aparecem o ícone de copiar (16×18px)
e, na borda direita, a alça de três barras que estica o cartão entre colunas; os textos esmaecem à
direita, atrás deles.

**Ordem entre gatilhos da mesma etapa:** cada um na sua linha, um abaixo do outro. Sem número, sem
seta, sem conector. Se a posição define a ordem de execução: **não verificado**.

**Gatilho que vale para várias etapas:** uma faixa colorida contínua atravessa as colunas, sem
divisória interna; o ícone e o texto aparecem uma vez só, ancorados na primeira. A largura é
múltiplo exato da coluna (3× ou 14× 305px).

Copiar um gatilho prende uma cópia cinza ao cursor; a célula sob o ponteiro fica cinza para dizer
onde ela cai. `Esc` não cancela — só recarregar.

## 3. Os gatilhos ("quando")

**O `+` da célula NÃO abre a lista de gatilhos.** O caminho é outro: o `+` abre o catálogo de
AÇÕES; escolher uma cria o cartão e abre um balão; e é dentro do balão, no seletor "Executar:",
que mora a lista de gatilhos. A lista é a mesma nas três ações comparadas.

Dois campos se repetem:

- **atraso:** imediatamente / depois de 5 minutos / 10 minutos / um dia / intervalo escolhido;
- **canal:** todos / o número da conta / qualquer canal.

| Grupo | Opção | Campos |
|---|---|---|
| Pipeline | Imediatamente quando criado nesta etapa | atraso |
| | Imediatamente quando movido para esta etapa | atraso |
| | Imediatamente quando movido para ou criado nesta etapa | atraso |
| | Quando o usuário responsável é alterado em lead | — |
| | Quando um usuário adiciona uma tag (Pro) | adiciona/remove; lead/contato/empresa; tags |
| | Quando um campo é atualizado (Pro) | entidade; campo |
| Programados | N horas antes/depois de um campo de data | horas; antes/depois; campo |
| | Tempo exato | data; hora |
| | Diariamente / semanal / mensal / anual | periodicidade; hora; dia |
| | 48h antes do agendamento (Pro) | 48h / 24h / 1h / personalizado |
| Ações | Quando um formulário é enviado | — |
| | Quando um email é recebido | — |
| | Quando uma chamada é recebida | — |
| | Quando o site selecionado é visitado | atraso; site |
| | Após a criação de novo agendamento (Pro) | — |
| Conversação | Quando o chat é iniciado | entrada/saída/qualquer; canal |
| | N horas após a última mensagem recebida | horas; canal |
| | Em uma mensagem recebida (após pausa) | recebida/enviada; canal; pausa |
| | Quando uma mensagem de saída é vista | canal; prazo |
| | Após o encerramento de uma conversa | atraso; canal |

São 20 visíveis; há uma 21ª no código ("Pela ação-chave").

**Condições, em todo balão:** "Para todos os leads com: Adicionar uma condição". Escolhida, ela
vira uma linha com lixeira, e "Adicionar uma condição" reaparece embaixo para somar outra. A
lógica entre elas é `e`/`ou`, clicável. Operadores: correspondente, não corresponde, contém, não
contém, cheio, vazio.

## 4. As ações ("o que faz")

O `+` abre um modal com busca, 19 blocos nativos em três colunas e uma seção de widgets de
terceiros. Quase todo balão traz "Executar:", "Aplicar o gatilho a todos os leads já nesta etapa",
"Pronto" e "Cancelar".

| Bloco | Campos próprios |
|---|---|
| Robô de vendas | ativo sempre ou por dia/horário; deixar mensagem sem resposta; qual robô, ou criar |
| Lançar / parar agente de IA | qual agente — um por etapa |
| Adicionar uma tarefa | prazo; para quem; tipo; dicas; comentário |
| Criar lead | com o quê; para quem; funil e etapa |
| Enviar e-mail | modelo; remetente; só contato principal; link de descadastro |
| Enviar um webhook | URL |
| Mudar a etapa do lead | funil e etapa; motivo de perda |
| Editar tags | adicionar ou excluir; quais |
| Tarefas concluídas | tipo; prazo; comentário |
| Gerar formulário | individual ou de indicação; tags; alterar etapa |
| Alterar usuário de lead | para quem; alterar também em contatos e empresas |
| Alterar campo | campo e valor, vários no mesmo gatilho |
| Deletar arquivos | tipo; faixa de tamanho |

Cinco blocos Pro conectam serviços externos (Meta CAPI, Meta Ads, TikTok, Google Ads, Analytics) e
não foram abertos.

## 5. O painel da esquerda

323px, fundo `#F5F5F5`, rola junto com a grade. Duas seções: **Fontes de lead** (texto e botão
"+ Adicionar fonte") e **Pontuação** (selo Pro; o botão abre a oferta de teste de 14 dias). Um
minimapa das colunas fica no canto inferior direito.

## 6. A barra de cima

64px. Nome do funil com seta (abre a gaveta de funis, com lápis em cada e "Adicionar funil"),
"Voltar" (que vira "Sair", e "Cancelar" enquanto há etapa em edição) e "Salvar", branco com borda,
desabilitado enquanto não há mudança.

**Salva em dois níveis:** "Pronto" fecha o balão do gatilho; "Salvar", na barra, grava a tela. Uma
etapa nova não é gravada sozinha, e "Cancelar" a remove.

## 7. Cores e tipografia do Kommo

Registradas para conferência, **não para copiar** — ver o aviso do topo.

| Elemento | Valor |
|---|---|
| Azul de ação / borda | `#4C8BF7` / `#4077D6` |
| Fundo da página, painel e cabeçalhos | `#F5F5F5` |
| Célula vazia | `#FFFFFF` |
| Cartão de robô | `#D8EFFF` |
| Cartão de alteração (etapa, usuário) | `#F5F5F5` |
| Borda da grade | `#E8EAEB` |
| Texto / apoio / "Adicionar gatilho" | `#363B44` / `#92989B` / `#CBCFD0` |

Fonte: PT Sans, Arial, sans-serif.

| Texto | Tamanho | Peso | Altura de linha |
|---|---|---|---|
| Cabeçalho de coluna | 12px | 700 | maiúsculas, `letter-spacing: 1px` |
| Linha "quando" | 13px | 400 | 15,6px |
| Nome da ação | 14px | 700 | 15,82px |
| Link de dicas e "Adicionar gatilho" | 15px | 400 | |
| Botões | 14px | 700 | raio 4px |

## 8. O que ficou sem verificar

Arrastar etapa de fato; esticar cartão entre colunas; soltar a cópia de um gatilho; o efeito de
"Pronto" e "Salvar"; os operadores das condições que não sejam tags; os campos dos blocos Pro e
dos widgets; e as telas que exigem o plano Pro.

Nada disso deve ser preenchido por dedução. Se virar decisão de produto, o caminho é voltar à
extensão e medir.
